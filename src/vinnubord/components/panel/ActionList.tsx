import { useTranslation } from 'react-i18next'
import { formatStamp } from '../../../shared/lib/dateUtils'
import { useOptimisticToggle } from '../../hooks/useOptimisticToggle'
import { markActionDone } from '../../lib/api'
import { isActionFresh } from '../../lib/reads'
import type { Action, Participant } from '../../lib/types'
import { CopyButton } from '../CopyButton'

type Props = {
  actions: Action[]
  participants: Participant[]
  fresh: (createdAt: string | null, author: string | null) => boolean
}

// Actions on an item: open ones, then done and cancelled ones folded away, each with a check box
// (a cancel mark instead for a cancelled one), its owner, when it was added, who changed it last
// and its payload (an SQL block, a path) in a copyable block. Open actions someone else added or
// changed since the viewer last opened the item are marked new.
export function ActionList({ actions, participants, fresh }: Props) {
  const { t } = useTranslation()
  const open = actions.filter((a) => a.done_at === null)
  const done = actions.filter((a) => a.done_at !== null)
  const byId = (id: string | null) => participants.find((p) => p.user_id === id) ?? null
  const row = (a: Action) => (
    <ActionRow
      key={a.id}
      action={a}
      owner={byId(a.owner)}
      editor={byId(a.updated_by)}
      isNew={a.done_at === null && isActionFresh(a, fresh)}
    />
  )
  return (
    <>
      {open.length > 0 && <ul className="hg-pn-list">{open.map(row)}</ul>}
      {done.length > 0 && (
        <details className="hg-details">
          <summary>{t('vinnubord.panel.actionsDone', { count: done.length })}</summary>
          <ul className="hg-pn-list">{done.map(row)}</ul>
        </details>
      )}
    </>
  )
}

type RowProps = { action: Action; owner: Participant | null; editor: Participant | null; isNew: boolean }

function ActionRow({ action, owner, editor, isNew }: RowProps) {
  const { t } = useTranslation()
  const { checked: done, busy, error, toggle } = useOptimisticToggle(action.done_at !== null, (next) =>
    markActionDone(action.id, next),
  )
  const cancelled = action.cancelled
  const state = cancelled ? ' hg-act-cancelled' : done ? ' hg-act-done' : ''
  const reason = action.cancel_reason?.trim() ?? ''
  return (
    <li className={`hg-act${state}${isNew ? ' hg-fresh' : ''}`}>
      <label className="hg-check">
        {cancelled ? (
          <span className="hg-act-cancel-mark">{t('vinnubord.panel.actionCancelled')}</span>
        ) : (
          <input
            type="checkbox"
            checked={done}
            disabled={busy}
            onChange={() => void toggle()}
            aria-label={t('vinnubord.panel.actionDone', { body: action.body })}
          />
        )}
        <span className="hg-av" title={owner?.display_name}>
          {owner?.short ?? '?'}
        </span>
        <span className="hg-act-body">{action.body}</span>
        <span className="hg-act-when">
          {isNew && <span className="hg-fresh-mark">{t('vinnubord.panel.fresh')} · </span>}
          {action.created_at ? formatStamp(action.created_at) : ''}
        </span>
      </label>
      {action.updated_at && (
        <p className="hg-act-edited">
          {t('vinnubord.panel.actionEdited', { when: formatStamp(action.updated_at), name: editor?.short ?? '?' })}
        </p>
      )}
      {cancelled && reason !== '' && (
        <p className="hg-act-edited">{t('vinnubord.panel.actionCancelReason', { reason })}</p>
      )}
      {action.payload && (
        <div className="hg-code">
          <pre>{action.payload}</pre>
          <CopyButton text={action.payload} what={t('vinnubord.panel.copyOf.payload')} />
        </div>
      )}
      {error && (
        <p className="hg-pn-error" role="alert">
          {error}
        </p>
      )}
    </li>
  )
}
