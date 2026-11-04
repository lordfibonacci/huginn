import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import type { View } from '../lib/geometry'
import { CARD_PAN_SLOP, PAN_THRESHOLD, pressOutcome } from '../lib/gesture'
import type { Gesture } from './useViewport'

// Card and pack drag and tap. Spread bind on the world layer (inside the
// board element that carries useViewport's bind), so these handlers run
// before the board's. Targets: an item card ([data-card], the
// whole card is the grip) and a pack column ([data-grip="pack"] inside
// [data-pack], the title button is the grip and the column moves with its
// modules). A box name ([data-grip="zone"] inside [data-zone]) and a box
// corner ([data-grip="zone-resize"] inside [data-zone]) are the third and
// fourth kinds and follow the pack rules; a tap on the name reaches the
// button's own onClick. All follow the same press rules below.
//
// Mouse and pen: pointerdown on a grip takes the target at once (capture,
// no board pan), but it shows as lifted only once the press moves more than
// 3 px and drags it, so a plain click does not flash the lift shadow. Letting
// go under that is a tap. The click that follows a drop is swallowed (window,
// capture phase), so a dragged pack title does not also fit its column.
// Touch: holding 350 ms lifts the card (haptic tick when the device has one),
// then the finger drags it. The drag is measured from where the finger is at
// the lift, so the small move allowed while waiting does not make the card
// jump. Letting go before that, without moving past CARD_PAN_SLOP, is a tap. A
// finger that moves past it first gives up the long press, and useViewport
// pans the board with that same move.
//
// Contract with useViewport: touch events are never stopped, the long press
// timer and every pointermove read gestureRef.current.pinching and give up
// when it is set, losing pointer capture to the board cancels a drag, and
// gestureRef.current.dragPointer names the pointer of an active drag so the
// board never pans it. A press that saw a second finger never taps and never
// lifts. A press that stopped a glide or fling
// (gestureRef.current.stoppedMotion) never taps, though a long press still
// lifts. Release and cancel are read on window in the capture phase, because
// a pinch moves capture to the board and the finger's pointerup then never
// passes through the world layer.
// A cancelled drag puts the card back where it started.
// The zoom comes from viewRef.current at each move, never from React state.

const LONG_PRESS_MS = 350
const HAPTIC_MS = 10
const CLICK_SWALLOW_MS = 500
const GRIP = '[data-card], [data-grip]'

export type DragKind = 'card' | 'pack' | 'zone' | 'zoneResize'
// One object type per kind, so a check on kind narrows the target (a
// zoneResize is not a selection target).
export type DragTarget = { [K in DragKind]: { kind: K; id: string } }[DragKind]

// The target a grip element belongs to, null when it is not a grip.
export function dragTargetOf(el: HTMLElement): DragTarget | null {
  const card = el.dataset.card
  if (card) return { kind: 'card', id: card }
  if (el.dataset.grip === 'pack') {
    const id = el.closest<HTMLElement>('[data-pack]')?.dataset.pack
    if (id) return { kind: 'pack', id }
  }
  if (el.dataset.grip === 'zone' || el.dataset.grip === 'zone-resize') {
    const id = el.closest<HTMLElement>('[data-zone]')?.dataset.zone
    if (id) return { kind: el.dataset.grip === 'zone' ? 'zone' : 'zoneResize', id }
  }
  return null
}

type Press = {
  kind: DragKind
  id: string
  pointerId: number
  touch: boolean
  el: HTMLElement
  sx: number
  sy: number
  // Last pointer position seen for this press.
  lx: number
  ly: number
  ox: number
  oy: number
  x: number
  y: number
  dragging: boolean
  moved: boolean
  // A second finger was down at some point during this press.
  sawPinch: boolean
  // gestureRef.current.pinches at pointerdown.
  pinchesAtDown: number
  timer: ReturnType<typeof setTimeout> | null
}

export type CardDragOptions = {
  viewRef: RefObject<View>
  gestureRef: RefObject<Gesture>
  // Current world position of a target, null if it is unknown.
  getPos: (t: DragTarget) => { x: number; y: number } | null
  onMove: (t: DragTarget, x: number, y: number) => void
  onDrop: (t: DragTarget, x: number, y: number) => void
  onCancel: (t: DragTarget, x: number, y: number) => void
  // A press that did not drag. A pack title tap also reaches its own onClick.
  onTap: (t: DragTarget) => void
}

type Handler = (e: ReactPointerEvent<HTMLElement>) => void

export type CardDragBind = {
  onPointerDown: Handler
  onPointerMove: Handler
  onLostPointerCapture: Handler
  onContextMenu: (e: ReactMouseEvent<HTMLElement>) => void
}

