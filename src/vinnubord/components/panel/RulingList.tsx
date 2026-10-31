import { useTranslation } from 'react-i18next'
import { useOptimisticToggle } from '../../hooks/useOptimisticToggle'
import { setRulingReversed } from '../../lib/api'
import type { Ruling } from '../../lib/types'

// Rulings on one plan, each with what it costs if wrong and a "snúa við"
// check that marks it for reversal.
export function RulingList({ rulings }: { rulings: Ruling[] }) {
  return (
    <ul className="hg-pn-list">
      {rulings.map((r) => (
        <RulingRow key={r.id} ruling={r} />
      ))}
    </ul>
  )
}

function RulingRow({ ruling }: { ruling: Ruling }) {
  const { t } = useTranslation()
  const { checked, busy, error, toggle } = useOptimisticToggle(ruling.reversed, (next) => setRulingReversed(ruling.id, next))
  return (
    <li className={`hg-ruling${checked ? ' hg-ruling-reversed' : ''}`}>
      <p className="hg-ruling-body">
        <b>{ruling.code}</b> {ruling.body}
      </p>
      {ruling.cost && <p className="hg-ruling-cost">{t('vinnubord.panel.cost', { cost: ruling.cost })}</p>}
      <label className="hg-check hg-check-small">
        <input
          type="checkbox"
          checked={checked}
          disabled={busy}
          onChange={() => void toggle()}
        />
        <span>{t('vinnubord.panel.reverse')}</span>
      </label>
      {error && (
        <p className="hg-pn-error" role="alert">
          {error}
        </p>
      )}
    </li>
  )
}
