import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAsyncAction } from '../../hooks/useAsyncAction'
import { updateItem } from '../../lib/api'
import { buildContinuationPrompt, resumeCommand } from '../../lib/continuation'
import { statusPatch } from '../../lib/panel'
import { STATUS_NAMES, type Tone } from '../../lib/status'
import type { BoardData, Item, ItemStatus, Module } from '../../lib/types'
import { CopyButton, useCopy } from '../CopyButton'
import { Markdown } from '../Markdown'
import { ActionList } from './ActionList'
import { PlanList } from './PlanList'

type Props = {
  data: BoardData
  item: Item
  module: Module | null
  tone: Tone
  label: string
  fresh: (createdAt: string | null, author: string | null) => boolean
  freshActions: number
}

const STATUSES = Object.keys(STATUS_NAMES) as ItemStatus[]

// "Staða": where we are, actions, the next step with its prompt, "Halda áfram",
// plans with rulings, the description, the status control and the source.
export function StatusTab({ data, item, module, tone, label, fresh, freshActions }: Props) {
  const { t } = useTranslation()
  const plans = data.plans.filter((p) => p.item_id === item.id)
  const planIds = new Set(plans.map((p) => p.id))
  const rulings = data.rulings.filter((r) => planIds.has(r.plan_id))
  const actions = data.actions.filter((a) => a.item_id === item.id)

  return (
    <>
      <section className="hg-pn-sec hg-where">
        <h3>{t('vinnubord.panel.whereAreWe')}</h3>
        {item.summary ? <p className="hg-where-text">{item.summary}</p> : <p className="hg-pn-muted">{t('vinnubord.panel.noSummary')}</p>}
        <div className={`hg-pn-st hg-tone-${tone}`}>
          <i aria-hidden="true" />
          {label}
        </div>
        <p className="hg-pn-meta">
          {t('vinnubord.panel.module')}: {module ? module.name : t('vinnubord.panel.noModule')}
        </p>
      </section>

      {actions.length > 0 && (
        <section className="hg-pn-sec">
          <h3>
            {freshActions > 0
              ? t('vinnubord.panel.actionsWithNew', { count: freshActions })
              : t('vinnubord.panel.actions')}
          </h3>
          <ActionList actions={actions} participants={data.participants} fresh={fresh} />
        </section>
      )}

      {(item.next_step || item.next_prompt) && (
        <section className="hg-pn-sec">
          <h3>{t('vinnubord.panel.nextStep')}</h3>
          {item.next_step && (
            <div className="hg-code hg-code-text">
              <pre>{item.next_step}</pre>
              <CopyButton text={item.next_step} what={t('vinnubord.panel.copyOf.nextStep')} />
            </div>
          )}
          {item.next_prompt && (
            <div className="hg-code">
              <pre>{item.next_prompt}</pre>
              <CopyButton text={item.next_prompt} what={t('vinnubord.panel.copyOf.nextPrompt')} />
            </div>
          )}
        </section>
      )}

      <ResumeButton data={data} item={item} />

      {plans.length > 0 && (
        <section className="hg-pn-sec">
          <h3>{t('vinnubord.panel.plans')}</h3>
          <PlanList plans={plans} rulings={rulings} />
        </section>
      )}

      {item.body && (
        <section className="hg-pn-sec">
          <h3>{t('vinnubord.panel.body')}</h3>
          <Markdown source={item.body} />
        </section>
      )}

      <StatusControl key={item.id} data={data} item={item} />

      {item.source_ref && (
        <section className="hg-pn-sec">
          <h3>{t('vinnubord.panel.source')}</h3>
          <div className="hg-path">
            <code>{item.source_ref}</code>
            <CopyButton text={item.source_ref} what={t('vinnubord.panel.copyOf.source')} />
          </div>
        </section>
      )}
    </>
  )
}

// "Halda áfram": copies the continuation prompt exactly as built (ruling R15)
// and says "Afritað" for 1.5 s. Where and how to start the session is shown
// beside it, not copied.
function ResumeButton({ data, item }: { data: BoardData; item: Item }) {
  const { t } = useTranslation()
  const { state, copy } = useCopy()
  const run = resumeCommand(data.project, item, data.plans.filter((p) => p.item_id === item.id))
  return (
    <div className="hg-resume">
      <button type="button" className="hg-btn hg-btn-primary hg-resume-btn" onClick={() => void copy(buildContinuationPrompt(item))}>
        {state === 'ok' ? t('vinnubord.panel.copied') : state === 'fail' ? t('vinnubord.panel.copyFailed') : t('vinnubord.panel.resume')}
      </button>
      <span className="hg-pn-muted">
        {t('vinnubord.panel.resumeHint')}
        <br />
        {t('vinnubord.panel.resumeRunWith')} <code>{run.command}</code>
        {run.folder && (
          <>
            {' '}
            {t('vinnubord.panel.resumeRunIn')} <code>{run.folder}</code>
          </>
        )}
      </span>
      <span className="hg-sr" role="status">
        {state === 'ok' ? t('vinnubord.panel.copied') : ''}
      </span>
    </div>
  )
}

// A deliberate status change (ruling R13): pick a status, for waiting also who
// it waits on, then save. Untouched selects follow the live item.
function StatusControl({ data, item }: { data: BoardData; item: Item }) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<{ status: ItemStatus; waitingOn: string | null } | null>(null)
  const { busy, error, run } = useAsyncAction()
  const status = draft?.status ?? item.status
  const waitingOn = draft ? draft.waitingOn : item.waiting_on
  const patch = statusPatch(status, waitingOn)
  const changed = draft !== null && (status !== item.status || (status === 'waiting' && waitingOn !== item.waiting_on))

  const save = async () => {
    if (!patch || !changed) return
    const ok = await run(() => updateItem(item.id, patch))
    if (ok) setDraft(null)
  }

  return (
    <section className="hg-pn-sec">
      <h3>{t('vinnubord.panel.changeStatus')}</h3>
      <div className="hg-status-ctl">
        <label className="hg-field">
          <span>{t('vinnubord.panel.status')}</span>
          <select value={status} onChange={(e) => setDraft({ status: e.target.value as ItemStatus, waitingOn })}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_NAMES[s]}
              </option>
            ))}
          </select>
        </label>
        {status === 'waiting' && (
          <label className="hg-field">
            <span>{t('vinnubord.panel.waitingOn')}</span>
            <select value={waitingOn ?? ''} onChange={(e) => setDraft({ status, waitingOn: e.target.value || null })}>
              <option value="">{t('vinnubord.panel.choose')}</option>
              {data.participants.map((p) => (
                <option key={p.user_id} value={p.user_id}>
                  {p.display_name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="button" className="hg-btn" disabled={!changed || !patch || busy} onClick={() => void save()}>
          {t('vinnubord.panel.save')}
        </button>
      </div>
      {error && (
        <p className="hg-pn-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
