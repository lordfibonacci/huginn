import { describe, it, expect } from 'vitest'
import { cardModels, type CardContext } from './cards'
import { emptyFilter } from './filters'
import type { Tone } from './status'
import type { Item, Module, Participant } from './types'

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'i1', created_at: null, project_id: 'pr', module_id: null, title: 'Item', summary: null,
    body: null, status: 'new', waiting_on: null, tags: [], pos_x: 0, pos_y: 0, source_ref: null,
    next_step: null, next_prompt: null, created_by: 'u', updated_by: null,
    updated_at: '2026-01-01T00:00:00Z', closed_at: null, ...over,
  }
}

function module(over: Partial<Module> = {}): Module {
  return {
    id: 'm1', created_at: null, project_id: 'pr', package_id: null, slug: 'm', name: 'M',
    status_line: null, color: 'stone', is_ghost: false, position: 0, ...over,
  }
}

function participant(over: Partial<Participant> = {}): Participant {
  return {
    id: 'pa', created_at: null, project_id: 'pr', user_id: 'u', display_name: 'U', short: 'U',
    is_service: false, ...over,
  }
}

const participants: Participant[] = [
  participant({ id: 'p-h', user_id: 'me', display_name: 'Heimir', short: 'H' }),
  participant({ id: 'p-a', user_id: 'other', display_name: 'Árni', short: 'A' }),
  participant({ id: 'p-c', user_id: 'svc', display_name: 'Claude', short: 'C', is_service: true }),
]

describe('cardModels', () => {
  const ctx = (over: Partial<CardContext> = {}): CardContext => ({
    viewerId: 'me', participants, actions: [], modules: [module({ id: 'm1', package_id: 'p1' })],
    unread: new Map(), filter: emptyFilter(), ...over,
  })
  it('keeps order and marks everything visible without a filter', () => {
    const out = cardModels([item({ id: 'a' }), item({ id: 'b' })], ctx())
    expect(out.map((c) => c.item.id)).toEqual(['a', 'b'])
    expect(out.every((c) => c.visible)).toBe(true)
  })
  it('tone, bucket and label follow status.ts', () => {
    const [c] = cardModels([item({ status: 'waiting', waiting_on: 'me' })], ctx())
    expect(c.tone).toBe('coral')
    expect(c.bucket).toBe('mine')
    expect(c.label).toBe('Bíður þín')
    expect(c.mode).toBe('pulse')
  })
  it('a tone filter hides by the bucket tone, a package filter by the module package', () => {
    const f = { ...emptyFilter(), tones: new Set<Tone>(['gold']) }
    const [c] = cardModels([item({ status: 'waiting', waiting_on: 'me' })], ctx({ filter: f }))
    expect(c.visible).toBe(false)
    const pf = { ...emptyFilter(), packages: new Set(['p1']) }
    expect(cardModels([item({ module_id: 'm1' })], ctx({ filter: pf }))[0].visible).toBe(true)
    expect(cardModels([item({ module_id: null })], ctx({ filter: pf }))[0].visible).toBe(false)
  })
  it('fresh comes from the unread map and feeds the unread filter', () => {
    const unread = new Map([['i1', { created: true, kinds: [], latest: '2026-01-02T00:00:00Z' }]])
    const uf = { ...emptyFilter(), unread: true }
    const [a] = cardModels([item({ id: 'i1' })], ctx({ unread, filter: uf }))
    const [b] = cardModels([item({ id: 'i2' })], ctx({ unread, filter: uf }))
    expect(a.fresh?.created).toBe(true)
    expect(a.visible).toBe(true)
    expect(b.fresh).toBeNull()
    expect(b.visible).toBe(false)
  })
  it('mover is updated_by, else created_by', () => {
    expect(cardModels([item({ created_by: 'me', updated_by: 'other' })], ctx())[0].mover?.short).toBe('A')
    expect(cardModels([item({ created_by: 'me', updated_by: null })], ctx())[0].mover?.short).toBe('H')
  })
  it('waitingOn is set only for a waiting item whose person is a participant', () => {
    expect(cardModels([item({ status: 'waiting', waiting_on: 'other' })], ctx())[0].waitingOn).toEqual({ short: 'A', name: 'Árni' })
    expect(cardModels([item({ status: 'waiting', waiting_on: 'gone' })], ctx())[0].waitingOn).toBeNull()
    expect(cardModels([item({ status: 'waiting', waiting_on: 'gone' })], ctx())[0].label).toBe('Bíður ?')
    expect(cardModels([item({ status: 'new', waiting_on: 'other' })], ctx())[0].waitingOn).toBeNull()
  })
})
