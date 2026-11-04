import { describe, it, expect } from 'vitest'
import {
  activeViewKey,
  itemsInView,
  normalizeViewFilter,
  packPositionsOf,
  positionOf,
  positionsOf,
  resolveActiveView,
  viewCounts,
  viewFilterJson,
  viewFilterOf,
} from './views'
import type { Action, Item, Module, View } from './types'

const ME = 'me'
const OTHER = 'other'

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'i1', created_at: null, project_id: 'pr', module_id: null, title: 'Item', summary: null,
    body: null, status: 'new', waiting_on: null, tags: [], keywords: [], pos_x: 0, pos_y: 0, source_ref: null,
    next_step: null, next_prompt: null, created_by: 'u', updated_by: null,
    updated_at: '2026-01-01T00:00:00Z', closed_at: null, ...over,
  }
}

function module(over: Partial<Module> = {}): Module {
  return {
    id: 'm1', created_at: null, project_id: 'pr', package_id: 'p1', slug: 'm1', name: 'Eining',
    status_line: null, color: 'gold', is_ghost: false, position: 0, ...over,
  }
}

function view(over: Partial<View> = {}): View {
  return {
    id: 'v1', created_at: null, project_id: 'pr', name: 'Sýn', filter: {}, position: 0,
    created_by: null, ...over,
  }
}

const NO_ACTIONS: Action[] = []
const ids = (items: Item[]) => items.map((i) => i.id)

describe('itemsInView', () => {
  it('null view shows every on board item', () => {
    const items = [
      item({ id: 'a', status: 'new' }),
      item({ id: 'b', status: 'parked' }),
      item({ id: 'c', status: 'done' }),
      item({ id: 'd', status: 'dropped' }),
    ]
    expect(ids(itemsInView(items, [], NO_ACTIONS, ME, null))).toEqual(['a', 'b'])
  })

  it('tones filter by the count bucket of the viewer', () => {
    const items = [
      item({ id: 'mine', status: 'waiting', waiting_on: ME }),
      item({ id: 'theirs', status: 'waiting', waiting_on: OTHER }),
    ]
    const v = view({ filter: { tones: ['coral'] } })
    expect(ids(itemsInView(items, [], NO_ACTIONS, ME, v))).toEqual(['mine'])
    // the same view for the other person flips the result
    expect(ids(itemsInView(items, [], NO_ACTIONS, OTHER, v))).toEqual(['theirs'])
    expect(ids(itemsInView(items, [], NO_ACTIONS, ME, view({ filter: { tones: ['lilac'] } })))).toEqual(['theirs'])
  })

  it('packages filter by the module package and unknown packages are ignored', () => {
    const modules = [module({ id: 'm1', package_id: 'p1' }), module({ id: 'm2', package_id: 'p2' })]
    const items = [
      item({ id: 'a', module_id: 'm1' }),
      item({ id: 'b', module_id: 'm2' }),
      item({ id: 'c', module_id: null }),
    ]
    expect(ids(itemsInView(items, modules, NO_ACTIONS, ME, view({ filter: { packages: ['gone'] } })))).toEqual(['a', 'b', 'c'])
    // an item without module is hidden when packages are set
    expect(ids(itemsInView(items, modules, NO_ACTIONS, ME, view({ filter: { packages: ['p1'] } })))).toEqual(['a'])
    // a known package beside an unknown one keeps only the known one
    expect(ids(itemsInView(items, modules, NO_ACTIONS, ME, view({ filter: { packages: ['p2', 'gone'] } })))).toEqual(['b'])
  })

  it('tags filter', () => {
    const items = [
      item({ id: 'a', tags: ['db'] }),
      item({ id: 'b', tags: ['ui', 'db'] }),
      item({ id: 'c', tags: ['ui'] }),
      item({ id: 'd', tags: [] }),
    ]
    expect(ids(itemsInView(items, [], NO_ACTIONS, ME, view({ filter: { tags: ['db'] } })))).toEqual(['a', 'b'])
  })

  it('a view never shows done or dropped items', () => {
    const items = [item({ id: 'a', status: 'done' }), item({ id: 'b', status: 'dropped' }), item({ id: 'c' })]
    expect(ids(itemsInView(items, [], NO_ACTIONS, ME, view()))).toEqual(['c'])
  })
})