export function useCardDrag(opts: CardDragOptions): { dragging: DragTarget | null; bind: CardDragBind } {
  const [dragging, setDragging] = useState<DragTarget | null>(null)
  const press = useRef<Press | null>(null)
  // The click that ends a drop is swallowed until this time, 0 when none is.
  const swallowClickUntil = useRef(0)
  // Latest options, so the handlers stay stable across renders.
  const o = useRef(opts)
  useLayoutEffect(() => {
    o.current = opts
  })

  const clear = useCallback((p: Press) => {
    if (p.timer) clearTimeout(p.timer)
    p.timer = null
    if (press.current === p) press.current = null
    if (p.dragging) {
      setDragging(null)
      const g = o.current.gestureRef.current
      if (g && g.dragPointer === p.pointerId) g.dragPointer = null
    }
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
      if (wasDragging && p.moved) o.current.onCancel(target(p), p.ox, p.oy)
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
    const g = o.current.gestureRef.current
    if (g) g.dragPointer = p.pointerId
    if (!p.touch) return
    // Re-anchor to the finger and the card as they are now.
    p.sx = p.lx
    p.sy = p.ly
    const pos = o.current.getPos(target(p))
    if (pos) {
      p.ox = p.x = pos.x
      p.oy = p.y = pos.y
    }
    setDragging(target(p))
  }, [])

  const onPointerDown = useCallback<Handler>(
    (e) => {
      const current = press.current
      if (current && e.isPrimary && e.pointerId !== current.pointerId) {
        // A new primary pointer starts a new gesture: the old press is stale.
        cancel(current)
      } else if (current) {
        // Another finger while a card is pressed: this press is part of a pinch.
        if (e.pointerType === 'touch') current.sawPinch = true
        return
      }
      if (e.pointerType === 'mouse' && e.button !== 0) return
      const el = (e.target as Element).closest<HTMLElement>(GRIP)
      if (!el) return
      const touch = e.pointerType === 'touch'
      // A second finger is a pinch for the viewport, never a drag.
      if (touch && !e.isPrimary) return
      const t = dragTargetOf(el)
      if (!t) return
      const pos = o.current.getPos(t)
      if (!pos) return

      const p: Press = {
        kind: t.kind,
        id: t.id,
        pointerId: e.pointerId,
        touch,
        el,
        sx: e.clientX,
        sy: e.clientY,
        lx: e.clientX,
        ly: e.clientY,
        ox: pos.x,
        oy: pos.y,
        x: pos.x,
        y: pos.y,
        dragging: false,
        moved: false,
        sawPinch: false,
        pinchesAtDown: o.current.gestureRef.current?.pinches ?? 0,
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
        // A pinch now or at any time during the press: no lift, even after
        // the pinch ended and this finger is still down.
        const g = o.current.gestureRef.current
        if (p.sawPinch || g?.pinching || (g && g.pinches !== p.pinchesAtDown)) {
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
      const g = o.current.gestureRef.current
      if (p.touch && g && g.touchCount > 1) p.sawPinch = true
      if (p.touch && g?.pinching) {
        cancel(p)
        return
      }
      p.lx = e.clientX
      p.ly = e.clientY
      const dx = e.clientX - p.sx
      const dy = e.clientY - p.sy
      const dist = Math.abs(dx) + Math.abs(dy)
      if (!p.dragging) {
        // Touch still waiting for the long press: moving first is a board pan
        // (useViewport starts it on this same move), not a drag or a tap.
        if (dist > CARD_PAN_SLOP) cancel(p)
        return
      }
      if (!p.moved) {
        if (dist <= PAN_THRESHOLD) return
        p.moved = true
        // A mouse press shows as lifted from here, touch did at the lift.
        if (!p.touch) setDragging(target(p))
      }
      const z = o.current.viewRef.current.z
      p.x = p.ox + dx / z
      p.y = p.oy + dy / z
      o.current.onMove(target(p), p.x, p.y)
    },
    [cancel],
  )

  // Release and cancel on window, capture phase: this runs before the board's
  // React handlers, so the viewport has not dropped the pointer from its count.
  useEffect(() => {
    const onUp = (e: PointerEvent) => {
      const p = press.current
      if (!p || e.pointerId !== p.pointerId) return
      const g = o.current.gestureRef.current
      if (g && (g.touchCount > 1 || g.pinches !== p.pinchesAtDown)) p.sawPinch = true
      const outcome = pressOutcome(p)
      clear(p)
      if (outcome === 'drop') {
        swallowClickUntil.current = performance.now() + CLICK_SWALLOW_MS
        o.current.onDrop(target(p), p.x, p.y)
      } else if (outcome === 'tap' && !g?.stoppedMotion) o.current.onTap(target(p))
    }
    const onCancel = (e: PointerEvent) => {
      const p = press.current
      if (p && e.pointerId === p.pointerId) cancel(p)
    }
    // The click a drop leaves behind (a button grip gets one) is no click.
    const onClick = (e: Event) => {
      if (performance.now() >= swallowClickUntil.current) return
      swallowClickUntil.current = 0
      e.stopPropagation()
      e.preventDefault()
    }
    window.addEventListener('pointerup', onUp, true)
    window.addEventListener('pointercancel', onCancel, true)
    window.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('pointerup', onUp, true)
      window.removeEventListener('pointercancel', onCancel, true)
      window.removeEventListener('click', onClick, true)
    }
  }, [clear, cancel])

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

  // No long press menu or callout on cards and pack titles.
  const onContextMenu = useCallback((e: ReactMouseEvent<HTMLElement>) => {
    if ((e.target as Element).closest(GRIP)) e.preventDefault()
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
    dragging,
    bind: { onPointerDown, onPointerMove, onLostPointerCapture, onContextMenu },
  }
}

function target(p: Press): DragTarget {
  return { kind: p.kind, id: p.id }
}
