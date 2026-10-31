import type { Item } from './types'
import type { Tone } from './status'

export type Filter = {
  tones: Set<Tone>
  packages: Set<string>
  tags: Set<string>
  q: string
}

export function emptyFilter(): Filter {
  return { tones: new Set(), packages: new Set(), tags: new Set(), q: '' }
}

export function isActive(f: Filter): boolean {
  return f.tones.size > 0 || f.packages.size > 0 || f.tags.size > 0 || f.q.trim() !== ''
}

export function matches(
  item: Item,
  ctx: { tone: Tone; packageId: string | null },
  f: Filter,
): boolean {
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
