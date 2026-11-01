import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useIsMobile } from '../../shared/hooks/useIsMobile'
import { OPEN_STOP, sheetFraction, snapSheet, type SheetStop } from '../lib/sheet'

type Props = {
  open: boolean
  onClose: () => void
  // Accessible name of the panel.
  label: string
  children: ReactNode
}

// How long closed content stays mounted so it can slide out. Matches
// --hg-dur-panel; with reduced motion the slide is instant anyway.
const EXIT_MS = 450
const TAP_SLOP_PX = 6
// A release this long after the last move is not a flick.
const FLICK_WINDOW_MS = 120

// A pointer drag from the handle or the head. moved turns true once the
// pointer passes TAP_SLOP_PX; before that a release on the handle is a tap.
type Drag = {
  pointerId: number
  handle: boolean
  moved: boolean
  startY: number
  startOffset: number
  max: number
  offset: number
  lastY: number
  lastT: number
  v: number
}

// A touch in the body. It stays undecided until it passes TAP_SLOP_PX, then
// either moves the sheet (it started with the body at the top and goes down)
// or is left to the browser as a scroll.
type BodyTouch = {
  y0: number
  x0: number
  atTop: boolean
  mode: 'undecided' | 'sheet' | 'scroll'
  startOffset: number
  max: number
  offset: number
  lastY: number
  lastT: number
  v: number
}

// Full sheet height in px, from the CSS token on :root so the two never
// disagree. Works before the panel has mounted.
function sheetMax(): number {
  const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hg-sheet-top')) || 0
  return Math.max(0, window.innerHeight - top)
}

