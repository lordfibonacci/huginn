import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react'
import { fitAll, pinchView, zoomAt, type Rect, type View } from '../lib/geometry'
import { CARD_PAN_SLOP, PAN_THRESHOLD, panStep } from '../lib/gesture'

// Pan and zoom for the board element in ref.
//
// Consumer requirements:
// - Spread bind on the element in ref and give it `touch-action: none`,
//   otherwise the browser scrolls and zooms the page instead of sending
//   pointer events for pan and pinch.
// - The world layer inside it is drawn with
//   `transform: translate(view.x px, view.y px) scale(view.z)` and MUST have
//   `transform-origin: 0 0`. The geometry assumes the origin is the top left.
// - All screen coordinates here are relative to the element's top left corner,
//   not the window. Subtract its getBoundingClientRect before screenToWorld.
//
// Rules:
// - Pointers that start on a form control, link, label or [data-no-pan] are
//   ignored completely.
// - Mouse and pen: a pointer that starts inside [data-card] is ignored, card
//   drag lives in useCardDrag. Anything else (empty board, pack columns,
//   modules) pans with the primary button.
// - Touch: every touch pointer is tracked, also those that start on a card.
//   A finger that starts off cards pans past PAN_THRESHOLD. A finger that
//   starts on a card pans past CARD_PAN_SLOP (lib/gesture), unless that
//   pointer is dragging the card (gestureRef.current.dragPointer). When two
//   fingers are down a pinch starts, even if one or both are on cards.
// - A pinch zooms around the finger centre and pans with it. When one finger
//   lifts, the other pans if it started off cards, otherwise nothing moves.
// - Pointer capture for a pan is taken only once the pointer has moved past a
//   few px, so a plain click on a module or the board reaches its onClick.
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

const WHEEL_SPEED = 0.0016
const BUTTON_STEP = 1.25
const CLICK_SUPPRESS_MS = 500
const DEFAULT_PADDING = { top: 90, sides: 40, bottom: 60 }
const NO_PAN = '[data-no-pan], button, a, input, textarea, select, label'
const CARD = '[data-card]'

type Pt = { x: number; y: number }
type Tracked = { pt: Pt; touch: boolean; canPan: boolean }

// pinches counts pinch starts, so a press can tell whether one happened while
// it was down. dragPointer is written by useCardDrag: the pointer that drags a
// card, or null.
export type Gesture = { touchCount: number; pinching: boolean; pinches: number; dragPointer: number | null }

export type ViewportBind = {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void
  onWheel: (e: ReactWheelEvent<HTMLElement>) => void
}

export type Viewport = {
  view: View
  setView: (v: View | ((prev: View) => View)) => void
  zoomIn: () => void
  zoomOut: () => void
  fit: (rects: Rect[], padding?: { top: number; sides: number; bottom: number }) => void
  isPanning: boolean
  isPinching: boolean
  // Stable ref, safe to read synchronously from other pointer handlers.
  gestureRef: RefObject<Gesture>
  bind: ViewportBind
}

function pinchOf(a: Pt, b: Pt) {
  return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) }
}

