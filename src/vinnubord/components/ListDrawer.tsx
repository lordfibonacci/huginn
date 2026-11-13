import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { formatStampShort } from '../../shared/lib/dateUtils'
import { moduleAccent } from '../lib/layout'
import { SORTS, type ListRow, type Sort } from '../lib/list'
import { isTone } from '../lib/status'

type Props = {
  rows: ListRow[]
  count: number
  sort: Sort
  selectedId: string | null
  mineByItem: Map<string, number>
  filterActive: boolean
  onSort: (s: Sort) => void
  onPick: (itemId: string) => void
  onPeek: (itemId: string | null) => void
  onClear: () => void
  onClose: () => void
}

// The item list beside the board. Pure presentation over the rows.
export function ListDrawer({
  rows, count, sort, selectedId, mineByItem, filterActive, onSort, onPick, onPeek, onClear, onClose,
}: Props) {
  const { t } = useTranslation()

  const renderRow = (row: ListRow) => {
    if (row.kind === 'pack') {
      return <div key={`p:${row.id}`} className="hg-list-pack">{row.name}</div>
    }
    if (row.kind === 'module') {
      const accent = row.color ? moduleAccent({ color: row.color }) : null
      const tone = row.color && isTone(row.color) ? row.color : 'stone'
      return (
        <div
          key={`m:${row.id ?? 'none'}`}
          className={`hg-list-module${accent ? '' : ` hg-tone-${tone}`}`}
          style={accent ? ({ '--hg-c': accent } as CSSProperties) : undefined}
        >
          <i aria-hidden="true" />
          {row.name ?? t('vinnubord.list.noModule')}
          <b>{row.count}</b>
        </div>
      )
    }
    if (row.kind === 'bucket') {
      return (
        <div key={`b:${row.id}`} className="hg-list-bucket">
          {t(`vinnubord.board.counts.${row.id}`)}
          <b>{row.count}</b>
        </div>
      )
    }
    const { card, moduleName } = row
    const mine = mineByItem.get(card.item.id) ?? 0
    const selected = card.item.id === selectedId
    return (
      <button
        key={card.item.id}
        type="button"
        className={`hg-list-row hg-tone-${card.tone}${selected ? ' hg-list-row-open' : ''}`}
        aria-current={selected ? 'true' : undefined}
        onClick={() => onPick(card.item.id)}
        onMouseEnter={() => onPeek(card.item.id)}
        onFocus={() => onPeek(card.item.id)}
      >
        <i className={`hg-list-dot${card.fresh ? ' hg-list-dot-unread' : ''}`} aria-hidden="true" />
        <span className="hg-list-main">
          <span className="hg-list-row-title">{card.item.title}</span>
          <span className="hg-list-meta">
            {card.waitingOn && <span className="hg-av" aria-hidden="true">{card.waitingOn.short}</span>}
            <span>{card.label}</span>
            {mine > 0 && <span className="hg-chip-mine hg-tone-coral">{t('vinnubord.card.actionsMine', { count: mine })}</span>}
            {moduleName && <span>{moduleName}</span>}
          </span>
        </span>
        <span className="hg-list-when">{formatStampShort(card.item.updated_at)}</span>
      </button>
    )
  }

  return (
    <aside className="hg-list" role="region" aria-label={t('vinnubord.list.title')} data-no-pan>
      <div className="hg-list-head">
        <h2 className="hg-list-title">
          {t('vinnubord.list.title')}
          <span className="hg-list-count">{t('vinnubord.list.count', { count })}</span>
        </h2>
        <label className="hg-list-sort">
          <span className="hg-sr">{t('vinnubord.list.sort')}</span>
          <select value={sort} onChange={(e) => onSort(e.target.value as Sort)}>
            {SORTS.map((s) => <option key={s} value={s}>{t(`vinnubord.list.sorts.${s}`)}</option>)}
          </select>
        </label>
        <button type="button" className="hg-list-close" aria-label={t('common.close')} onClick={onClose}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>
      </div>
      <div
        className="hg-list-body"
        onMouseLeave={() => onPeek(null)}
        onBlur={(e) => {
          // Focus left the list body (not just moved to another row): put the card out.
          const next = e.relatedTarget
          if (!(next instanceof Node) || !e.currentTarget.contains(next)) onPeek(null)
        }}
      >
        {rows.length === 0 ? (
          <p className="hg-list-empty">
            <span>{t('vinnubord.list.empty')}</span>
            {filterActive && <button type="button" className="hg-clear" onClick={onClear}>{t('vinnubord.top.clear')}</button>}
          </p>
        ) : rows.map(renderRow)}
      </div>
    </aside>
  )
}
