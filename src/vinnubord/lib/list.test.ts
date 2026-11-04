import { describe, it, expect } from 'vitest'
import { listKey, listOpen, listRows, parseListPrefs, serializeListPrefs } from './list'
import type { CardModel } from './cards'
import type { Item, Module, Package } from './types'

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'i1', created_at: null, project_id: 'pr', module_id: null, title: 'Item', summary: null,
    body: null, status: 'new', waiting_on: null, tags: [], keywords: [], pos_x: 0, pos_y: 0, source_ref: null,
    next_step: null, next_prompt: null, created_by: 'u', updated_by: null,
    updated_at: '2026-01-01T00:00:00Z', closed_at: null, ...over,
  }
}

function card(over: Partial<CardModel> = {}): CardModel {
  return {
    item: item(), tone: 'gold', bucket: 'new', label: '', mode: 'pulse', visible: true,
    fresh: null, mover: null, waitingOn: null, moduleName: null, showStamp: false, freshComment: null, ...over,
  }
}

const packages: Package[] = [
  { id: 'p1', created_at: null, project_id: 'pr', name: 'Grunnur', position: 0, pos_x: 0, pos_y: 0 },
  { id: 'p2', created_at: null, project_id: 'pr', name: 'Rekstur', position: 1, pos_x: 0, pos_y: 0 },
]

function module(over: Partial<Module>): Module {
  return {
    id: 'm1', created_at: null, project_id: 'pr', package_id: 'p1', slug: 'm', name: 'Eining',
    status_line: null, color: 'gold', is_ghost: false, position: 0, ...over,
  }
}

const modules: Module[] = [
  module({ id: 'm1', name: 'Yfirlit', package_id: 'p1', position: 0, color: '#aa00ff' }),
  module({ id: 'm2', name: 'Kiosk', package_id: 'p1', position: 1, color: 'teal' }),
  module({ id: 'm3', name: 'Birgðir', package_id: 'p2', position: 0 }),
]

describe('parseListPrefs', () => {
  it('reads json and falls back field by field', () => {
    expect(parseListPrefs('{"open":true,"sort":"status"}')).toEqual({ open: true, sort: 'status' })
    expect(parseListPrefs('{"open":true,"sort":"nope"}')).toEqual({ open: true, sort: 'pack' })
    expect(parseListPrefs('open')).toEqual({ open: false, sort: 'pack' })
    expect(parseListPrefs(null)).toEqual({ open: false, sort: 'pack' })
    expect(parseListPrefs('{"open":"yes"}')).toEqual({ open: false, sort: 'pack' })
  })
  it('round trips', () => {
    expect(parseListPrefs(serializeListPrefs({ open: true, sort: 'updated' }))).toEqual({ open: true, sort: 'updated' })
  })
  it('keys by project', () => {
    expect(listKey('abc')).toBe('hg.list.abc')
  })
})

describe('listOpen', () => {
  it('stored on wide, memory on narrow', () => {
    expect(listOpen({ open: true, sort: 'pack' }, false, false)).toBe(true)
    expect(listOpen({ open: true, sort: 'pack' }, true, false)).toBe(false)
    expect(listOpen({ open: false, sort: 'pack' }, true, true)).toBe(true)
  })
})

