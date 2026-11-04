import { describe, expect, it } from 'vitest'
import { foldSearch, searchIndex } from './search'
import type { Item } from './types'

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'i1', created_at: null, project_id: 'pr', module_id: null, title: 'Sýning', summary: null, body: null,
    status: 'new', waiting_on: null, tags: [], keywords: [], pos_x: 0, pos_y: 0, source_ref: null, next_step: null,
    next_prompt: null, created_by: 'u', updated_by: null, updated_at: '2026-01-01T00:00:00Z', closed_at: null, ...over,
  }
}

describe('foldSearch', () => {
  it('lowercases and strips accents, keeps ð þ æ, collapses whitespace', () => {
    expect(foldSearch('SÝNING')).toBe('syning')
    expect(foldSearch('Árni  leiðarvísir')).toBe('arni leiðarvisir')
    expect(foldSearch('Þór æfir')).toBe('þor æfir')
    expect(foldSearch('  a \n b ')).toBe('a b')
  })
})

describe('searchIndex', () => {
  const base = { items: [item({ id: 'i1', title: 'Efnaskrá', summary: 'Sam', body: 'Megin', tags: ['Prófun'], keywords: ['social media'] }), item({ id: 'i2', title: 'Annað' })] }
  const rows = {
    files: [{ item_id: 'i1', name: 'Skýrsla.pdf', note: 'Fyrir Árna' }, { item_id: 'i2', name: 'other.md', note: null }],
    questions: [{ item_id: 'i1', body: 'Hvaða litur?', answer: 'Blár' }, { item_id: 'i2', body: 'x', answer: null }],
    actions: [{ item_id: 'i1', body: 'Keyra SQL' }],
    comments: [{ item_id: 'i1', module_id: null, body: 'Lítur vel út' }, { item_id: null, module_id: 'm1', body: 'módúlspjall' }],
  }
  it('folds every part of an item into one text and nothing of other items', () => {
    const idx = searchIndex({ ...base, ...rows } as never)
    const t = idx.get('i1') ?? ''
    for (const s of ['efnaskra', 'sam', 'megin', 'profun', 'social media', 'skyrsla.pdf', 'fyrir arna', 'hvaða litur?', 'blar', 'keyra sql', 'litur vel ut']) expect(t).toContain(s)
    expect(t).not.toContain('annað')
    expect(t).not.toContain('other.md')
    expect(t).not.toContain('modulspjall')
    expect(idx.get('i2')).toContain('annað')
  })
  it('gives an entry for an item with nothing attached', () => {
    expect(searchIndex({ items: [item({ id: 'i3', title: 'Tómt' })], files: [], questions: [], actions: [], comments: [] } as never).get('i3')).toBe('tomt')
  })
})
