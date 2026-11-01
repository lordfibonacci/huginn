import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react'
import { fitAll, fitWidth as fitWidthView, pinchView, zoomAt, type Rect, type View } from '../lib/geometry'
import { PAN_THRESHOLD, panStep, touchSlop, touchTracks, type TouchKind } from '../lib/gesture'
import { parseDuration } from '../lib/motion'

// Pan and zoom for the board element in ref.
//
// Consumer requirements:
// - Spread bind on the element in ref and give it `touch-action: none`,
//   otherwise the browser scrolls and zooms the page instead of sending
//   pointer events for pan and pinch.
// - Put worldRef on the world layer inside it and zoomLabelRef on the zoom
//   percentage. The world layer is drawn with
//   `transform: translate(view.x px, view.y px) scale(view.z)` and MUST have
//   `transform-origin: 0 0`. The geometry assumes the origin is the top left.
//   Do not write transform or --hg-z on it from React.
// - All screen coordinates here are relative to the element's top left corner,
//   not the window. Subtract its getBoundingClientRect before screenToWorld.
//
// The view lives in viewRef and is written to the world element directly;
// React state follows at gesture end. apply() writes the ref, the world
// transform, --hg-z and the zoom label text. sync() copies the ref into the
// `view` state: when the last pointer lifts, 120 ms after the last wheel step,
// at the end of a glide (animateTo) and on setView. Anything that needs the
// view every frame reads viewRef, not `view`.
//
// Rules:
// - Mouse and pen: pointers that start on a form control, button, link, label
//   or [data-no-pan] are ignored completely. A pointer that starts inside
//   [data-card] is ignored, card drag lives in useCardDrag. Anything else
//   (empty board, pack columns) pans with the primary button.
// - Touch: a touch that starts on a form control or [data-no-pan] is ignored
//   completely. Every other touch pointer is tracked, also those that start on
//   a card. Touch on a button, link or label inside the board (module cards,
//   pack titles) pans past CARD_PAN_SLOP and pinches like a card; only fields
//   and [data-no-pan] are ignored. A finger that starts on the board pans past
//   PAN_THRESHOLD. A finger that starts on a card pans past CARD_PAN_SLOP
//   (lib/gesture), unless that pointer is dragging the card
//   (gestureRef.current.dragPointer). When two fingers are down a pinch
//   starts, even if one or both are on cards.
// - A pinch zooms around the finger centre and pans with it. When one finger
//   lifts, the other pans if it did not start on a card, otherwise nothing
//   moves.
// - gestureRef.current.active is true from the first move of a pan or pinch
//   until the last pointer lifts.
// - Pointer capture for a pan is taken only once the pointer has moved past its
//   slop, so a plain click or tap on a module or the board reaches its onClick.
//   A pinch captures both fingers on the board element at once, which takes
//   capture away from a card that held it.
// - Click after a gesture: when a pan that moved or a pinch ends, the next
//   click on the element (within 500 ms, and only if no new pointerdown came
//   first) is swallowed by a native capture phase listener, so React onClick handlers on the board and on anything
//   inside it do not fire for the click that ends a pan. onClickCapture
//   handlers above the board still see it.
// - Wheel zooms around the cursor. React attaches wheel listeners as passive,
//   so preventDefault does nothing there. The real wheel handler is a native
//   non passive listener on ref.current, and bind.onWheel is a no op kept so
//   bind has the documented shape.
// - Zoom buttons and fit glide over --hg-dur-view (animateTo). A pointerdown on
//   the board or a wheel step stops a running glide where it is.
//
// Contract for useCardDrag (Task 3):
// - Do not stopPropagation on touch pointerdown, pointermove, pointerup or
//   pointercancel, the board must see every finger to start a pinch.
// - Cancel the long press when the finger moves past CARD_PAN_SLOP: that same
//   move starts a board pan here. Set gestureRef.current.dragPointer to the
//   pointer id while a card drag is active and back to null when it ends; the
//   board never pans that pointer.
// - The board handler runs after the card handler (bubble order), so at the
//   card's own pointerdown the second finger is not counted yet. Read
//   `gestureRef.current.pinching` synchronously in the long press timer and in
//   every pointermove: if it is true, cancel the 350 ms long press, never move
//   the card, and do not restart the drag for that pointer when the pinch ends.
//   `isPinching` is the same flag as React state for effects and styling.
// - A pinch may take pointer capture from the card. Treat lostpointercapture
//   on the card as a cancel.
// - Read the zoom from viewRef.current, never from `view`: during a gesture
//   `view` is the state of the last gesture end.