export function useViewport(ref: RefObject<HTMLElement | null>): Viewport {
  const [view, setView] = useState<View>({ x: 0, y: 0, z: 1 })
  const [isPanning, setIsPanning] = useState(false)
  const [isPinching, setIsPinching] = useState(false)

  // Active pointers in element coordinates, the pan anchor of the pointer that
  // pans alone, whether the current gesture moved the view, and the click
  // suppression deadline.
  const pointers = useRef(new Map<number, Tracked>())
  const pan = useRef<{ id: number; last: Pt; moved: boolean; fromCard: boolean } | null>(null)
  const gestureRef = useRef<Gesture>({ touchCount: 0, pinching: false, pinches: 0, dragPointer: null })
  const gestureMoved = useRef(false)
  const suppressClickUntil = useRef(0)

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
    setView((v) => zoomAt(v, BUTTON_STEP, w / 2, h / 2))
  }, [size])

  const zoomOut = useCallback(() => {
    const { w, h } = size()
    setView((v) => zoomAt(v, 1 / BUTTON_STEP, w / 2, h / 2))
  }, [size])

  // No op while the element is hidden or not laid out yet (w or h is 0).
  const fit = useCallback(
    (rects: Rect[], padding = DEFAULT_PADDING) => {
      const s = size()
      if (s.w <= 0 || s.h <= 0) return
      setView(fitAll(rects, s, padding))
    },
    [size],
  )

  // Native listeners (see header): non passive wheel, capture phase click and
  // pointerdown for click suppression.
  // The effect runs after every render and re attaches only when ref.current
  // changed, so a board element that mounts later (after a loader) gets them.
  const nativeEl = useRef<HTMLElement | null>(null)
  const onNativeWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault()
      const p = local(e.clientX, e.clientY)
      setView((v) => zoomAt(v, Math.exp(-e.deltaY * WHEEL_SPEED), p.x, p.y))
    },
    [local],
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

  // Forget every tracked pointer. A primary pointerdown starts a new gesture,
  // so anything still in the map is stale (its up event was missed).
  const reset = useCallback(() => {
    pointers.current.clear()
    pan.current = null
    gestureMoved.current = false
    gestureRef.current.touchCount = 0
    if (gestureRef.current.pinching) setPinching(false)
    setIsPanning(false)
  }, [setPinching])

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
        // A pinch lost a finger: the other one pans only if it started off cards.
        const [id, t] = map.entries().next().value as [number, Tracked]
        pan.current = t.canPan ? { id, last: t.pt, moved: true, fromCard: false } : null
        if (!t.canPan) setIsPanning(false)
      } else if (map.size === 0) {
        if (gestureMoved.current) suppressClickUntil.current = performance.now() + CLICK_SUPPRESS_MS
        gestureMoved.current = false
        pan.current = null
        setIsPanning(false)
      }
    },
    [syncTouchCount, setPinching],
  )

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      const target = e.target as Element
      if (target.closest(NO_PAN)) return
      const touch = e.pointerType === 'touch'
      const onCard = !!target.closest(CARD)
      if (onCard && !touch) return

      if (e.isPrimary) reset()
      const pt = local(e.clientX, e.clientY)
      const map = pointers.current
      map.set(e.pointerId, { pt, touch, canPan: !onCard })
      syncTouchCount()

      if (map.size === 1) {
        pan.current = { id: e.pointerId, last: pt, moved: false, fromCard: onCard }
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
    [local, reset, syncTouchCount, setPinching],
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
        setView((v) => pinchView(v, before, after))
        return
      }

      tracked.pt = pt
      const p = pan.current
      if (!p || p.id !== e.pointerId) return
      // A card being dragged by this finger is never a pan.
      if (p.fromCard && gestureRef.current.dragPointer === e.pointerId) return
      if (!p.moved) {
        // p.last is still the down point here, so the first pan step includes
        // the distance travelled below the threshold.
        const dist = Math.abs(pt.x - p.last.x) + Math.abs(pt.y - p.last.y)
        if (panStep({ slop: p.fromCard ? CARD_PAN_SLOP : PAN_THRESHOLD, dragging: false, dist }) !== 'start') return
        p.moved = true
        gestureMoved.current = true
        e.currentTarget.setPointerCapture(e.pointerId)
        setIsPanning(true)
      }
      const dx = pt.x - p.last.x
      const dy = pt.y - p.last.y
      p.last = pt
      setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }))
    },
    [local],
  )

  const onWheel = useCallback(() => {
    // Handled by the native listener above.
  }, [])

  return {
    view,
    setView,
    zoomIn,
    zoomOut,
    fit,
    isPanning,
    isPinching,
    gestureRef,
    bind: { onPointerDown, onPointerMove, onPointerUp: endPointer, onPointerCancel: endPointer, onWheel },
  }
}
