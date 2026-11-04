import { memo, useCallback, useState, type AnimationEvent, type CSSProperties, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { formatStamp } from '../../shared/lib/dateUtils'
import { planProgress } from '../lib/layout'
import { freshLine, type FreshLine as FreshLineModel } from '../lib/cards'
import type { UnreadSummary } from '../lib/reads'
import type { Tone } from '../lib/status'
import type { Item, Plan } from '../lib/types'

type Props = {
  item: Item
  tone: Tone
  label: string
  // Name of the item's module, shown under the title; null when it has none.
  moduleName: string | null
  plans: Plan[]
  actionsOpen: number
  // open actions owned by the viewer, shown instead of the open count
  actionsMine: number
  fileCount: number
  // Who changed the item last (updated_by, else created_by).
  mover: { short: string; name: string } | null
  // Whether the mover and date row shows (only for recent changes).
  showStamp: boolean
  // What others did since the viewer last opened the card, null when nothing
  fresh: UnreadSummary | null
  // The newest unread comment by someone else, which the fresh line prefers.
  freshComment: { short: string; line: string } | null
  parked: boolean
  // Done or dropped, lingering on the board faded
  closed: boolean
  pulse: boolean
  selected: boolean
  lifted: boolean
  // Part of the Ctrl marquee selection (moves with the group).
  chosen: boolean
  dim: boolean
  // Entry animation delay in ms. Pointer taps come through useCardDrag on the
  // world layer, onTap here serves the keyboard.
  enterDelay: number
  setEl: (id: string, el: HTMLElement | null) => void
  onTap: (id: string) => void
}

// One item on the board. Board writes left and top directly (spring loop), so
// they are deliberately not in the style prop.
export const ItemCard = memo(function ItemCard({
  item,
  tone,
  label,
  moduleName,
  plans,
  actionsOpen,
  actionsMine,
  fileCount,
  mover,
  showStamp,
  fresh,
  freshComment,
  parked,
  closed,
  pulse,
  selected,
  lifted,
  chosen,
  dim,
  enterDelay,
  setEl,
  onTap,
}: Props) {
  const { t } = useTranslation()
  const { id } = item
  const ref = useCallback((el: HTMLDivElement | null) => setEl(id, el), [id, setEl])
  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onTap(id)
      }
    },
    [id, onTap],
  )

  // The entry pop runs once per mount. Dropping its class when it ends means
  // a later DOM move (React reordering the list) cannot replay it.
  const [entered, setEntered] = useState(false)
  const onAnimationEnd = useCallback((e: AnimationEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && e.animationName === 'hg-pop') setEntered(true)
  }, [])

  const progress = planProgress(plans)
  const cls = [
    'hg-card',
    entered ? '' : 'hg-in',
    `hg-tone-${tone}`,
    parked ? 'hg-card-parked' : '',
    closed ? 'hg-card-closed' : '',
    pulse ? 'hg-card-pulse' : '',
    selected ? 'hg-card-open' : '',
    fresh !== null ? 'hg-card-new' : '',
    lifted ? 'hg-card-lift' : '',
    chosen ? 'hg-card-sel' : '',
    dim ? 'hg-card-dim' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const style = { animationDelay: `${enterDelay}ms` } as CSSProperties

  return (
    <div
      ref={ref}
      className={cls}
      style={style}
      data-card={id}
      data-module={item.module_id ?? undefined}
      role="button"
      tabIndex={dim ? -1 : 0}
      aria-pressed={selected}
      aria-hidden={dim || undefined}
      onKeyDown={onKeyDown}
      onAnimationEnd={onAnimationEnd}
    >
      <div className="hg-card-st">
        <i className="hg-card-dot" aria-hidden="true" />
        {label}
      </div>
      <h3 className="hg-card-title">{item.title}</h3>
      {moduleName && <div className="hg-card-module">{moduleName}</div>}
      {mover && showStamp && (
        <div className="hg-card-by" title={t('vinnubord.card.movedBy', { name: mover.name })}>
          <span className="hg-av" aria-hidden="true">
            {mover.short}
          </span>
          {formatStamp(item.updated_at)}
        </div>
      )}
      {(fileCount > 0 || actionsOpen > 0 || actionsMine > 0) && (
        <div className="hg-card-chips">
          {fileCount > 0 && <span>{t('vinnubord.card.files', { count: fileCount })}</span>}
          {actionsMine > 0 ? (
            <span className="hg-chip-mine hg-tone-coral">{t('vinnubord.card.actionsMine', { count: actionsMine })}</span>
          ) : (
            actionsOpen > 0 && <span>{t('vinnubord.card.actions', { count: actionsOpen })}</span>
          )}
        </div>
      )}
      {progress.total > 0 && (
        <>
          <div className="hg-card-plans" aria-hidden="true">
            {progress.bars.map((p, i) => (
              <i key={i} style={{ '--hg-p': p } as CSSProperties} />
            ))}
          </div>
          <small className="hg-card-plan-label">
            {t('vinnubord.card.planOf', { current: progress.current, total: progress.total })}
          </small>
        </>
      )}
      {fresh && <FreshLine line={freshLine(fresh, freshComment)} />}
    </div>
  )
})

// One line: a new item, else the newest comment, else the kinds of change.
function FreshLine({ line }: { line: FreshLineModel }) {
  const { t } = useTranslation()
  if (line.kind === 'created') {
    return (
      <div className="hg-card-fresh">
        <b>{t('vinnubord.card.fresh.created')}</b>
      </div>
    )
  }
  if (line.kind === 'comment') {
    return (
      <div className="hg-card-fresh">
        <b>{line.short}:</b> {line.line}
      </div>
    )
  }
  const text = line.kinds.map(({ kind, n }) => t(`vinnubord.card.fresh.kinds.${kind}`, { count: n })).join(', ')
  const more = line.more > 0 ? ` ${t('vinnubord.card.fresh.more', { count: line.more })}` : ''
  return <div className="hg-card-fresh">{text + more}</div>
}
