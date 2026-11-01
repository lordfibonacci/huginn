import { useTranslation } from 'react-i18next'
import { moduleAccent, moduleOpenCount, moduleTone } from '../lib/layout'
import type { Item, Module, Package, Participant } from '../lib/types'
import { ModuleCard } from './ModuleCard'

type Props = {
  pkg: Package
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

export function PackColumn({ pkg, modules, items, viewerId, participants, hotModuleIds, dimModuleIds, onOpenModule, onFitPack }: Props) {
  const { t } = useTranslation()
  return (
    <section className="hg-pack" data-pack={pkg.id} style={{ left: pkg.pos_x, top: pkg.pos_y }}>
      <button
        type="button"
        className="hg-pack-title"
        aria-label={t('vinnubord.board.fitPack', { name: pkg.name })}
        onClick={() => onFitPack(pkg.id)}
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
