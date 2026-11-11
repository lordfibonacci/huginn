import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { moduleAccent, moduleOpenCount, moduleTone } from '../lib/layout'
import { foldLine } from '../lib/packs'
import type { Item, Module, Package, Participant } from '../lib/types'
import { ModuleCard } from './ModuleCard'

type Props = {
  pkg: Package
  // Where the column rests: the package position, or the drop still on its
  // way to the database. Board writes left and top directly while it drags.
  pos: { x: number; y: number }
  lifted: boolean
  // Part of the Ctrl marquee selection (moves with the group).
  chosen: boolean
  setEl: (id: string, el: HTMLElement | null) => void
  modules: Module[]
  items: Item[]
  viewerId: string
  participants: Participant[]
  hotModuleIds?: Set<string>
  // Modules faded by an active filter because none of their items match.
  dimModuleIds?: Set<string>
  onOpenModule: (moduleId: string) => void
  // The title glides the board to this column, fitted in width.
  onFitPack: (packageId: string) => void
  // Folded in this browser: the modules and the rail give way to one line.
  folded: boolean
  // The drawn cards of this column's modules, counted on the fold line.
  cardCount: number
  onToggleFold: (packageId: string) => void
}

export function PackColumn({
  pkg,
  pos,
  lifted,
  chosen,
  setEl,
  modules,
  items,
  viewerId,
  participants,
  hotModuleIds,
  dimModuleIds,
  onOpenModule,
  onFitPack,
  folded,
  cardCount,
  onToggleFold,
}: Props) {
  const { t } = useTranslation()
  const { id } = pkg
  const ref = useCallback((el: HTMLElement | null) => setEl(id, el), [id, setEl])
  // The title is the grip: a drag (useCardDrag on the world layer) moves the
  // column with its modules, a plain click or tap still fits it. The fold
  // toggle beside it is a plain button: the viewport ignores it with a mouse
  // and pans past it on touch, and useCardDrag never sees it (no data-grip).
  return (
    <section
      ref={ref}
      className={`hg-pack${lifted ? ' hg-pack-lift' : ''}${chosen ? ' hg-pack-sel' : ''}${folded ? ' hg-pack-folded' : ''}`}
      data-pack={id}
      style={{ left: pos.x, top: pos.y }}
    >
      <div className="hg-pack-head">
        <button
          type="button"
          className="hg-pack-title"
          data-grip="pack"
          aria-label={t('vinnubord.board.fitPack', { name: pkg.name })}
          onClick={() => onFitPack(id)}
        >
          <span className="hg-pack-title-text">{pkg.name}</span>
        </button>
        <button
          type="button"
          className="hg-pack-fold"
          aria-expanded={!folded}
          aria-label={folded ? t('vinnubord.board.unfoldPack', { name: pkg.name }) : t('vinnubord.board.foldPack', { name: pkg.name })}
          onClick={() => onToggleFold(id)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            {folded ? <path d="M4 10l4-4 4 4" /> : <path d="M4 6l4 4 4-4" />}
          </svg>
        </button>
      </div>
      {folded ? (
        <p className="hg-pack-fold-line">{foldLine(modules.length, cardCount)}</p>
      ) : (
        <>
          <div className="hg-pack-rail" aria-hidden="true" />
          {modules.map((m) => (
            <ModuleCard
              key={m.id}
              module={m}
              openCount={moduleOpenCount(m.id, items)}
              tone={moduleTone(m, items, viewerId, participants)}
              accent={moduleAccent(m)}
              hot={hotModuleIds?.has(m.id) ?? false}
              ghost={m.is_ghost}
              dim={dimModuleIds?.has(m.id) ?? false}
              onClick={() => onOpenModule(m.id)}
            />
          ))}
        </>
      )}
    </section>
  )
}
