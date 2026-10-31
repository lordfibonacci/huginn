import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useIsMobile } from '../../shared/hooks/useIsMobile'
import { sheetFraction, snapSheet, type SheetStop } from '../lib/sheet'

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

type Drag = { pointerId: number; startY: number; startOffset: number; max: number; offset: number; lastY: number; lastT: number; v: number }

// The panel frame. From 768 px a fixed layer on the right that slides in;
// below that a bottom sheet with a grab strip and three stops (closed, half,
// full), dragged with pointer events. Esc closes. Rendered outside the board,
// so pointer events here never reach the viewport or the card drag; the
// data-panel mark is kept for Board's click guard anyway.
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
  const [stop, setStop] = useState<SheetStop>('half')
  useEffect(() => {
    if (open) setStop('half')
  }, [open])
  const drag = useRef<Drag | null>(null)
  const [dragging, setDragging] = useState(false)

  // Full sheet height in px, from the CSS token so the two never disagree.
  const sheetMax = useCallback(() => {
    const el = ref.current
    if (!el) return 0
    const top = parseFloat(getComputedStyle(el).getPropertyValue('--hg-sheet-top')) || 0
    return Math.max(0, window.innerHeight - top)
  }, [])

  // A drag writes the height straight to the element. Clearing it hands the
  // height back to the stop in CSS, which the transition then animates to.
  useLayoutEffect(() => {
    if (!dragging && ref.current) ref.current.style.height = ''
  }, [dragging, stop, open, narrow])

  const onHandleDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!narrow || !open || (e.pointerType === 'mouse' && e.button !== 0)) return
      e.currentTarget.setPointerCapture(e.pointerId)
      const max = sheetMax()
      const offset = sheetFraction(stop) * max
      drag.current = { pointerId: e.pointerId, startY: e.clientY, startOffset: offset, max, offset, lastY: e.clientY, lastT: e.timeStamp, v: 0 }
      setDragging(true)
    },
    [narrow, open, stop, sheetMax],
  )

  const onHandleMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    d.offset = Math.min(d.max, Math.max(0, d.startOffset + e.clientY - d.startY))
    const dt = e.timeStamp - d.lastT
    if (dt > 0) d.v = (e.clientY - d.lastY) / dt
    d.lastY = e.clientY
    d.lastT = e.timeStamp
    if (ref.current) ref.current.style.height = `${d.max - d.offset}px`
  }, [])

  const onHandleUp = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const d = drag.current
      if (!d || d.pointerId !== e.pointerId) return
      drag.current = null
      setDragging(false)
      // A release long after the last move is not a flick.
      const v = e.timeStamp - d.lastT > 120 ? 0 : d.v
      let next: SheetStop
      if (Math.abs(e.clientY - d.startY) < TAP_SLOP_PX) next = stop === 'full' ? 'half' : 'full'
      else next = snapSheet(d.offset, d.max, v)
      if (next === 'closed') onClose()
      else setStop(next)
    },
    [stop, onClose],
  )

  const onHandleCancel = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== e.pointerId) return
    drag.current = null
    setDragging(false)
  }, [])

  const cls = [
    'hg-panel',
    narrow ? 'hg-panel-sheet' : 'hg-panel-side',
    open ? 'hg-panel-open' : '',
    dragging ? 'hg-panel-dragging' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const style = narrow ? ({ '--hg-sheet-open': open ? 1 - sheetFraction(stop) : 0 } as CSSProperties) : undefined

  return (
    <aside ref={ref} className={cls} style={style} data-panel="" aria-label={label} aria-hidden={!open || undefined} inert={!open}>
      {narrow && (
        <div
          className="hg-sheet-handle"
          role="separator"
          aria-label={t('vinnubord.panel.sheetHandle')}
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleCancel}
        >
          <i aria-hidden="true" />
        </div>
      )}
      {content}
    </aside>
  )
}
