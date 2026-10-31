import { memo, useCallback, type CSSProperties, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { formatStamp } from '../../shared/lib/dateUtils'
import { planProgress } from '../lib/layout'
import type { Tone } from '../lib/status'
import type { Item, Plan } from '../lib/types'

type Props = {
  item: Item
  tone: Tone
  label: string
  plans: Plan[]
  actionsOpen: number
  fileCount: number
  // Who changed the item last (updated_by, else created_by).
  mover: { short: string; name: string } | null
  unread: boolean
  parked: boolean
  pulse: boolean
  selected: boolean
  lifted: boolean
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
  plans,
  actionsOpen,
  fileCount,
  mover,
  unread,
  parked,
  pulse,
  selected,
  lifted,
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

  const progress = planProgress(plans)
  const cls = [
    'hg-card',
    'hg-in',
    `hg-tone-${tone}`,
    parked ? 'hg-card-parked' : '',
    pulse ? 'hg-card-pulse' : '',
    selected ? 'hg-card-open' : '',
    lifted ? 'hg-card-lift' : '',
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
    >
      {unread && <span className="hg-card-ring" role="img" aria-label={t('vinnubord.card.unread')} />}
      <div className="hg-card-st">
        <i className="hg-card-dot" aria-hidden="true" />
        {label}
      </div>
      <h3 className="hg-card-title">{item.title}</h3>
      {mover && (
        <div className="hg-card-by" title={t('vinnubord.card.movedBy', { name: mover.name })}>
          <span className="hg-av" aria-hidden="true">
            {mover.short}
          </span>
          {formatStamp(item.updated_at)}
        </div>
      )}
      {(item.tags.length > 0 || fileCount > 0 || actionsOpen > 0) && (
        <div className="hg-card-chips">
          {fileCount > 0 && <span>{t('vinnubord.card.files', { count: fileCount })}</span>}
          {actionsOpen > 0 && <span>{t('vinnubord.card.actions', { count: actionsOpen })}</span>}
          {item.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
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
    </div>
  )
})
