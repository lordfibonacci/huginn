import { useTranslation } from 'react-i18next'
import { PLAN_STATUS_NAMES } from '../../lib/status'
import type { Plan, Ruling } from '../../lib/types'
import { CopyButton } from '../CopyButton'
import { RulingList } from './RulingList'

type Props = {
  plans: Plan[]
  rulings: Ruling[]
}

// The item's plans in order, the status of each, its repo path to copy and
// its rulings folded away underneath.
export function PlanList({ plans, rulings }: Props) {
  const { t } = useTranslation()
  const sorted = [...plans].sort((a, b) => a.position - b.position)
  return (
    <ul className="hg-pn-list">
      {sorted.map((plan) => {
        const own = rulings.filter((r) => r.plan_id === plan.id)
        return (
          <li key={plan.id} className={`hg-plan hg-plan-${plan.status}`}>
            <div className="hg-plan-row">
              <span className="hg-plan-name">{plan.name}</span>
              <span className="hg-pill">{PLAN_STATUS_NAMES[plan.status]}</span>
            </div>
            {plan.path && (
              <div className="hg-path">
                <code>{plan.path}</code>
                <CopyButton text={plan.path} what={t('vinnubord.panel.copyOf.planPath')} />
              </div>
            )}
            {own.length > 0 && (
              <details className="hg-details">
                <summary>{t('vinnubord.panel.rulings', { count: own.length })}</summary>
                <RulingList rulings={own} />
              </details>
            )}
          </li>
        )
      })}
    </ul>
  )
}
