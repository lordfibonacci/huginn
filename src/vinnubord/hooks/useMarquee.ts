import { useCallback, useEffect, useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { screenToWorld, type Rect, type View } from '../lib/geometry'
import { isMarqueePress, marqueeRect, MARQUEE_MIN, type SelTarget } from '../lib/selection'
import { dragTargetOf } from './useCardDrag'

// Marquee selection, mouse only. Spread bind on the board element: the
// capture phase pointerdown sees a Ctrl (Cmd) primary mouse press before
// useCardDrag on the world layer and useViewport on the board, and stops it
// there, so the press neither lifts a card nor pans. The rectangle is a div
// inside the board (boxRef) in screen space, written directly while the
// pointer moves, never through React state.
//
// Release past MARQUEE_MIN: onSelect with the rectangle in world units and
// whether Shift was held (add to the selection). Release under it on a card
// or a pack title: onToggle for that target. Under it elsewhere: onClear.
// The click that follows a marquee or a toggle is swallowed (window,
// capture phase, like useCardDrag), so the board's own click does not close
// the open panel or clear what was just selected.

const CLICK_SWALLOW_MS = 500
const GRIP = '[data-card], [data-grip]'

type Press = { pointerId: number; sx: number; sy: number; x: number; y: number; moved: boolean; target: SelTarget | null }

export type MarqueeOptions = {
  boardRef: RefObject<HTMLElement | null>
  viewRef: RefObject<View>
  onSelect: (rect: Rect, additive: boolean) => void
  onToggle: (t: SelTarget) => void
  onClear: () => void
}

export type MarqueeBind = { onPointerDownCapture: (e: ReactPointerEvent<HTMLElement>) => void }

export function useMarquee(opts: MarqueeOptions): { bind: MarqueeBind; boxRef: RefObject<HTMLDivElement | null> } {
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

  const onPointerDownCapture = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (!isMarqueePress(e)) return
      if ((e.target as Element).closest('input, textarea, select')) return
      e.stopPropagation()
      e.preventDefault()
      const grip = (e.target as Element).closest<HTMLElement>(GRIP)
      const at = local(e.clientX, e.clientY)
      press.current = { pointerId: e.pointerId, sx: at.x, sy: at.y, x: at.x, y: at.y, moved: false, target: grip ? dragTargetOf(grip) : null }
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // The pointer may already be gone.
      }
    },
    [local],
  )

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const p = press.current
      if (!p || e.pointerId !== p.pointerId) return
      const at = local(e.clientX, e.clientY)
      p.x = at.x
      p.y = at.y
      if (!p.moved && Math.abs(p.x - p.sx) + Math.abs(p.y - p.sy) > MARQUEE_MIN) p.moved = true
      if (p.moved) draw(p)
    }
    const end = (e: PointerEvent, cancelled: boolean) => {
      const p = press.current
      if (!p || e.pointerId !== p.pointerId) return
      press.current = null
      boxRef.current?.classList.remove('hg-on')
      if (cancelled) return
      swallowClickUntil.current = performance.now() + CLICK_SWALLOW_MS
      if (p.moved) {
        const v = o.current.viewRef.current
        const [ax, ay] = screenToWorld(v, p.sx, p.sy)
        const [bx, by] = screenToWorld(v, p.x, p.y)
        o.current.onSelect(marqueeRect({ x: ax, y: ay }, { x: bx, y: by }), e.shiftKey)
      } else if (p.target) {
        o.current.onToggle(p.target)
      } else {
        o.current.onClear()
      }
    }
    const onUp = (e: PointerEvent) => end(e, false)
    const onCancel = (e: PointerEvent) => end(e, true)
    const onClick = (e: Event) => {
      if (performance.now() >= swallowClickUntil.current) return
      swallowClickUntil.current = 0
      e.stopPropagation()
      e.preventDefault()
    }
    window.addEventListener('pointermove', onMove, true)
    window.addEventListener('pointerup', onUp, true)
    window.addEventListener('pointercancel', onCancel, true)
    window.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('pointermove', onMove, true)
      window.removeEventListener('pointerup', onUp, true)
      window.removeEventListener('pointercancel', onCancel, true)
      window.removeEventListener('click', onClick, true)
    }
  }, [local, draw])

  return { bind: { onPointerDownCapture }, boxRef }
}
