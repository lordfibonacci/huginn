import type { Item, Tag } from './types'

// The fixed tag list of a project (spec 4.4): the name rule, the settings
// rows and the duplicate check. The database canonicalises spelling against
// the list (0016b) and refuses names off it.

export const TAG_MAX = 40
export const TAG_TAKEN = 'Taggið er þegar á listanum.'

export type TagRow = { id: string; name: string; count: number }

export function normalizeTag(input: string | null | undefined): { ok: true; name: string } | { ok: false; reason: string } {
  const name = (input ?? '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('is')
  if (name === '') return { ok: false, reason: 'Taggið þarf nafn.' }
  if (name.length > TAG_MAX) return { ok: false, reason: 'Tagg má mest vera 40 stafir.' }
  if (name.includes(',')) return { ok: false, reason: 'Tagg má ekki hafa kommu.' }
  return { ok: true, name }
}

export function tagRows(tags: Tag[], items: Pick<Item, 'tags'>[]): TagRow[] {
  return tags
    .map((t) => ({ id: t.id, name: t.name, count: items.filter((i) => i.tags.includes(t.name)).length }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'is'))
}

export function tagNameTaken(name: string, tags: Pick<Tag, 'id' | 'name'>[], selfId?: string): string | null {
  const key = name.toLocaleLowerCase('is')
  return tags.some((t) => t.id !== selfId && t.name.toLocaleLowerCase('is') === key) ? TAG_TAKEN : null
}

// The tag writes' database errors in Icelandic: the unique index gives the
// fixed text, the RPCs' own 22023 messages pass through, the rest is null.
export function tagErrorMessage(code: string | undefined, message: string): string | null {
  if (code === '23505') return TAG_TAKEN
  if (code === '22023') return message
  return null
}
