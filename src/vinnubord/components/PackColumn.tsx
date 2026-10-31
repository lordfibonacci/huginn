import { moduleOpenCount, moduleTone } from '../lib/layout'
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
}

export function PackColumn({ pkg, modules, items, viewerId, participants, hotModuleIds, dimModuleIds, onOpenModule }: Props) {
  return (
    <section className="hg-pack" data-pack={pkg.id} style={{ left: pkg.pos_x, top: pkg.pos_y }}>
      <h2 className="hg-pack-title">{pkg.name}</h2>
      <div className="hg-pack-rail" aria-hidden="true" />
      {modules.map((m) => (
        <ModuleCard
          key={m.id}
          module={m}
          openCount={moduleOpenCount(m.id, items)}
          tone={moduleTone(m.id, items, viewerId, participants)}
          hot={hotModuleIds?.has(m.id) ?? false}
          ghost={m.is_ghost}
          dim={dimModuleIds?.has(m.id) ?? false}
          onClick={() => onOpenModule(m.id)}
        />
      ))}
    </section>
  )
}
