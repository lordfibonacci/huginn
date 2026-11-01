import { useTranslation } from 'react-i18next'
import { formatStamp } from '../../../shared/lib/dateUtils'
import { useOptimisticToggle } from '../../hooks/useOptimisticToggle'
import { markActionDone } from '../../lib/api'
import type { Action, Participant } from '../../lib/types'
import { CopyButton } from '../CopyButton'

type Props = {
  actions: Action[]
  participants: Participant[]
  fresh: (createdAt: string | null, author: string | null) => boolean
}

// Actions on an item: open ones, then done ones folded away, each with a check box, its owner,
// when it was added and its payload (an SQL block, a path) in a copyable block. Open actions
// someone else added since the viewer last opened the item are marked new.
export function ActionList({ actions, participants, fresh }: Props) {
  const { t } = useTranslation()
  const open = actions.filter((a) => a.done_at === null)
  const done = actions.filter((a) => a.done_at !== null)
  const row = (a: Action) => (
    <ActionRow
      key={a.id}
      action={a}
      owner={participants.find((p) => p.user_id === a.owner) ?? null}
      isNew={a.done_at === null && fresh(a.created_at, a.created_by)}
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

function ActionRow({ action, owner, isNew }: { action: Action; owner: Participant | null; isNew: boolean }) {
  const { t } = useTranslation()
  const { checked: done, busy, error, toggle } = useOptimisticToggle(action.done_at !== null, (next) =>
    markActionDone(action.id, next),
  )
  return (
    <li className={`hg-act${done ? ' hg-act-done' : ''}${isNew ? ' hg-fresh' : ''}`}>
      <label className="hg-check">
        <input
          type="checkbox"
          checked={done}
          disabled={busy}
          onChange={() => void toggle()}
          aria-label={t('vinnubord.panel.actionDone', { body: action.body })}
        />
        <span className="hg-av" title={owner?.display_name}>
          {owner?.short ?? '?'}
        </span>
        <span className="hg-act-body">{action.body}</span>
        <span className="hg-act-when">
          {isNew && <span className="hg-fresh-mark">{t('vinnubord.panel.fresh')} · </span>}
          {action.created_at ? formatStamp(action.created_at) : ''}
        </span>
      </label>
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
