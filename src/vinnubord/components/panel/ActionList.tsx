import { useTranslation } from 'react-i18next'
import { useOptimisticToggle } from '../../hooks/useOptimisticToggle'
import { markActionDone } from '../../lib/api'
import type { Action, Participant } from '../../lib/types'
import { CopyButton } from '../CopyButton'

type Props = {
  actions: Action[]
  participants: Participant[]
}

// Actions on an item: open ones first, each with a check box, its owner and
// its payload (an SQL block, a path) in a copyable block.
export function ActionList({ actions, participants }: Props) {
  const sorted = [...actions.filter((a) => a.done_at === null), ...actions.filter((a) => a.done_at !== null)]
  return (
    <ul className="hg-pn-list">
      {sorted.map((a) => (
        <ActionRow key={a.id} action={a} owner={participants.find((p) => p.user_id === a.owner) ?? null} />
      ))}
    </ul>
  )
}

function ActionRow({ action, owner }: { action: Action; owner: Participant | null }) {
  const { t } = useTranslation()
  const { checked: done, busy, error, toggle } = useOptimisticToggle(action.done_at !== null, (next) =>
    markActionDone(action.id, next),
  )
  return (
    <li className={`hg-act${done ? ' hg-act-done' : ''}`}>
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
