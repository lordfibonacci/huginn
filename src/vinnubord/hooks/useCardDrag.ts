import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import type { View } from '../lib/geometry'
import type { Gesture } from './useViewport'

// Card drag and tap. Spread bind on the world layer (inside the board element
// that carries useViewport's bind), so these handlers run before the board's.
//
// Mouse and pen: pointerdown on [data-card] lifts the card at once. Moving
// more than 3 px drags it, letting go under that is a tap.
// Touch: holding 350 ms lifts the card (haptic tick when the device has one),
// then the finger drags it. Letting go before that, without moving past a
// small slop, is a tap. A finger that moves first does nothing here.
//
// Pinch contract with useViewport: touch events are never stopped, the long
// press timer and every pointermove read gestureRef.current.pinching and give
// up when it is set, and losing pointer capture to the board cancels a drag.
// A cancelled drag puts the card back where it started.

const MOUSE_THRESHOLD = 3
const TOUCH_SLOP = 10
const LONG_PRESS_MS = 350
const HAPTIC_MS = 10
const CARD = '[data-card]'

type Press = {
  id: string
  pointerId: number
  touch: boolean
  el: HTMLElement
  sx: number
  sy: number
  ox: number
  oy: number
  x: number
  y: number
  dragging: boolean
  moved: boolean
  timer: ReturnType<typeof setTimeout> | null
}

export type CardDragOptions = {
  view: View
  gestureRef: RefObject<Gesture>
  // Current world position of a card, null if it is unknown.
  getPos: (id: string) => { x: number; y: number } | null
  onMove: (id: string, x: number, y: number) => void
  onDrop: (id: string, x: number, y: number) => void
  onCancel: (id: string, x: number, y: number) => void
  onTap: (id: string) => void
}

type Handler = (e: ReactPointerEvent<HTMLElement>) => void

export type CardDragBind = {
  onPointerDown: Handler
  onPointerMove: Handler
  onPointerUp: Handler
  onPointerCancel: Handler
  onLostPointerCapture: Handler
  onContextMenu: (e: ReactMouseEvent<HTMLElement>) => void
}

export function useCardDrag(opts: CardDragOptions): { draggingId: string | null; bind: CardDragBind } {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const press = useRef<Press | null>(null)
  // Latest options, so the handlers stay stable across renders.
  const o = useRef(opts)
  useLayoutEffect(() => {
    o.current = opts
  })

  const clear = useCallback((p: Press) => {
    if (p.timer) clearTimeout(p.timer)
    p.timer = null
    if (press.current === p) press.current = null
    if (p.dragging) setDraggingId(null)
  }, [])

  const cancel = useCallback(
    (p: Press) => {
      const wasDragging = p.dragging
      clear(p)
      if (p.el.hasPointerCapture(p.pointerId)) {
        try {
          p.el.releasePointerCapture(p.pointerId)
        } catch {
          // Already released, ignore.
        }
      }
      if (wasDragging && p.moved) o.current.onCancel(p.id, p.ox, p.oy)
    },
    [clear],
  )

  const lift = useCallback((p: Press) => {
    // Capture before marking the drag, so the lostpointercapture that moving
    // an implicit touch capture off a child fires is not taken as a cancel.
    try {
      p.el.setPointerCapture(p.pointerId)
    } catch {
      // The pointer may already be gone.
    }
    p.dragging = true
    setDraggingId(p.id)
  }, [])

  const onPointerDown = useCallback<Handler>(
    (e) => {
      if (press.current) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      const el = (e.target as Element).closest<HTMLElement>(CARD)
      if (!el) return
      const touch = e.pointerType === 'touch'
      // A second finger is a pinch for the viewport, never a drag.
      if (touch && !e.isPrimary) return
      const id = el.dataset.card
      if (!id) return
      const pos = o.current.getPos(id)
      if (!pos) return

      const p: Press = {
        id,
        pointerId: e.pointerId,
        touch,
        el,
        sx: e.clientX,
        sy: e.clientY,
        ox: pos.x,
        oy: pos.y,
        x: pos.x,
        y: pos.y,
        dragging: false,
        moved: false,
        timer: null,
      }
      press.current = p
      if (!touch) {
        lift(p)
        return
      }
      p.timer = setTimeout(() => {
        p.timer = null
        if (press.current !== p) return
        if (o.current.gestureRef.current?.pinching) {
          cancel(p)
          return
        }
        lift(p)
        if (typeof navigator.vibrate === 'function') navigator.vibrate(HAPTIC_MS)
      }, LONG_PRESS_MS)
    },
    [cancel, lift],
  )

  const onPointerMove = useCallback<Handler>(
    (e) => {
      const p = press.current
      if (!p || e.pointerId !== p.pointerId) return
      if (p.touch && o.current.gestureRef.current?.pinching) {
        cancel(p)
        return
      }
      const dx = e.clientX - p.sx
      const dy = e.clientY - p.sy
      const dist = Math.abs(dx) + Math.abs(dy)
      if (!p.dragging) {
        // Touch still waiting for the long press: moving first is not a drag or a tap.
        if (dist > TOUCH_SLOP) cancel(p)
        return
      }
      if (!p.moved && dist <= MOUSE_THRESHOLD) return
      p.moved = true
      const z = o.current.view.z
      p.x = p.ox + dx / z
      p.y = p.oy + dy / z
      o.current.onMove(p.id, p.x, p.y)
    },
    [cancel],
  )

  const onPointerUp = useCallback<Handler>(
    (e) => {
      const p = press.current
      if (!p || e.pointerId !== p.pointerId) return
      const { dragging, moved, touch } = p
      clear(p)
      if (dragging && moved) o.current.onDrop(p.id, p.x, p.y)
      else if (!touch || !dragging) o.current.onTap(p.id)
    },
    [clear],
  )

  const onPointerCancel = useCallback<Handler>(
    (e) => {
      const p = press.current
      if (p && e.pointerId === p.pointerId) cancel(p)
    },
    [cancel],
  )

  // A pinch takes capture from the card: cancel. Capture moving off a child
  // (implicit touch capture) to the card itself is not a cancel.
  const onLostPointerCapture = useCallback<Handler>(
    (e) => {
      const p = press.current
      if (!p || e.pointerId !== p.pointerId) return
      if (e.target === p.el || o.current.gestureRef.current?.pinching) cancel(p)
    },
    [cancel],
  )

  // No long press menu or callout on cards.
  const onContextMenu = useCallback((e: ReactMouseEvent<HTMLElement>) => {
    if ((e.target as Element).closest(CARD)) e.preventDefault()
  }, [])

  useEffect(
    () => () => {
      const p = press.current
      if (p?.timer) clearTimeout(p.timer)
      press.current = null
    },
    [],
  )

  return {
    draggingId,
    bind: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onLostPointerCapture, onContextMenu },
  }
}
