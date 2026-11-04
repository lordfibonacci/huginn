import { useCallback, useEffect, useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { screenToWorld, type Rect, type View } from '../lib/geometry'
import { marqueeRect, MARQUEE_MIN } from '../lib/selection'
import { draftBigEnough } from '../lib/zones'
import type { Gesture } from './useViewport'

// Draw mode, the press that draws a new box. Board calls onPointerDownCapture
// first from its capture phase pointerdown: while active it takes a primary
// press (mouse button 0, the first finger, a pen) anywhere on the board, cards
// and pack titles included, and stops it there, so the press neither lifts a
// card, draws a marquee nor pans. It returns true when it took the press, and
// Board hands the press to the marquee only when it did not. A press while
// the view is moving (a fling or a pinch) is left to the viewport, which
// stops the motion first. The draft is a div inside the board (boxRef) in
// screen space, written directly while the pointer moves, never through
// React state.
//
// Release: onDrawn with the rectangle in world units when the pointer moved
// and the rectangle is at least ZONE_MIN (draftBigEnough), onCancel
// otherwise. The click that follows is swallowed (window, capture phase,
// like useMarquee), so the board's own click does not close the open panel.
// A pointercancel, a second finger and active turning false (Esc, the top
// bar button) all end the press with onCancel. The second finger was never
// taken here, so the viewport gets it as usual; it never saw the first
// finger, so the second one pans rather than pinches. The first finger's
// capture is released, and the next primary press starts a fresh viewport
// gesture.

const CLICK_SWALLOW_MS = 500

type Press = { pointerId: number; sx: number; sy: number; x: number; y: number; moved: boolean; el: HTMLElement }

export type ZoneDrawOptions = {
  boardRef: RefObject<HTMLElement | null>
  viewRef: RefObject<View>
  gestureRef: RefObject<Gesture>
  active: boolean
  onDrawn: (rect: Rect) => void
  onCancel: () => void
}

export function useZoneDraw(opts: ZoneDrawOptions): {
  onPointerDownCapture: (e: ReactPointerEvent<HTMLElement>) => boolean
  boxRef: RefObject<HTMLDivElement | null>
} {
  const boxRef = useRef<HTMLDivElement | null>(null)
  const press = useRef<Press | null>(null)
  const swallowClickUntil = useRef(0)
  const o = useRef(opts)
  useLayoutEffect(() => {
    o.current = opts
  })

  // Pointer position relative to the board.
  const local = useCallback((clientX: number, clientY: number) => {
    const r = o.current.boardRef.current?.getBoundingClientRect()
    return { x: clientX - (r?.left ?? 0), y: clientY - (r?.top ?? 0) }
  }, [])

  // The draft in world units, for the new box.
  const worldRect = useCallback((p: Press): Rect => {
    const v = o.current.viewRef.current
    const [ax, ay] = screenToWorld(v, p.sx, p.sy)
    const [bx, by] = screenToWorld(v, p.x, p.y)
    return marqueeRect({ x: ax, y: ay }, { x: bx, y: by })
  }, [])

  const draw = useCallback((p: Press) => {
    const box = boxRef.current
    if (!box) return
    const r = marqueeRect({ x: p.sx, y: p.sy }, { x: p.x, y: p.y })
    box.style.left = `${r.x}px`
    box.style.top = `${r.y}px`
    box.style.width = `${r.w}px`
    box.style.height = `${r.h}px`
    box.classList.toggle('hg-on', p.moved)
  }, [])

  // Forget the live press: hide the draft and give its pointer back.
  const drop = useCallback((): Press | null => {
    const p = press.current
    if (!p) return null
    press.current = null
    boxRef.current?.classList.remove('hg-on')
    try {
      if (p.el.hasPointerCapture(p.pointerId)) p.el.releasePointerCapture(p.pointerId)
    } catch {
      // The pointer may already be gone.
    }
    return p
  }, [])

  const onPointerDownCapture = useCallback(
    (e: ReactPointerEvent<HTMLElement>): boolean => {
      if (!o.current.active) return false
      if ((e.target as Element).closest('input, textarea, select')) return false
      if (e.pointerType === 'mouse' && e.button !== 0) return false
      if (e.pointerType === 'touch' && !e.isPrimary) return false
      const g = o.current.gestureRef.current
      if (g.active || g.pinching) return false
      e.stopPropagation()
      e.preventDefault()
      const at = local(e.clientX, e.clientY)
      const el = e.currentTarget
      press.current = { pointerId: e.pointerId, sx: at.x, sy: at.y, x: at.x, y: at.y, moved: false, el }
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        // The pointer may already be gone.
      }
      return true
    },
    [local],
  )

  // Esc or the top bar button ends draw mode in the middle of a press.
  useEffect(() => {
    if (opts.active) return
    if (drop()) o.current.onCancel()
  }, [opts.active, drop])

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const p = press.current
      if (!p || e.pointerId === p.pointerId || e.pointerType !== 'touch') return
      drop()
      o.current.onCancel()
    }
    const onMove = (e: PointerEvent) => {
      const p = press.current
      if (!p || e.pointerId !== p.pointerId) return
      const at = local(e.clientX, e.clientY)
      p.x = at.x
      p.y = at.y
      if (!p.moved && Math.abs(p.x - p.sx) + Math.abs(p.y - p.sy) > MARQUEE_MIN) p.moved = true
      if (p.moved) draw(p)
    }
    const onUp = (e: PointerEvent) => {
      const p = press.current
      if (!p || e.pointerId !== p.pointerId) return
      const at = local(e.clientX, e.clientY)
      p.x = at.x
      p.y = at.y
      drop()
      swallowClickUntil.current = performance.now() + CLICK_SWALLOW_MS
      const rect = worldRect(p)
      if (p.moved && draftBigEnough(rect)) o.current.onDrawn(rect)
      else o.current.onCancel()
    }
    const onCancel = (e: PointerEvent) => {
      const p = press.current
      if (!p || e.pointerId !== p.pointerId) return
      drop()
      o.current.onCancel()
    }
    const onClick = (e: Event) => {
      if (performance.now() >= swallowClickUntil.current) return
      swallowClickUntil.current = 0
      e.stopPropagation()
      e.preventDefault()
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('pointermove', onMove, true)
    window.addEventListener('pointerup', onUp, true)
    window.addEventListener('pointercancel', onCancel, true)
    window.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('pointermove', onMove, true)
      window.removeEventListener('pointerup', onUp, true)
      window.removeEventListener('pointercancel', onCancel, true)
      window.removeEventListener('click', onClick, true)
    }
  }, [local, draw, worldRect, drop])

  return { onPointerDownCapture, boxRef }
}