// The panel frame. From 768 px a fixed layer on the right that slides in;
// below that a bottom sheet at full height with three stops (closed, half,
// full), pushed down by a transform. It is dragged from the grab strip and
// the head with pointer events, and from the body by touch when the body is
// scrolled to the top. Esc closes. Rendered outside the board, so pointer
// events here never reach the viewport or the card drag; the data-panel mark
// is kept for Board's click guard anyway.
export function PanelShell({ open, onClose, label, children }: Props) {
  const { t } = useTranslation()
  const narrow = useIsMobile()
  const ref = useRef<HTMLElement | null>(null)

  // Keep the last content while the panel slides out, then unmount it so a
  // later open starts fresh.
  const last = useRef<ReactNode>(null)
  if (open) last.current = children
  const [linger, setLinger] = useState(open)
  useEffect(() => {
    if (open) {
      setLinger(true)
      return
    }
    const timer = setTimeout(() => setLinger(false), EXIT_MS)
    return () => clearTimeout(timer)
  }, [open])
  const content = open ? children : linger ? last.current : null

  // Esc closes. Inside a text field it only leaves the field, so a half
  // written answer or comment is not thrown away by a stray key.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const target = e.target as HTMLElement | null
      if (target?.closest?.('input, textarea, select')) {
        target.blur()
        return
      }
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // ---------- bottom sheet ----------
  const [stop, setStop] = useState<SheetStop>(OPEN_STOP)
  useEffect(() => {
    if (open) setStop(OPEN_STOP)
  }, [open])
  const drag = useRef<Drag | null>(null)
  const [dragging, setDragging] = useState(false)

  // The body touch listener lives in an effect, so it reads the stop and the
  // close callback through refs instead of being added again on every change.
  const stopRef = useRef(stop)
  stopRef.current = stop
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // A resize (rotation, the address bar, the keyboard) renders again, so the
  // offset is worked out from the new height and the sheet keeps its stop.
  const [, setResizeTick] = useState(0)
  useEffect(() => {
    if (!narrow) return
    const onResize = () => setResizeTick((n) => n + 1)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [narrow])

  // A drag writes the transform straight to the element. Clearing it hands
  // the position back to the stop in CSS, which the transition animates to.
  useLayoutEffect(() => {
    if (!dragging && ref.current) ref.current.style.transform = ''
  }, [dragging, stop, open, narrow])

  const settle = useCallback((offset: number, max: number, v: number) => {
    const next = snapSheet(offset, max, v)
    if (next === 'closed') onCloseRef.current()
    else setStop(next)
  }, [])

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      if (!narrow || !open || (e.pointerType === 'mouse' && e.button !== 0)) return
      const zone = (e.target as Element).closest?.('.hg-sheet-handle, .hg-pn-head')
      if (!zone) return
      const max = sheetMax()
      const offset = sheetFraction(stop) * max
      drag.current = {
        pointerId: e.pointerId,
        handle: zone.classList.contains('hg-sheet-handle'),
        moved: false,
        startY: e.clientY,
        startOffset: offset,
        max,
        offset,
        lastY: e.clientY,
        lastT: e.timeStamp,
        v: 0,
      }
    },
    [narrow, open, stop],
  )

  const onPointerMove = useCallback((e: PointerEvent<HTMLElement>) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    if (!d.moved) {
      if (Math.abs(e.clientY - d.startY) < TAP_SLOP_PX) return
      d.moved = true
      ref.current?.setPointerCapture(e.pointerId)
      // A mouse drag over the title would otherwise select text.
      window.getSelection()?.removeAllRanges()
      setDragging(true)
    }
    d.offset = Math.min(d.max, Math.max(0, d.startOffset + e.clientY - d.startY))
    const dt = e.timeStamp - d.lastT
    if (dt > 0) d.v = (e.clientY - d.lastY) / dt
    d.lastY = e.clientY
    d.lastT = e.timeStamp
    if (ref.current) ref.current.style.transform = `translateY(${d.offset}px)`
  }, [])

  const onPointerUp = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      const d = drag.current
      if (!d || d.pointerId !== e.pointerId) return
      drag.current = null
      if (!d.moved) {
        // A tap on the handle swaps full and half; a tap on the head does nothing.
        if (d.handle) setStop(stop === 'full' ? 'half' : 'full')
        return
      }
      setDragging(false)
      settle(d.offset, d.max, e.timeStamp - d.lastT > FLICK_WINDOW_MS ? 0 : d.v)
    },
    [stop, settle],
  )

  const onPointerCancel = useCallback((e: PointerEvent<HTMLElement>) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    drag.current = null
    if (d.moved) setDragging(false)
  }, [])

  // Body touch takeover. A touch that starts in the body while it is scrolled
  // to the top and first moves down moves the sheet; any other touch scrolls
  // the body and is left alone. Touches in the handle, the head or a field
  // are not ours.
  useEffect(() => {
    const el = ref.current
    if (!narrow || !open || !el) return
    let touch: BodyTouch | null = null

    const cancel = () => {
      if (touch?.mode === 'sheet') setDragging(false)
      touch = null
    }
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        cancel()
        return
      }
      touch = null
      const target = e.target as Element | null
      if (!target?.closest || target.closest('.hg-sheet-handle, .hg-pn-head, input, textarea, select')) return
      const body = target.closest('.hg-pn-body')
      if (!body) return
      const p = e.touches[0]
      const max = sheetMax()
      const offset = sheetFraction(stopRef.current) * max
      touch = {
        y0: p.clientY,
        x0: p.clientX,
        atTop: body.scrollTop <= 0,
        mode: 'undecided',
        startOffset: offset,
        max,
        offset,
        lastY: p.clientY,
        lastT: e.timeStamp,
        v: 0,
      }
    }
    const onMove = (e: TouchEvent) => {
      const s = touch
      if (!s || s.mode === 'scroll') return
      const p = e.touches[0]
      if (!p) return
      const dy = p.clientY - s.y0
      const dx = p.clientX - s.x0
      if (s.mode === 'undecided') {
        // Down from the top cannot scroll the body anyway, so it is held back
        // from the browser until the touch is decided.
        const downFromTop = s.atTop && dy > 0 && Math.abs(dy) > Math.abs(dx)
        if (Math.hypot(dx, dy) < TAP_SLOP_PX) {
          if (downFromTop && e.cancelable) e.preventDefault()
          return
        }
        if (!downFromTop) {
          s.mode = 'scroll'
          return
        }
        s.mode = 'sheet'
        setDragging(true)
      }
      if (e.cancelable) e.preventDefault()
      s.offset = Math.min(s.max, Math.max(0, s.startOffset + dy - TAP_SLOP_PX))
      const dt = e.timeStamp - s.lastT
      if (dt > 0) s.v = (p.clientY - s.lastY) / dt
      s.lastY = p.clientY
      s.lastT = e.timeStamp
      el.style.transform = `translateY(${s.offset}px)`
    }
    const onEnd = (e: TouchEvent) => {
      const s = touch
      touch = null
      if (s?.mode !== 'sheet') return
      setDragging(false)
      settle(s.offset, s.max, e.timeStamp - s.lastT > FLICK_WINDOW_MS ? 0 : s.v)
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', cancel)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', cancel)
      if (touch?.mode === 'sheet') setDragging(false)
    }
  }, [narrow, open, settle])

  const cls = [
    'hg-panel',
    narrow ? 'hg-panel-sheet' : 'hg-panel-side',
    open ? 'hg-panel-open' : '',
    dragging ? 'hg-panel-dragging' : '',
  ]
    .filter(Boolean)
    .join(' ')
  let style: CSSProperties | undefined
  if (narrow) {
    const max = sheetMax()
    style = { '--hg-sheet-offset': open ? sheetFraction(stop) * max : max } as CSSProperties
  }

  return (
    <aside
      ref={ref}
      className={cls}
      style={style}
      data-panel=""
      aria-label={label}
      aria-hidden={!open || undefined}
      inert={!open}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {narrow && (
        <div className="hg-sheet-handle" role="separator" aria-label={t('vinnubord.panel.sheetHandle')}>
          <i aria-hidden="true" />
        </div>
      )}
      {content}
    </aside>
  )
}
