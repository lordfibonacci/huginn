import { describe, it, expect } from 'vitest'
import {
  emptyFilter,
  filterStorageKey,
  isActive,
  matches,
  packageCounts,
  prunePackages,
  parseFilter,
  serializeFilter,
  tagCounts,
  toggleFilter,
  toggleUnread,
  withQuery,
  withoutPicks,
} from './filters'
import type { Item } from './types'
import type { Tone } from './status'

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'i1', created_at: null, project_id: 'pr', module_id: null, title: 'Efnaskrá A og B', summary: null,
    body: null, status: 'new', waiting_on: null, tags: [], keywords: [], pos_x: 0, pos_y: 0, source_ref: null,
    next_step: null, next_prompt: null, created_by: 'u', updated_by: null,
    updated_at: '2026-01-01T00:00:00Z', closed_at: null, ...over,
  }
}

describe('filters', () => {
  it('empty filter is inactive and matches everything', () => {
    const f = emptyFilter()
    expect(isActive(f)).toBe(false)
    expect(matches(item(), { tone: 'stone', packageId: null, unread: false, text: '' }, f)).toBe(true)
  })
  it('tone filter', () => {
    const f = emptyFilter()
    f.tones.add('gold')
    expect(isActive(f)).toBe(true)
    expect(matches(item(), { tone: 'gold', packageId: null, unread: false, text: '' }, f)).toBe(true)
    expect(matches(item(), { tone: 'teal', packageId: null, unread: false, text: '' }, f)).toBe(false)
  })
  it('package filter does not match null packageId', () => {
    const f = emptyFilter()
    f.packages.add('pk1')
    expect(matches(item(), { tone: 'gold', packageId: null, unread: false, text: '' }, f)).toBe(false)
    expect(matches(item(), { tone: 'gold', packageId: 'pk1', unread: false, text: '' }, f)).toBe(true)
    expect(matches(item(), { tone: 'gold', packageId: 'pk2', unread: false, text: '' }, f)).toBe(false)
  })
  it('tag filter', () => {
    const f = emptyFilter()
    f.tags.add('db')
    expect(matches(item({ tags: ['db'] }), { tone: 'gold', packageId: null, unread: false, text: '' }, f)).toBe(true)
    expect(matches(item({ tags: ['ui'] }), { tone: 'gold', packageId: null, unread: false, text: '' }, f)).toBe(false)
  })
  it('unread filter keeps only unread items and counts as active', () => {
    const f = toggleUnread(emptyFilter())
    expect(isActive(f)).toBe(true)
    expect(matches(item(), { tone: 'gold', packageId: null, unread: true, text: '' }, f)).toBe(true)
    expect(matches(item(), { tone: 'gold', packageId: null, unread: false, text: '' }, f)).toBe(false)
    expect(toggleUnread(f).unread).toBe(false)
  })
  it('query searches the folded text the caller gives, ignoring case and accents', () => {
    const f = withQuery(emptyFilter(), 'Zzz')
    const ctx = (text: string) => ({ tone: 'gold' as Tone, packageId: null, unread: false, text })
    expect(matches(item(), ctx('abc'), f)).toBe(false)
    expect(matches(item(), ctx('og zzz'), f)).toBe(true)
    expect(matches(item(), ctx('og zzz'), withQuery(emptyFilter(), 'ZZZ')), 'case').toBe(true)
    expect(matches(item(), ctx('syning'), withQuery(emptyFilter(), 'sýning')), 'accent in query').toBe(true)
    expect(matches(item(), ctx('syning'), withQuery(emptyFilter(), 'þyning')), 'þ is not t').toBe(false)
    expect(matches(item(), ctx('abc'), withQuery(emptyFilter(), '   ')), 'blank query').toBe(true)
  })
})

describe('filter storage', () => {
  it('key is per project', () => {
    expect(filterStorageKey('p1')).toBe('hg.filter.p1')
  })
  it('round trips through a string', () => {
    const f = emptyFilter()
    f.tones.add('coral')
    f.tones.add('gold')
    f.packages.add('pk1')
    f.tags.add('smokes')
    f.q = 'efna'
    const back = parseFilter(serializeFilter(f))
    expect([...back.tones].sort()).toEqual(['coral', 'gold'])
    expect([...back.packages]).toEqual(['pk1'])
    expect([...back.tags]).toEqual(['smokes'])
    expect(back.q).toBe('efna')
  })
  it('round trips unread', () => {
    expect(parseFilter(serializeFilter(toggleUnread(emptyFilter()))).unread).toBe(true)
    expect(parseFilter('{"unread":"yes"}').unread).toBe(false)
  })
  it('null, garbage and wrong shapes give an empty filter', () => {
    for (const raw of [null, '', 'not json', '42', '[]', '{"tones":"gold"}']) {
      const f = parseFilter(raw)
      expect(isActive(f)).toBe(false)
    }
  })
  it('drops unknown tones and non string entries', () => {
    const f = parseFilter(JSON.stringify({ tones: ['gold', 'pink', 3], packages: ['a', null], tags: [1, 'x'], q: 5 }))
    expect([...f.tones]).toEqual(['gold'])
    expect([...f.packages]).toEqual(['a'])
    expect([...f.tags]).toEqual(['x'])
    expect(f.q).toBe('')
  })
})

