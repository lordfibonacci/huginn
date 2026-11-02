import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { moduleAccent, moduleOpenCount, moduleTone } from '../lib/layout'
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
}: Props) {
  const { t } = useTranslation()
  const { id } = pkg
  const ref = useCallback((el: HTMLElement | null) => setEl(id, el), [id, setEl])
  // The title is the grip: a drag (useCardDrag on the world layer) moves the
  // column with its modules, a plain click or tap still fits it.
  return (
    <section
      ref={ref}
      className={`hg-pack${lifted ? ' hg-pack-lift' : ''}${chosen ? ' hg-pack-sel' : ''}`}
      data-pack={id}
      style={{ left: pos.x, top: pos.y }}
    >
      <button
        type="button"
        className="hg-pack-title"
        data-grip="pack"
        aria-label={t('vinnubord.board.fitPack', { name: pkg.name })}
        onClick={() => onFitPack(id)}
      >
        {pkg.name}
      </button>
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
    </section>
  )
}
