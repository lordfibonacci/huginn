import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDay, formatStamp } from '../../../shared/lib/dateUtils'
import { chatRows } from '../../lib/chat'
import type { Comment, Participant } from '../../lib/types'

type Props = {
  itemId: string
  comments: Comment[]
  participants: Participant[]
  viewerId: string
  fresh: (at: string | null, by: string | null) => boolean
  active: boolean
  bodyRef: RefObject<HTMLDivElement | null>
}

// How close to the bottom the body must be for a new message to keep it there.
const NEAR_BOTTOM = 40

// Plain text with http and https addresses as links. Nothing else is read as
// markup, React escapes the rest.
function linkify(body: string): ReactNode[] {
  return body.split(/(https?:\/\/[^\s<>"']+)/g).map((part, i) =>
    i % 2 === 1 ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer">
        {part}
      </a>
    ) : (
      part
    ),
  )
}

// "Spjall": the comments of the item as chat bubbles. It has no scroller of
// its own, it scrolls the shared panel body. A hidden tab has no layout, so
// everything that measures waits for `active`.
export function ChatTab({ itemId, comments, participants, viewerId, fresh, active, bodyRef }: Props) {
  const { t } = useTranslation()
  const rows = useMemo(
    () => chatRows(comments, participants, itemId, viewerId, fresh),
    [comments, participants, itemId, viewerId, fresh],
  )
  const listRef = useRef<HTMLDivElement | null>(null)
  const nearBottomRef = useRef(true)
  const lastRow = rows[rows.length - 1]
  const lastIsMine = lastRow?.type === 'message' && lastRow.who === 'me'

  // Track whether the body sits at the bottom, read on every scroll while the
  // tab is open, so a change can tell where the viewer was before it.
  useEffect(() => {
    const body = bodyRef.current
    if (!active || !body) return
    const onScroll = () => {
      nearBottomRef.current = body.scrollHeight - body.scrollTop - body.clientHeight <= NEAR_BOTTOM
    }
    body.addEventListener('scroll', onScroll, { passive: true })
    return () => body.removeEventListener('scroll', onScroll)
  }, [active, bodyRef])

  // Opening the tab shows the "new" row at the top of the body, or the
  // bottom when there is none. Measured after paint, once the tab is visible.
  useEffect(() => {
    if (!active) return
    const frame = requestAnimationFrame(() => {
      const body = bodyRef.current
      if (!body) return
      const mark = listRef.current?.querySelector<HTMLElement>('.hg-chat-new')
      body.scrollTop = mark ? mark.offsetTop - body.offsetTop : body.scrollHeight
      nearBottomRef.current = body.scrollHeight - body.scrollTop - body.clientHeight <= NEAR_BOTTOM
    })
    return () => cancelAnimationFrame(frame)
    // Only on opening the tab; new rows while it is open follow the rule below.
  }, [active])

  // A message that arrives while the tab is open keeps the body at the bottom
  // when it was there, and leaves it alone when the viewer scrolled up. The
  // viewer's own message always goes to the bottom, so sending shows it.
  useEffect(() => {
    const body = bodyRef.current
    if (!active || !body) return
    if (nearBottomRef.current || lastIsMine) {
      body.scrollTop = body.scrollHeight
      nearBottomRef.current = true
    }
  }, [rows.length])

  if (rows.length === 0) return <p className="hg-chat-empty">{t('vinnubord.chat.empty')}</p>

  return (
    <div ref={listRef} className="hg-chat">
      {rows.map((row) => {
        if (row.type === 'day') {
          return (
            <div key={row.key} className="hg-chat-day">
              {formatDay(row.at)}
            </div>
          )
        }
        if (row.type === 'new') {
          return (
            <div key={row.key} className="hg-chat-new">
              {t('vinnubord.chat.new')}
            </div>
          )
        }
        return (
          <div key={row.key} className={`hg-msg hg-msg-${row.who}`}>
            <div className="hg-msg-body">{linkify(row.body)}</div>
            <div className="hg-msg-who">
              {row.who === 'me' ? t('vinnubord.chat.you') : row.name}, {row.at ? formatStamp(row.at) : ''}
            </div>
          </div>
        )
      })}
    </div>
  )
}