describe('listRows by pack', () => {
  it('groups pack, module, items; skips empty modules and packs; counts', () => {
    const cards = [
      card({ item: item({ id: 'b', title: 'Beta', module_id: 'm1' }), bucket: 'new' }),
      card({ item: item({ id: 'a', title: 'Alfa', module_id: 'm1' }), bucket: 'others' }),
      card({ item: item({ id: 'c', title: 'Gamma', module_id: 'm1' }), bucket: 'mine' }),
      card({ item: item({ id: 'h', title: 'Hidden', module_id: 'm2' }), visible: false }),
    ]
    const out = listRows(cards, packages, modules, 'pack')
    expect(out.count).toBe(3)
    expect(out.rows.map((r) => (r.kind === 'item' ? r.card.item.id : `${r.kind}:${r.id}`))).toEqual(['pack:p1', 'module:m1', 'b', 'c', 'a'])
    expect(out.rows[1]).toMatchObject({ kind: 'module', name: 'Yfirlit', color: '#aa00ff', count: 3 })
  })
  it('sorts by title within a bucket with Icelandic collation', () => {
    const cards = [
      card({ item: item({ id: '1', title: 'Ö', module_id: 'm1' }) }),
      card({ item: item({ id: '2', title: 'A', module_id: 'm1' }) }),
      card({ item: item({ id: '3', title: 'Þ', module_id: 'm1' }) }),
    ]
    expect(listRows(cards, packages, modules, 'pack').rows.filter((r) => r.kind === 'item').map((r) => r.kind === 'item' && r.card.item.title)).toEqual(['A', 'Þ', 'Ö'])
  })
  it('puts items without a module, or with a deleted one, last under a null module row', () => {
    const cards = [card({ item: item({ id: 'x', module_id: null }) }), card({ item: item({ id: 'y', module_id: 'gone' }) }), card({ item: item({ id: 'z', module_id: 'm3' }) })]
    const rows = listRows(cards, packages, modules, 'pack').rows
    expect(rows.map((r) => (r.kind === 'item' ? r.card.item.id : `${r.kind}:${r.id}`))).toEqual(['pack:p2', 'module:m3', 'z', 'module:null', 'x', 'y'])
    expect(rows[3]).toMatchObject({ kind: 'module', id: null, name: null, color: null, count: 2 })
  })
  it('puts items of a module with no package, or a missing one, under the null module row', () => {
    const mods = [
      ...modules,
      module({ id: 'm4', name: 'Laus', package_id: null }),
      module({ id: 'm5', name: 'Munaðarlaus', package_id: 'gone' }),
    ]
    const cards = [card({ item: item({ id: 'u', module_id: 'm4' }) }), card({ item: item({ id: 'v', module_id: 'm5' }) }), card({ item: item({ id: 'z', module_id: 'm3' }) })]
    const out = listRows(cards, packages, mods, 'pack')
    expect(out.rows.map((r) => (r.kind === 'item' ? r.card.item.id : `${r.kind}:${r.id}`))).toEqual(['pack:p2', 'module:m3', 'z', 'module:null', 'u', 'v'])
    expect(out.count).toBe(3)
  })
  it('is empty with count 0 when nothing is visible', () => {
    expect(listRows([card({ visible: false })], packages, modules, 'pack')).toEqual({ rows: [], count: 0 })
  })
})

describe('listRows by status and by updated', () => {
  const cards = [
    card({ item: item({ id: 'old', module_id: 'm1', updated_at: '2026-01-01T00:00:00Z' }), bucket: 'mine' }),
    card({ item: item({ id: 'new', module_id: 'm2', updated_at: '2026-01-03T00:00:00Z' }), bucket: 'mine' }),
    card({ item: item({ id: 'n', module_id: null, updated_at: '2026-01-02T00:00:00Z' }), bucket: 'new' }),
    card({ item: item({ id: 'off', updated_at: '2025-12-31T00:00:00Z' }), bucket: null }),
  ]
  it('status: bucket rows in pill order, newest first inside, module name on the row', () => {
    const rows = listRows(cards, packages, modules, 'status').rows
    expect(rows.map((r) => (r.kind === 'item' ? r.card.item.id : `${r.kind}:${r.id}`))).toEqual(['bucket:new', 'n', 'bucket:mine', 'new', 'old'])
    expect(rows[3]).toMatchObject({ kind: 'item', moduleName: 'Kiosk' })
    expect(rows[1]).toMatchObject({ kind: 'item', moduleName: null })
  })
  it('updated: one run, newest first, ties by id', () => {
    const tie = [card({ item: item({ id: 'b', updated_at: '2026-01-01T00:00:00Z' }) }), card({ item: item({ id: 'a', updated_at: '2026-01-01T00:00:00Z' }) })]
    expect(listRows(tie, packages, modules, 'updated').rows.map((r) => r.kind === 'item' && r.card.item.id)).toEqual(['a', 'b'])
    expect(listRows(cards, packages, modules, 'updated').rows.map((r) => r.kind === 'item' && r.card.item.id)).toEqual(['new', 'n', 'old', 'off'])
  })
})
