import type { CardModel } from './cards'
import { packLayout } from './layout'
import type { Counts } from './status'
import type { Module, Package } from './types'

export type Sort = 'pack' | 'status' | 'updated'
export const SORTS: readonly Sort[] = ['pack', 'status', 'updated']
export type ListPrefs = { open: boolean; sort: Sort }
export const DEFAULT_LIST_PREFS: ListPrefs = { open: false, sort: 'pack' }

export function listKey(projectId: string): string {
  return `hg.list.${projectId}`
}

// Anything that is not the stored json falls back to the defaults, field by field.
export function parseListPrefs(raw: string | null): ListPrefs {
  const prefs = { ...DEFAULT_LIST_PREFS }
  if (raw === null) return prefs
  try {
    const v = JSON.parse(raw) as { open?: unknown; sort?: unknown } | null
    if (v && typeof v === 'object') {
      if (typeof v.open === 'boolean') prefs.open = v.open
      if (SORTS.includes(v.sort as Sort)) prefs.sort = v.sort as Sort
    }
  } catch {
    // not json, keep the defaults
  }
  return prefs
}

export function serializeListPrefs(p: ListPrefs): string {
  return JSON.stringify(p)
}

// The open state that applies: the stored one on a wide board, the in-memory one on a narrow board.
export function listOpen(prefs: ListPrefs, narrow: boolean, narrowOpen: boolean): boolean {
  return narrow ? narrowOpen : prefs.open
}

export const BUCKET_ORDER: readonly (keyof Counts)[] = ['new', 'mine', 'others', 'build', 'parked']

export type ListRow =
  | { kind: 'pack'; id: string; name: string }
  | { kind: 'module'; id: string | null; name: string | null; color: string | null; count: number }
  | { kind: 'bucket'; id: keyof Counts | 'closed'; count: number }
  | { kind: 'item'; card: CardModel; moduleName: string | null }

// count: item rows
export type ListRows = { rows: ListRow[]; count: number }

// A closed card (bucket null) sorts after every bucket.
const bucketIndex = (c: CardModel) => (c.bucket === null ? BUCKET_ORDER.length : BUCKET_ORDER.indexOf(c.bucket))

function byBucketThenTitle(a: CardModel, b: CardModel): number {
  return bucketIndex(a) - bucketIndex(b) || a.item.title.localeCompare(b.item.title, 'is')
}

function byUpdated(a: CardModel, b: CardModel): number {
  if (a.item.updated_at !== b.item.updated_at) return a.item.updated_at < b.item.updated_at ? 1 : -1
  return a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0
}

export function listRows(cards: CardModel[], packages: Package[], modules: Module[], sort: Sort): ListRows {
  const shown = cards.filter((c) => c.visible)
  const moduleName = new Map(modules.map((m) => [m.id, m.name]))
  const nameOf = (c: CardModel) => (c.item.module_id ? (moduleName.get(c.item.module_id) ?? null) : null)
  const itemRow = (card: CardModel): ListRow => ({ kind: 'item', card, moduleName: nameOf(card) })

  if (sort === 'updated') {
    const rows = [...shown].sort(byUpdated).map(itemRow)
    return { rows, count: rows.length }
  }

  if (sort === 'status') {
    const rows: ListRow[] = []
    let count = 0
    for (const bucket of BUCKET_ORDER) {
      const group = shown.filter((c) => c.bucket === bucket).sort(byUpdated)
      if (group.length === 0) continue
      rows.push({ kind: 'bucket', id: bucket, count: group.length })
      for (const c of group) rows.push(itemRow(c))
      count += group.length
    }
    const closed = shown.filter((c) => c.bucket === null).sort(byUpdated)
    if (closed.length > 0) {
      rows.push({ kind: 'bucket', id: 'closed', count: closed.length })
      for (const c of closed) rows.push(itemRow(c))
      count += closed.length
    }
    return { rows, count }
  }

  const rows: ListRow[] = []
  // Only the modules a pack column draws: one with no package, or a missing
  // one, lists its items under the null module row with the moduleless ones.
  const layout = packLayout(packages, modules)
  const known = new Set(layout.flatMap((r) => r.modules.map((m) => m.id)))
  for (const { pkg, modules: mods } of layout) {
    const modRows: ListRow[] = []
    for (const m of mods) {
      const group = shown.filter((c) => c.item.module_id === m.id).sort(byBucketThenTitle)
      if (group.length === 0) continue
      modRows.push({ kind: 'module', id: m.id, name: m.name, color: m.color, count: group.length })
      for (const c of group) modRows.push(itemRow(c))
    }
    if (modRows.length === 0) continue
    rows.push({ kind: 'pack', id: pkg.id, name: pkg.name }, ...modRows)
  }
  const loose = shown.filter((c) => !c.item.module_id || !known.has(c.item.module_id)).sort(byBucketThenTitle)
  if (loose.length > 0) {
    rows.push({ kind: 'module', id: null, name: null, color: null, count: loose.length })
    for (const c of loose) rows.push(itemRow(c))
  }
  return { rows, count: rows.filter((r) => r.kind === 'item').length }
}
