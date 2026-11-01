import { isOnBoard, isTone, itemTone, type Tone } from './status'
import type { Item, Module, Package, Participant, Plan, PlanStatus } from './types'

export type PackRow = { pkg: Package; modules: Module[] }

export function packLayout(packages: Package[], modules: Module[]): PackRow[] {
  return [...packages]
    .sort((a, b) => a.position - b.position)
    .map((pkg) => ({
      pkg,
      modules: modules.filter((m) => m.package_id === pkg.id).sort((a, b) => a.position - b.position),
    }))
}

export function moduleOpenCount(moduleId: string, items: Item[]): number {
  return items.filter((i) => i.module_id === moduleId && isOnBoard(i)).length
}

// Tone of the first open item that is not parked. Without one, the color the
// module was given in settings (ruling R27), or stone when that is not a tone.
export function moduleTone(
  module: Pick<Module, 'id' | 'color'>,
  items: Item[],
  viewerId: string,
  participants: Participant[],
): Tone {
  const first = items.find((i) => i.module_id === module.id && isOnBoard(i) && i.status !== 'parked')
  if (first) return itemTone(first, viewerId, participants)
  return isTone(module.color) ? module.color : 'stone'
}

// A module's own color, a #rrggbb hex in color (the module colors of the
// product, e.g. metta). It paints the module card bar instead of the tone.
export function moduleAccent(module: Pick<Module, 'color'>): string | null {
  return /^#[0-9a-f]{6}$/i.test(module.color) ? module.color : null
}

const PLAN_FILL: Record<PlanStatus, number> = { done: 1, building: 0.5, todo: 0 }

// Progress bars on an item card, one per plan in position order, and the
// "Plan N af M" numbers: N is the first plan not done, or the last one.
export function planProgress(plans: Plan[]): { bars: number[]; current: number; total: number } {
  const sorted = [...plans].sort((a, b) => a.position - b.position)
  const total = sorted.length
  if (total === 0) return { bars: [], current: 0, total: 0 }
  const open = sorted.findIndex((p) => p.status !== 'done')
  return { bars: sorted.map((p) => PLAN_FILL[p.status]), current: open === -1 ? total : open + 1, total }
}

// Stable card order: created_at, then id. Items created in one statement share
// created_at and the database returns them in any order, which would make
// React move card nodes between loads.
export function boardOrder(items: Item[]): Item[] {
  return [...items].sort((a, b) => {
    const ta = a.created_at ?? ''
    const tb = b.created_at ?? ''
    if (ta !== tb) return ta < tb ? -1 : 1
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}
