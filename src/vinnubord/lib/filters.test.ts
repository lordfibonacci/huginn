import { describe, it, expect } from 'vitest'
import { emptyFilter, isActive, matches } from './filters'
import type { Item } from './types'

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'i1', created_at: null, project_id: 'pr', module_id: null, title: 'Efnaskrá A og B', summary: null,
    body: null, status: 'new', waiting_on: null, tags: [], pos_x: 0, pos_y: 0, source_ref: null,
    next_step: null, next_prompt: null, created_by: 'u', updated_by: null,
    updated_at: '2026-01-01T00:00:00Z', closed_at: null, ...over,
  }
}

describe('filters', () => {
  it('empty filter is inactive and matches everything', () => {
    const f = emptyFilter()
    expect(isActive(f)).toBe(false)
    expect(matches(item(), { tone: 'stone', packageId: null }, f)).toBe(true)
  })
  it('tone filter', () => {
    const f = emptyFilter()
    f.tones.add('gold')
    expect(isActive(f)).toBe(true)
    expect(matches(item(), { tone: 'gold', packageId: null }, f)).toBe(true)
    expect(matches(item(), { tone: 'teal', packageId: null }, f)).toBe(false)
  })
  it('package filter does not match null packageId', () => {
    const f = emptyFilter()
    f.packages.add('pk1')
    expect(matches(item(), { tone: 'gold', packageId: null }, f)).toBe(false)
    expect(matches(item(), { tone: 'gold', packageId: 'pk1' }, f)).toBe(true)
    expect(matches(item(), { tone: 'gold', packageId: 'pk2' }, f)).toBe(false)
  })
  it('tag filter', () => {
    const f = emptyFilter()
    f.tags.add('db')
    expect(matches(item({ tags: ['db'] }), { tone: 'gold', packageId: null }, f)).toBe(true)
    expect(matches(item({ tags: ['ui'] }), { tone: 'gold', packageId: null }, f)).toBe(false)
  })
  it('search is lowercased and finds title, summary, body, tags', () => {
    const ctx = { tone: 'gold' as const, packageId: null }
    const f = emptyFilter()
    f.q = 'efnaskr'
    expect(isActive(f)).toBe(true)
    expect(matches(item(), ctx, f)).toBe(true)
    f.q = 'ZZZ'
    expect(matches(item(), ctx, f)).toBe(false)
    expect(matches(item({ summary: 'zzz hér' }), ctx, f)).toBe(true)
    expect(matches(item({ body: 'og zzz' }), ctx, f)).toBe(true)
    expect(matches(item({ tags: ['Zzz'] }), ctx, f)).toBe(true)
  })
})
