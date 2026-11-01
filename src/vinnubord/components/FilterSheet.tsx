import { useEffect, useId, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { FilterApi } from '../hooks/useFilter'
import type { FilterOption } from '../lib/filters'
import { FilterMenu } from './FilterMenu'

type Props = {
  open: boolean
  onClose: () => void
  // Chosen packages and tags, plus one when a view is active: the number on the filter button.
  picks: number
  filter: FilterApi
  tags: FilterOption[]
  packages: FilterOption[]
  // The inline view menu, built by BoardPage from the same props as the top bar's.
  viewMenu: ReactNode
  onClearView: () => void
}

// The filters below 1024 px: Sýn, Pakki and Tögg as chips in one sheet, in
// the same frame as the new item sheet. It stays open while choosing, so
// several can be picked. "Hreinsa" clears what the filter button counts:
// packages, tags and the active view, never the pills or the search.
export function FilterSheet({ open, onClose, picks, filter, tags, packages, viewMenu, onClearView }: Props) {
  if (!open) return null
  return (
    <Sheet
      onClose={onClose}
      picks={picks}
      filter={filter}
      tags={tags}
      packages={packages}
      viewMenu={viewMenu}
      onClearView={onClearView}
    />
  )
}

function Sheet({ onClose, picks, filter, tags, packages, viewMenu, onClearView }: Omit<Props, 'open'>) {
  const { t } = useTranslation()
  const headingId = useId()
  const sheetRef = useRef<HTMLDivElement | null>(null)
  const f = filter.filter

  // Focus moves into the sheet on open, like the new item sheet. The sheet
  // itself takes it, not a chip, so nothing is lit by accident.
  useEffect(() => {
    sheetRef.current?.focus()
  }, [])

  // Esc leaves a field first (the view editor's name), then closes. Caught in
  // the capture phase so the side panel behind the sheet does not close too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      const target = e.target as HTMLElement | null
      if (target?.closest?.('input, textarea, select')) {
        target.blur()
        return
      }
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  function clearAll() {
    filter.clearPicks()
    onClearView()
  }

  return (
    <div className="hg-sheet-wrap" data-panel="">
      <div className="hg-sheet-backdrop" onClick={onClose} />
      <div
        ref={sheetRef}
        className="hg-modal-sheet hg-filter-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
      >
        <div className="hg-new-head hg-filter-head">
          <h2 id={headingId}>{t('vinnubord.filters.heading')}</h2>
          {picks > 0 && (
            <button type="button" className="hg-btn hg-btn-ghost" onClick={clearAll}>
              {t('vinnubord.top.clear')}
            </button>
          )}
        </div>
        <div className="hg-new-body">
          <p className="hg-view-group">{t('vinnubord.views.menu')}</p>
          {viewMenu}
          <p className="hg-view-group">{t('vinnubord.top.package')}</p>
          <FilterMenu
            inline
            label={t('vinnubord.top.package')}
            options={packages}
            selected={f.packages}
            onToggle={filter.togglePackage}
            empty={t('vinnubord.top.noPackages')}
          />
          <p className="hg-view-group">{t('vinnubord.top.tags')}</p>
          <FilterMenu
            inline
            label={t('vinnubord.top.tags')}
            options={tags}
            selected={f.tags}
            onToggle={filter.toggleTag}
            empty={t('vinnubord.top.noTags')}
          />
        </div>
        <div className="hg-new-foot">
          <button type="button" className="hg-btn hg-btn-primary" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
