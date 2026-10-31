import { describe, expect, it } from 'vitest'
import { boardOrder, moduleOpenCount, moduleTone, packLayout, planProgress } from './layout'
import type { Item, Module, Package, Participant, Plan } from './types'

const pkg = (id: string, position: number): Package => ({
  id, created_at: null, project_id: 'p', name: id, position, pos_x: 0, pos_y: 0,
})
const mod = (id: string, package_id: string | null, position: number): Module => ({
  id, created_at: null, project_id: 'p', package_id, slug: id, name: id,
  status_line: null, color: '#fff', is_ghost: false, position,
})
const item = (id: string, module_id: string | null, status: Item['status'], extra: Partial<Item> = {}): Item => ({
  id, created_at: null, project_id: 'p', module_id, title: id, summary: null, body: null,
  status, waiting_on: null, tags: [], pos_x: 0, pos_y: 0, source_ref: null, next_step: null,
  next_prompt: null, created_by: 'u1', updated_by: null, updated_at: '', closed_at: null, ...extra,
})
const people: Participant[] = [
  { id: 'a', created_at: null, project_id: 'p', user_id: 'u1', display_name: 'Heimir', short: 'H', is_service: false },
]

describe('packLayout', () => {
  it('sorts packages and their modules by position', () => {
    const out = packLayout(
      [pkg('b', 2), pkg('a', 1)],
      [mod('m3', 'a', 3), mod('m1', 'a', 1), mod('m2', 'b', 1), mod('orphan', null, 0)],
    )
    expect(out.map((r) => r.pkg.id)).toEqual(['a', 'b'])
    expect(out[0].modules.map((m) => m.id)).toEqual(['m1', 'm3'])
    expect(out[1].modules.map((m) => m.id)).toEqual(['m2'])
  })
  it('keeps packages with no modules', () => {
    expect(packLayout([pkg('a', 1)], [])[0].modules).toEqual([])
  })
})

describe('moduleOpenCount', () => {
  it('counts only items on the board for that module', () => {
    const items = [
      item('1', 'm', 'new'), item('2', 'm', 'parked'), item('3', 'm', 'done'),
      item('4', 'm', 'dropped'), item('5', 'other', 'new'),
    ]
    expect(moduleOpenCount('m', items)).toBe(2)
  })
})

describe('moduleTone', () => {
  const m = (color: string) => ({ id: 'm', color })
  it('is stone with no items and no tone color', () => {
    expect(moduleTone(m('stone'), [], 'u1', people)).toBe('stone')
    expect(moduleTone(m('#fff'), [], 'u1', people)).toBe('stone')
  })
  it('skips parked and closed items and uses the first remaining', () => {
    const items = [item('1', 'm', 'parked'), item('2', 'm', 'done'), item('3', 'm', 'building')]
    expect(moduleTone(m('stone'), items, 'u1', people)).toBe('teal')
  })
  it('an open item wins over the module color', () => {
    expect(moduleTone(m('lilac'), [item('1', 'm', 'new')], 'u1', people)).toBe('gold')
  })
  it('falls back to the module color (ruling R27) with no open item that is not parked', () => {
    expect(moduleTone(m('teal'), [], 'u1', people)).toBe('teal')
    expect(moduleTone(m('coral'), [item('1', 'm', 'parked')], 'u1', people)).toBe('coral')
    expect(moduleTone(m('gold'), [item('1', 'm', 'done')], 'u1', people)).toBe('gold')
  })
  it('is stone when only parked items remain and the color is not a tone', () => {
    expect(moduleTone(m('purple'), [item('1', 'm', 'parked')], 'u1', people)).toBe('stone')
  })
})

const plan = (id: string, status: Plan['status'], position: number): Plan => ({
  id, created_at: null, project_id: 'p', item_id: 'i', name: id, path: null, status, position, updated_at: '',
})

describe('planProgress', () => {
  it('no plans gives no bars', () => {
    expect(planProgress([])).toEqual({ bars: [], current: 0, total: 0 })
  })
  it('bars by position: done 1, building 0.5, todo 0, current is the first not done', () => {
    const out = planProgress([plan('c', 'todo', 3), plan('a', 'done', 1), plan('b', 'building', 2)])
    expect(out).toEqual({ bars: [1, 0.5, 0], current: 2, total: 3 })
  })
  it('all done points at the last plan', () => {
    expect(planProgress([plan('a', 'done', 1), plan('b', 'done', 2)])).toEqual({ bars: [1, 1], current: 2, total: 2 })
  })
})

describe('boardOrder', () => {
  it('orders by created_at, ties by id, whatever order the rows came in', () => {
    const t1 = '2026-10-31T14:00:00Z'
    const t2 = '2026-10-31T15:00:00Z'
    const rows = [
      item('c', null, 'new', { created_at: t1 }),
      item('z', null, 'new', { created_at: t2 }),
      item('a', null, 'new', { created_at: t1 }),
      item('b', null, 'new', { created_at: t1 }),
    ]
    const expected = ['a', 'b', 'c', 'z']
    expect(boardOrder(rows).map((i) => i.id)).toEqual(expected)
    expect(boardOrder([...rows].reverse()).map((i) => i.id)).toEqual(expected)
  })
  it('does not change the input array', () => {
    const rows = [item('b', null, 'new'), item('a', null, 'new')]
    boardOrder(rows)
    expect(rows.map((i) => i.id)).toEqual(['b', 'a'])
  })
})
