import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react'
import { fitAll, pinchView, zoomAt, type Rect, type View } from '../lib/geometry'

// Pan and zoom for the board element in ref.
//
// The consumer spreads bind on that same element and must give it
// `touch-action: none`, otherwise the browser scrolls and zooms the page
// instead of sending pointer events for pan and pinch.
//
// Rules:
// - One pointer on empty board pans. Pointers that start inside [data-card]
//   are ignored here, card drag lives in useCardDrag. Pointers that start on a
//   form control, link or [data-no-pan] are ignored too. Pack columns and
//   modules pan like the empty board.
// - Pointer capture is taken only once the pointer has moved past a few px, so
//   a plain click on a module or the board still reaches its onClick.
// - Two pointers pinch: zoom around the finger centre and pan with it.
// - Wheel zooms around the cursor. React attaches wheel listeners as passive,
//   so preventDefault does nothing there. The real wheel handler is therefore
//   a native non passive listener on ref.current, and bind.onWheel is a no op
//   kept so bind has the documented shape.
//
// All screen coordinates in View are relative to the element's top left
// corner, not the window.

const PAN_THRESHOLD = 3
const WHEEL_SPEED = 0.0016
const BUTTON_STEP = 1.25
const DEFAULT_PADDING = { top: 90, sides: 40, bottom: 60 }
const IGNORE = '[data-card], [data-no-pan], button, a, input, textarea, select, label'

type Pt = { x: number; y: number }

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
  bind: ViewportBind
}

function pinchOf(pts: Pt[]) {
  const [a, b] = pts
  return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) }
}

export function useViewport(ref: RefObject<HTMLElement | null>): Viewport {
  const [view, setView] = useState<View>({ x: 0, y: 0, z: 1 })
  const [isPanning, setIsPanning] = useState(false)

  // Active pointers in element coordinates, plus the pan anchor of the
  // pointer that pans when only one is down.
  const pointers = useRef(new Map<number, Pt>())
  const pan = useRef<{ id: number; last: Pt; moved: boolean } | null>(null)

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

  const fit = useCallback(
    (rects: Rect[], padding = DEFAULT_PADDING) => {
      setView(fitAll(rects, size(), padding))
    },
    [size],
  )

  // Native wheel listener so preventDefault works (see header). It runs after
  // every render and re attaches only when ref.current changed, so a board
  // element that mounts later (after a loader) still gets it.
  const wheelEl = useRef<HTMLElement | null>(null)
  const onNativeWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault()
      const p = local(e.clientX, e.clientY)
      setView((v) => zoomAt(v, Math.exp(-e.deltaY * WHEEL_SPEED), p.x, p.y))
    },
    [local],
  )
  useEffect(() => {
    const el = ref.current
    if (el === wheelEl.current) return
    wheelEl.current?.removeEventListener('wheel', onNativeWheel)
    el?.addEventListener('wheel', onNativeWheel, { passive: false })
    wheelEl.current = el
  })
  useEffect(
    () => () => {
      wheelEl.current?.removeEventListener('wheel', onNativeWheel)
      wheelEl.current = null
    },
    [onNativeWheel],
  )

  const endPointer = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const map = pointers.current
    if (!map.has(e.pointerId)) return
    map.delete(e.pointerId)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    if (map.size === 1) {
      // Pinch became a one finger pan, re anchor on the remaining pointer.
      const [id, pt] = map.entries().next().value as [number, Pt]
      pan.current = { id, last: pt, moved: true }
    } else if (map.size === 0) {
      pan.current = null
      setIsPanning(false)
    }
  }, [])

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      if ((e.target as Element).closest(IGNORE)) return
      const pt = local(e.clientX, e.clientY)
      const map = pointers.current
      map.set(e.pointerId, pt)
      if (map.size === 1) {
        pan.current = { id: e.pointerId, last: pt, moved: false }
      } else if (map.size === 2) {
        // Second finger: capture both so the pinch survives leaving the element.
        pan.current = null
        for (const id of map.keys()) {
          if (!e.currentTarget.hasPointerCapture(id)) {
            try {
              e.currentTarget.setPointerCapture(id)
            } catch {
              // The pointer may already be gone, ignore.
            }
          }
        }
        setIsPanning(true)
      }
    },
    [local],
  )

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const map = pointers.current
      const prevPt = map.get(e.pointerId)
      if (!prevPt) return
      const pt = local(e.clientX, e.clientY)

      if (map.size >= 2) {
        const pts = [...map.values()].slice(0, 2)
        const before = pinchOf(pts)
        map.set(e.pointerId, pt)
        const after = pinchOf([...map.values()].slice(0, 2))
        setView((v) => pinchView(v, before, after))
        return
      }

      map.set(e.pointerId, pt)
      const p = pan.current
      if (!p || p.id !== e.pointerId) return
      if (!p.moved) {
        // p.last is still the down point here, so the first pan step includes
        // the distance travelled below the threshold.
        if (Math.abs(pt.x - p.last.x) + Math.abs(pt.y - p.last.y) <= PAN_THRESHOLD) return
        p.moved = true
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
    bind: { onPointerDown, onPointerMove, onPointerUp: endPointer, onPointerCancel: endPointer, onWheel },
  }
}