const WHEEL_SPEED = 0.0016
const WHEEL_SYNC_MS = 120
const BUTTON_STEP = 1.25
const CLICK_SUPPRESS_MS = 500
const DEFAULT_PADDING = { top: 90, sides: 40, bottom: 60 }
const NO_PAN = '[data-no-pan], button, a, input, textarea, select, label'
const FIELD = 'input, textarea, select'
const CARD = '[data-card]'

type Pt = { x: number; y: number }
type Tracked = { pt: Pt; touch: boolean; canPan: boolean; kind: TouchKind }
type Pan = { id: number; last: Pt; moved: boolean; slop: number; kind: TouchKind }

// pinches counts pinch starts, so a press can tell whether one happened while
// it was down. dragPointer is written by useCardDrag: the pointer that drags a
// card, or null. active: a pan or pinch is moving the view right now.
export type Gesture = { touchCount: number; pinching: boolean; pinches: number; dragPointer: number | null; active: boolean }
export type Padding = { top: number; sides: number; bottom: number }

export type ViewportBind = {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void
  onWheel: (e: ReactWheelEvent<HTMLElement>) => void
}

export type Viewport = {
  // React state, synced at gesture end.
  view: View
  // Live value, read in frames.
  viewRef: RefObject<View>
  // Board puts it on .hg-world.
  worldRef: RefObject<HTMLDivElement | null>
  // Board puts it on .hg-zoom-val.
  zoomLabelRef: RefObject<HTMLElement | null>
  // Apply at once and sync.
  setView: (v: View) => void
  animateTo: (target: View, ms?: number) => void
  zoomIn: () => void
  zoomOut: () => void
  // animate defaults to true.
  fit: (rects: Rect[], padding?: Padding, animate?: boolean) => void
  // Animated.
  fitWidth: (rect: Rect, padding?: Padding) => void
  isPanning: boolean
  isPinching: boolean
  // Stable ref, safe to read synchronously from other pointer handlers.
  gestureRef: RefObject<Gesture>
  bind: ViewportBind
}

function pinchOf(a: Pt, b: Pt) {
  return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) }
}

// The glide length from its token, 0 under reduced motion.
function viewDurMs(): number {
  return parseDuration(getComputedStyle(document.documentElement).getPropertyValue('--hg-dur-view'))
}

function touchKind(target: Element): TouchKind {
  if (target.closest(FIELD)) return 'field'
  if (target.closest('[data-no-pan]')) return 'noPan'
  if (target.closest(CARD)) return 'card'
  if (target.closest('button, a, label')) return 'button'
  return 'board'
}

const START: View = { x: 0, y: 0, z: 1 }