describe('toggleFilter and withQuery', () => {
  it('adds then removes a value and never mutates the input', () => {
    const a = emptyFilter()
    const b = toggleFilter(a, 'tones', 'coral')
    expect(a.tones.size).toBe(0)
    expect(b.tones.has('coral')).toBe(true)
    const c = toggleFilter(b, 'tones', 'coral')
    expect(c.tones.has('coral')).toBe(false)
    expect(b.tones.has('coral')).toBe(true)
  })
  it('toggles packages and tags independently', () => {
    const f = toggleFilter(toggleFilter(emptyFilter(), 'packages', 'pk1'), 'tags', 'db')
    expect([...f.packages]).toEqual(['pk1'])
    expect([...f.tags]).toEqual(['db'])
  })
  it('withQuery replaces q only', () => {
    const f = withQuery(toggleFilter(emptyFilter(), 'tags', 'db'), 'efna')
    expect(f.q).toBe('efna')
    expect(f.tags.has('db')).toBe(true)
  })
})

describe('tagCounts', () => {
  it('counts tags of items on the board, most used first, then by name', () => {
    const items = [
      item({ id: 'a', tags: ['smokes', 'efni'] }),
      item({ id: 'b', tags: ['efni'] }),
      item({ id: 'c', tags: ['ákvörðun'] }),
      item({ id: 'd', tags: ['efni'], status: 'done' }),
      item({ id: 'e', tags: ['gamalt'], status: 'dropped' }),
    ]
    expect(tagCounts(items, new Set())).toEqual([
      { key: 'efni', label: 'efni', count: 2 },
      { key: 'ákvörðun', label: 'ákvörðun', count: 1 },
      { key: 'smokes', label: 'smokes', count: 1 },
    ])
  })
  it('keeps a selected tag that no open item has, with count 0, so it can be turned off', () => {
    expect(tagCounts([item({ tags: ['a'] })], new Set(['horfið']))).toEqual([
      { key: 'a', label: 'a', count: 1 },
      { key: 'horfið', label: 'horfið', count: 0 },
    ])
  })
})

describe('packageCounts', () => {
  const pk = (id: string, position: number) => ({
    id, created_at: null, project_id: 'pr', name: id.toUpperCase(), position, pos_x: 0, pos_y: 0,
  })
  const mod = (id: string, packageId: string | null) => ({
    id, created_at: null, project_id: 'pr', package_id: packageId, slug: id, name: id, status_line: null,
    color: '', is_ghost: false, position: 0,
  })
  it('lists packages in position order with their open item counts', () => {
    const packages = [pk('b', 2), pk('a', 1)]
    const modules = [mod('m1', 'a'), mod('m2', 'b'), mod('m3', null)]
    const items = [
      item({ id: '1', module_id: 'm1' }),
      item({ id: '2', module_id: 'm1' }),
      item({ id: '3', module_id: 'm2', status: 'done' }),
      item({ id: '4', module_id: 'm3' }),
      item({ id: '5', module_id: null }),
    ]
    expect(packageCounts(packages, modules, items)).toEqual([
      { key: 'a', label: 'A', count: 2 },
      { key: 'b', label: 'B', count: 0 },
    ])
  })
})

describe('prunePackages', () => {
  it('drops package ids that are not on the board any more', () => {
    const f = toggleFilter(toggleFilter(emptyFilter(), 'packages', 'gone'), 'packages', 'pk1')
    const out = prunePackages(f, new Set(['pk1', 'pk2']))
    expect([...out.packages]).toEqual(['pk1'])
    expect(f.packages.has('gone')).toBe(true)
  })
  it('returns the same filter when nothing is unknown, so React state does not churn', () => {
    const f = toggleFilter(emptyFilter(), 'packages', 'pk1')
    expect(prunePackages(f, new Set(['pk1']))).toBe(f)
    const empty = emptyFilter()
    expect(prunePackages(empty, new Set())).toBe(empty)
  })
})

describe('withoutPicks', () => {
  it('drops packages and tags and keeps the rest', () => {
    const f = { tones: new Set<Tone>(['gold']), packages: new Set(['p']), tags: new Set(['t']), q: 'x', unread: true }
    const r = withoutPicks(f)
    expect([...r.packages]).toEqual([])
    expect([...r.tags]).toEqual([])
    expect([...r.tones]).toEqual(['gold'])
    expect(r.q).toBe('x')
    expect(r.unread).toBe(true)
    const e = emptyFilter()
    expect(withoutPicks(e)).toBe(e)
  })
})