describe('positions', () => {
  it('positionsOf keeps only the view rows and positionOf falls back to the item', () => {
    const rows = [
      { project_id: 'p', view_id: 'v1', item_id: 'i1', pos_x: 5, pos_y: 6 },
      { project_id: 'p', view_id: 'v2', item_id: 'i1', pos_x: 7, pos_y: 8 },
    ]
    expect(positionOf(item({ id: 'i1', pos_x: 1, pos_y: 2 }), positionsOf(rows, 'v1'))).toEqual({ x: 5, y: 6 })
    expect(positionOf(item({ id: 'i1', pos_x: 1, pos_y: 2 }), positionsOf(rows, null))).toEqual({ x: 1, y: 2 })
    expect(positionOf(item({ id: 'i2', pos_x: 1, pos_y: 2 }), positionsOf(rows, 'v1'))).toEqual({ x: 1, y: 2 })
    expect(positionsOf(rows, null).size).toBe(0)
    expect(positionsOf(rows, 'v2').get('i1')).toEqual({ x: 7, y: 8 })
  })
  it('packPositionsOf keeps only the view rows by package', () => {
    const rows = [
      { project_id: 'p', view_id: 'v1', package_id: 'k1', pos_x: 5, pos_y: 6 },
      { project_id: 'p', view_id: 'v2', package_id: 'k1', pos_x: 7, pos_y: 8 },
    ]
    expect(packPositionsOf(rows, 'v1').get('k1')).toEqual({ x: 5, y: 6 })
    expect(packPositionsOf(rows, 'v2').get('k1')).toEqual({ x: 7, y: 8 })
    expect(packPositionsOf(rows, 'v1').has('k2')).toBe(false)
    expect(packPositionsOf(rows, null).size).toBe(0)
  })
})

describe('active view', () => {
  it('key is per project', () => expect(activeViewKey('p1')).toBe('hg.view.p1'))
  it('resolves a stored id, null for none or a deleted view', () => {
    const v = view({ id: 'v1' })
    expect(resolveActiveView('v1', [v])).toBe(v)
    expect(resolveActiveView('gone', [v])).toBeNull()
    expect(resolveActiveView(null, [v])).toBeNull()
  })
})

describe('viewFilterOf and viewFilterJson', () => {
  it('round trip, dropping unknown tones, never carrying q or unread', () => {
    const f = viewFilterOf(view({ filter: { tones: ['gold', 'nope'], packages: ['p1'], tags: ['a'] } }))
    expect([...f.tones]).toEqual(['gold'])
    expect(f.q).toBe('')
    expect(f.unread).toBe(false)
    expect(viewFilterJson(f)).toEqual({ tones: ['gold'], packages: ['p1'], tags: ['a'] })
  })
})

describe('viewCounts', () => {
  it('counts items per view', () => {
    const modules = [module({ id: 'm1', package_id: 'p1' }), module({ id: 'm2', package_id: 'p2' })]
    const items = [
      item({ id: 'a', module_id: 'm1', status: 'waiting', waiting_on: ME, tags: ['db'] }),
      item({ id: 'b', module_id: 'm1', status: 'new' }),
      item({ id: 'c', module_id: 'm2', status: 'waiting', waiting_on: OTHER }),
      item({ id: 'd', module_id: 'm2', status: 'done' }),
    ]
    const views = [
      view({ id: 'all', filter: {} }),
      view({ id: 'p1', filter: { packages: ['p1'] } }),
      view({ id: 'coral', filter: { tones: ['coral'] } }),
      view({ id: 'db', filter: { tags: ['db'] } }),
      view({ id: 'none', filter: { tags: ['zzz'] } }),
    ]
    const counts = viewCounts(views, items, modules, NO_ACTIONS, ME)
    expect(counts.get('all')).toBe(3)
    expect(counts.get('p1')).toBe(2)
    expect(counts.get('coral')).toBe(1)
    expect(counts.get('db')).toBe(1)
    expect(counts.get('none')).toBe(0)
    expect(counts.size).toBe(5)
  })
})

describe('normalizeViewFilter', () => {
  it('a group with every option ticked is saved as empty, meaning all', () => {
    const json = {
      tones: ['gold', 'lilac', 'coral', 'teal', 'stone'],
      packages: ['p2', 'p1'],
      tags: ['ui', 'db'],
    }
    expect(normalizeViewFilter(json, ['p1', 'p2'], ['db', 'ui'])).toEqual({ tones: [], packages: [], tags: [] })
  })

  it('a partial group is kept as it is', () => {
    const json = { tones: ['gold', 'coral'], packages: ['p1'], tags: ['db'] }
    expect(normalizeViewFilter(json, ['p1', 'p2'], ['db', 'ui'])).toEqual(json)
  })

  it('none ticked stays empty', () => {
    expect(normalizeViewFilter({ tones: [], packages: [], tags: [] }, ['p1'], ['db'])).toEqual({
      tones: [],
      packages: [],
      tags: [],
    })
  })

  it('every offered tag plus one no item carries still means all', () => {
    expect(normalizeViewFilter({ tags: ['db', 'ui', 'gone'] }, [], ['db', 'ui']).tags).toEqual([])
  })

  it('with nothing offered a ticked tag or package is kept', () => {
    expect(normalizeViewFilter({ packages: ['p1'], tags: ['gone'] }, [], [])).toEqual({
      tones: [],
      packages: ['p1'],
      tags: ['gone'],
    })
  })
})
