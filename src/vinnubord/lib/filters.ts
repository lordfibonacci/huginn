import { isOnBoard, type Tone } from './status'
import type { Item, Module, Package } from './types'

export type Filter = {
  tones: Set<Tone>
  packages: Set<string>
  tags: Set<string>
  q: string
  unread: boolean
}

export function emptyFilter(): Filter {
  return { tones: new Set(), packages: new Set(), tags: new Set(), q: '', unread: false }
}

export function isActive(f: Filter): boolean {
  return f.tones.size > 0 || f.packages.size > 0 || f.tags.size > 0 || f.q.trim() !== '' || f.unread
}

export function matches(
  item: Item,
  ctx: { tone: Tone; packageId: string | null; unread: boolean },
  f: Filter,
): boolean {
  if (f.unread && !ctx.unread) return false
  if (f.tones.size > 0 && !f.tones.has(ctx.tone)) return false
  if (f.packages.size > 0 && (ctx.packageId === null || !f.packages.has(ctx.packageId))) return false
  if (f.tags.size > 0 && !item.tags.some((t) => f.tags.has(t))) return false
  const q = f.q.trim().toLowerCase()
  if (q !== '') {
    const hay = [item.title, item.summary ?? '', item.body ?? '', ...item.tags].join('\n').toLowerCase()
    if (!hay.includes(q)) return false
  }
  return true
}

// ---------- storage ----------

const TONES: readonly Tone[] = ['gold', 'coral', 'lilac', 'teal', 'stone']

// sessionStorage key of one project's filter.
export function filterStorageKey(projectId: string): string {
  return `hg.filter.${projectId}`
}

export function serializeFilter(f: Filter): string {
  return JSON.stringify({ tones: [...f.tones], packages: [...f.packages], tags: [...f.tags], q: f.q, unread: f.unread })
}

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

// The stored filter, or an empty one for anything missing or malformed.
export function parseFilter(raw: string | null): Filter {
  const f = emptyFilter()
  if (!raw) return f
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return f
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return f
  const o = data as Record<string, unknown>
  for (const t of strings(o.tones)) if ((TONES as readonly string[]).includes(t)) f.tones.add(t as Tone)
  for (const p of strings(o.packages)) f.packages.add(p)
  for (const t of strings(o.tags)) f.tags.add(t)
  if (typeof o.q === 'string') f.q = o.q
  if (typeof o.unread === 'boolean') f.unread = o.unread
  return f
}

// ---------- changes, always a new Filter so React sees them ----------

export function toggleFilter(f: Filter, field: 'tones', value: Tone): Filter
export function toggleFilter(f: Filter, field: 'packages' | 'tags', value: string): Filter
export function toggleFilter(f: Filter, field: 'tones' | 'packages' | 'tags', value: string): Filter {
  const next = new Set<string>(f[field])
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return { ...f, [field]: next }
}

export function toggleUnread(f: Filter): Filter {
  return { ...f, unread: !f.unread }
}

export function withQuery(f: Filter, q: string): Filter {
  return { ...f, q }
}

// The filter without package ids that are no longer on the board (a deleted
// package would otherwise keep the board dim with nothing to switch off).
// The same object when nothing changes.
export function prunePackages(f: Filter, known: Set<string>): Filter {
  if ([...f.packages].every((id) => known.has(id))) return f
  return { ...f, packages: new Set([...f.packages].filter((id) => known.has(id))) }
}

// ---------- menu entries ----------

export type FilterOption = { key: string; label: string; count: number }

// Tags of the items on the board, most used first, then by name. A selected
// tag that no open item carries any more stays with count 0, so it can still
// be turned off from the menu.
export function tagCounts(items: Item[], selected: Set<string>): FilterOption[] {
  const counts = new Map<string, number>()
  for (const item of items) {
    if (!isOnBoard(item)) continue
    for (const tag of new Set(item.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  for (const tag of selected) if (!counts.has(tag)) counts.set(tag, 0)
  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'is'))
    .map(([key, count]) => ({ key, label: key, count }))
}

// Packages in board order with the number of open items in their modules.
export function packageCounts(packages: Package[], modules: Module[], items: Item[]): FilterOption[] {
  const packageOf = new Map(modules.map((m) => [m.id, m.package_id]))
  const counts = new Map<string, number>()
  for (const item of items) {
    if (!isOnBoard(item) || !item.module_id) continue
    const pkg = packageOf.get(item.module_id)
    if (pkg) counts.set(pkg, (counts.get(pkg) ?? 0) + 1)
  }
  return [...packages]
    .sort((a, b) => a.position - b.position)
    .map((p) => ({ key: p.id, label: p.name, count: counts.get(p.id) ?? 0 }))
}