export function useViewport(ref: RefObject<HTMLElement | null>): Viewport {
  const viewRef = useRef<View>(START)
  const worldRef = useRef<HTMLDivElement | null>(null)
  const zoomLabelRef = useRef<HTMLElement | null>(null)
  const [view, setViewState] = useState<View>(START)
  const [isPanning, setIsPanning] = useState(false)
  const [isPinching, setIsPinching] = useState(false)

  // Active pointers in element coordinates, the pan anchor of the pointer that
  // pans alone, whether the current gesture moved the view, and the click
  // suppression deadline.
  const pointers = useRef(new Map<number, Tracked>())
  const pan = useRef<Pan | null>(null)
  const gestureRef = useRef<Gesture>({ touchCount: 0, pinching: false, pinches: 0, dragPointer: null, active: false })
  const gestureMoved = useRef(false)
  const suppressClickUntil = useRef(0)
  // The running glide's frame, and the timer that syncs after the last wheel step.
  const animRaf = useRef(0)
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const apply = useCallback((v: View) => {
    viewRef.current = v
    const world = worldRef.current
    if (world) {
      world.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.z})`
      world.style.setProperty('--hg-z', String(v.z))
    }
    const label = zoomLabelRef.current
    if (label) label.textContent = `${Math.round(v.z * 100)}%`
  }, [])

  const sync = useCallback(() => {
    setViewState(viewRef.current)
  }, [])

  // Stops a running glide where it is. Returns whether one was running.
  const stopAnim = useCallback(() => {
    if (!animRaf.current) return false
    cancelAnimationFrame(animRaf.current)
    animRaf.current = 0
    return true
  }, [])

  const setView = useCallback(
    (v: View) => {
      stopAnim()
      apply(v)
      sync()
    },
    [stopAnim, apply, sync],
  )

  // A world layer that mounts later (after a loader) gets the current view
  // before paint. Runs after every render, acts only when the element changed.
  const appliedWorld = useRef<HTMLDivElement | null>(null)
  useLayoutEffect(() => {
    if (worldRef.current === appliedWorld.current) return
    appliedWorld.current = worldRef.current
    if (worldRef.current) apply(viewRef.current)
  })

  const animateTo = useCallback(
    (target: View, ms = viewDurMs()) => {
      stopAnim()
      if (ms <= 0) {
        setView(target)
        return
      }
      const from = viewRef.current
      const start = performance.now()
      const step = (now: number) => {
        const t = Math.min(1, Math.max(0, (now - start) / ms))
        if (t >= 1) {
          animRaf.current = 0
          setView(target)
          return
        }
        const p = 1 - (1 - t) ** 3
        apply({
          x: from.x + (target.x - from.x) * p,
          y: from.y + (target.y - from.y) * p,
          z: from.z + (target.z - from.z) * p,
        })
        animRaf.current = requestAnimationFrame(step)
      }
      animRaf.current = requestAnimationFrame(step)
    },
    [stopAnim, setView, apply],
  )

  const local = useCallback(
    (clientX: number, clientY: number): Pt => {
      const r = ref.current?.getBoundingClientRect()
      return { x: clientX - (r?.left ?? 0), y: clientY - (r?.top ?? 0) }
    },
    [ref],
  )

  const size = useCallback(() => {
    const el = ref.current
    return { w: el?.clientWidth ?? 0, h: el?.clientHeight ?? 0 }
  }, [ref])

  const zoomIn = useCallback(() => {
    const { w, h } = size()
    animateTo(zoomAt(viewRef.current, BUTTON_STEP, w / 2, h / 2))
  }, [size, animateTo])

  const zoomOut = useCallback(() => {
    const { w, h } = size()
    animateTo(zoomAt(viewRef.current, 1 / BUTTON_STEP, w / 2, h / 2))
  }, [size, animateTo])

  // No op while the element is hidden or not laid out yet (w or h is 0).
  const fit = useCallback(
    (rects: Rect[], padding: Padding = DEFAULT_PADDING, animate = true) => {
      const s = size()
      if (s.w <= 0 || s.h <= 0) return
      const v = fitAll(rects, s, padding)
      if (animate) animateTo(v)
      else setView(v)
    },
    [size, animateTo, setView],
  )

  const fitWidth = useCallback(
    (rect: Rect, padding: Padding = DEFAULT_PADDING) => {
      const s = size()
      if (s.w <= 0 || s.h <= 0) return
      animateTo(fitWidthView(rect, s, padding))
    },
    [size, animateTo],
  )

  // Native listeners (see header): non passive wheel, capture phase click and
  // pointerdown for click suppression.
  // The effect runs after every render and re attaches only when ref.current
  // changed, so a board element that mounts later (after a loader) gets them.
  const nativeEl = useRef<HTMLElement | null>(null)
  const onNativeWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault()
      stopAnim()
      const p = local(e.clientX, e.clientY)
      apply(zoomAt(viewRef.current, Math.exp(-e.deltaY * WHEEL_SPEED), p.x, p.y))
      if (wheelTimer.current) clearTimeout(wheelTimer.current)
      wheelTimer.current = setTimeout(() => {
        wheelTimer.current = null
        sync()
      }, WHEEL_SYNC_MS)
    },
    [local, stopAnim, apply, sync],
  )
  const onNativeClick = useCallback((e: MouseEvent) => {
    if (performance.now() >= suppressClickUntil.current) return
    suppressClickUntil.current = 0
    e.stopPropagation()
    e.preventDefault()
  }, [])
  // A new press means the click that ends a pan did not come (touch pans
  // usually fire none), so the next click is a real one.
  const onNativeDown = useCallback(() => {
    suppressClickUntil.current = 0
  }, [])
  useEffect(() => {
    const el = ref.current
    if (el === nativeEl.current) return
    const old = nativeEl.current
    if (old) {
      old.removeEventListener('wheel', onNativeWheel)
      old.removeEventListener('click', onNativeClick, true)
      old.removeEventListener('pointerdown', onNativeDown, true)
    }
    if (el) {
      el.addEventListener('wheel', onNativeWheel, { passive: false })
      el.addEventListener('click', onNativeClick, true)
      el.addEventListener('pointerdown', onNativeDown, true)
    }
    nativeEl.current = el
  })
  useEffect(
    () => () => {
      const el = nativeEl.current
      if (el) {
        el.removeEventListener('wheel', onNativeWheel)
        el.removeEventListener('click', onNativeClick, true)
        el.removeEventListener('pointerdown', onNativeDown, true)
      }
      nativeEl.current = null
    },
    [onNativeWheel, onNativeClick, onNativeDown],
  )

  // A glide or a pending wheel sync never outlives the board.
  useEffect(
    () => () => {
      if (animRaf.current) cancelAnimationFrame(animRaf.current)
      animRaf.current = 0
      if (wheelTimer.current) clearTimeout(wheelTimer.current)
      wheelTimer.current = null
    },
    [],
  )

  const syncTouchCount = useCallback(() => {
    let n = 0
    for (const t of pointers.current.values()) if (t.touch) n++
    gestureRef.current.touchCount = n
  }, [])

  const setPinching = useCallback((on: boolean) => {
    if (on && !gestureRef.current.pinching) gestureRef.current.pinches++
    gestureRef.current.pinching = on
    setIsPinching(on)
  }, [])

  // The first move of a pan or pinch.
  const startMoving = useCallback(() => {
    gestureRef.current.active = true
  }, [])

  // The gesture is over: React gets the view.
  const finish = useCallback(() => {
    gestureRef.current.active = false
    sync()
  }, [sync])

  // Forget every tracked pointer. A primary pointerdown starts a new gesture,
  // so anything still in the map is stale (its up event was missed).
  const reset = useCallback(() => {
    pointers.current.clear()
    pan.current = null
    gestureMoved.current = false
    gestureRef.current.touchCount = 0
    if (gestureRef.current.active) finish()
    if (gestureRef.current.pinching) setPinching(false)
    setIsPanning(false)
  }, [setPinching, finish])

  const endPointer = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const map = pointers.current
      if (!map.has(e.pointerId)) return
      map.delete(e.pointerId)
      syncTouchCount()
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
      if (map.size < 2 && gestureRef.current.pinching) setPinching(false)
      if (map.size === 1) {
        // A pinch lost a finger: the other one pans only if it did not start on a card.
        const [id, t] = map.entries().next().value as [number, Tracked]
        pan.current = t.canPan ? { id, last: t.pt, moved: true, slop: PAN_THRESHOLD, kind: t.kind } : null
        if (!t.canPan) setIsPanning(false)
      } else if (map.size === 0) {
        if (gestureMoved.current) suppressClickUntil.current = performance.now() + CLICK_SUPPRESS_MS
        gestureMoved.current = false
        pan.current = null
        setIsPanning(false)
        finish()
      }
    },
    [syncTouchCount, setPinching, finish],
  )

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      // Any press stops a glide where it is.
      if (stopAnim()) sync()
      if (e.pointerType === 'mouse' && e.button !== 0) return
      const target = e.target as Element
      const touch = e.pointerType === 'touch'
      let kind: TouchKind = 'board'
      if (touch) {
        kind = touchKind(target)
        if (!touchTracks(kind)) return
      } else {
        if (target.closest(NO_PAN)) return
        if (target.closest(CARD)) return
      }

      if (e.isPrimary) reset()
      const pt = local(e.clientX, e.clientY)
      const map = pointers.current
      map.set(e.pointerId, { pt, touch, canPan: kind !== 'card', kind })
      syncTouchCount()

      if (map.size === 1) {
        pan.current = { id: e.pointerId, last: pt, moved: false, slop: touch ? touchSlop(kind) : PAN_THRESHOLD, kind }
      } else if (map.size === 2) {
        // Second finger: pinch. Capture both so the pinch survives leaving the element.
        pan.current = null
        gestureMoved.current = true
        for (const id of map.keys()) {
          if (!e.currentTarget.hasPointerCapture(id)) {
            try {
              e.currentTarget.setPointerCapture(id)
            } catch {
              // The pointer may already be gone, ignore.
            }
          }
        }
        setPinching(true)
        setIsPanning(true)
      }
    },
    [stopAnim, sync, local, reset, syncTouchCount, setPinching],
  )

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const map = pointers.current
      const tracked = map.get(e.pointerId)
      if (!tracked) return
      const pt = local(e.clientX, e.clientY)

      if (map.size >= 2) {
        const [a, b] = [...map.values()]
        const before = pinchOf(a.pt, b.pt)
        tracked.pt = pt
        const after = pinchOf(a.pt, b.pt)
        if (!gestureRef.current.active) startMoving()
        apply(pinchView(viewRef.current, before, after))
        return
      }

      tracked.pt = pt
      const p = pan.current
      if (!p || p.id !== e.pointerId) return
      // A card being dragged by this finger is never a pan.
      if (p.kind === 'card' && gestureRef.current.dragPointer === e.pointerId) return
      if (!p.moved) {
        // p.last is still the down point here, so the first pan step includes
        // the distance travelled below the threshold.
        const dist = Math.abs(pt.x - p.last.x) + Math.abs(pt.y - p.last.y)
        if (panStep({ slop: p.slop, dragging: false, dist }) !== 'start') return
        p.moved = true
        gestureMoved.current = true
        e.currentTarget.setPointerCapture(e.pointerId)
        setIsPanning(true)
      }
      const dx = pt.x - p.last.x
      const dy = pt.y - p.last.y
      p.last = pt
      if (!gestureRef.current.active) startMoving()
      const v = viewRef.current
      apply({ ...v, x: v.x + dx, y: v.y + dy })
    },
    [local, apply, startMoving],
  )

  const onWheel = useCallback(() => {
    // Handled by the native listener above.
  }, [])

  return {
    view,
    viewRef,
    worldRef,
    zoomLabelRef,
    setView,
    animateTo,
    zoomIn,
    zoomOut,
    fit,
    fitWidth,
    isPanning,
    isPinching,
    gestureRef,
    bind: { onPointerDown, onPointerMove, onPointerUp: endPointer, onPointerCancel: endPointer, onWheel },
  }
}
