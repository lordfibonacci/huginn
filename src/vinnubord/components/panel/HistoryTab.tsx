import { useTranslation } from 'react-i18next'
import { formatStamp } from '../../../shared/lib/dateUtils'
import { describeEvent, itemHistory, type HistoryEntry } from '../../lib/history'
import type { Comment, Event, Participant } from '../../lib/types'

type Props = {
  itemId: string
  events: Event[]
  comments: Comment[]
  participants: Participant[]
}

// "Saga": events and comments of the item together, oldest first, each with
// the actor's short name.
export function HistoryTab({ itemId, events, comments, participants }: Props) {
  const { t } = useTranslation()
  const entries = itemHistory(events, comments, itemId)
  if (entries.length === 0) return <p className="hg-pn-muted">{t('vinnubord.panel.history.empty')}</p>
  const who = (id: string | null) => participants.find((p) => p.user_id === id) ?? null
  const nameOf = (id: string | null) => who(id)?.display_name ?? '?'

  return (
    <ol className="hg-history">
      {entries.map((entry) => {
        const actor = who(entry.actor)
        return (
          <li key={`${entry.type}:${entry.id}`} className={`hg-hist hg-hist-${entry.type}`}>
            <span className="hg-av" title={actor?.display_name}>
              {actor?.short ?? '?'}
            </span>
            <div className="hg-hist-main">
              <p className="hg-hist-line">
                <b>{actor?.display_name ?? t('vinnubord.history.someone')}</b> {lineOf(entry, nameOf, t)}
                {entry.at && <span className="hg-hist-when"> {formatStamp(entry.at)}</span>}
              </p>
              {entry.type === 'comment' && <p className="hg-hist-comment">{entry.comment.body}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

type T = (key: string, params?: Record<string, unknown>) => string

function lineOf(entry: HistoryEntry, nameOf: (id: string | null) => string, t: T): string {
  if (entry.type === 'comment') return t('vinnubord.history.commentAdded')
  const line = describeEvent(entry.event, nameOf)
  if (line.key === 'itemUpdated') {
    const fields = line.fields.map((f) => t(`vinnubord.history.fields.${f}`, { defaultValue: f })).join(', ')
    return t('vinnubord.history.itemUpdated', { fields })
  }
  return t(`vinnubord.history.${line.key}`, line.params)
}
