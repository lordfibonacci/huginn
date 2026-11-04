import { describe, it, expect } from 'vitest'
import { cardModels, firstLine, freshComment, freshLine, showStamp, type CardContext } from './cards'
import { emptyFilter, withQuery } from './filters'
import type { UnreadKind } from './reads'
import type { Tone } from './status'
import type { Item, Module, Participant } from './types'

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

const base: CardContext = {
  viewerId: 'me', participants, actions: [], modules: [module({ id: 'm1', package_id: 'p1' })],
  unread: new Map(), filter: emptyFilter(), comments: [], reads: [], now: Date.now(),
  search: new Map(),
}

describe('cardModels', () => {
  const ctx = (over: Partial<CardContext> = {}): CardContext => ({ ...base, ...over })
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
  it('a query dims a card whose index text lacks it and keeps one whose text has it', () => {
    const f = withQuery(emptyFilter(), 'sýning')
    const search = new Map([['i1', 'syning i dag'], ['i2', 'annad']])
    expect(cardModels([item({ id: 'i1' })], ctx({ filter: f, search }))[0].visible).toBe(true)
    expect(cardModels([item({ id: 'i2' })], ctx({ filter: f, search }))[0].visible).toBe(false)
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
  it('moduleName, showStamp and freshComment come from the context', () => {
    const now = Date.parse('2026-11-03T12:00:00Z')
    const ctx: CardContext = { ...base, modules: [module({ id: 'm1', name: 'Viðhald' })], comments: [
      { id: 'c', created_at: '2026-11-03T10:00:00Z', project_id: 'pr', item_id: 'i1', module_id: null, body: 'Hæ', user_id: 'arni' },
    ], reads: [], now, participants: [...participants, participant({ user_id: 'arni', short: 'Á' })] }
    const [m] = cardModels([item({ module_id: 'm1', updated_at: '2026-11-01T00:00:00Z' })], ctx)
    expect(m.moduleName).toBe('Viðhald')
    expect(m.showStamp).toBe(true)
    expect(m.freshComment).toEqual({ short: 'Á', line: 'Hæ' })
    expect(cardModels([item({ updated_at: '2026-10-01T00:00:00Z' })], ctx)[0]).toMatchObject({ moduleName: null, showStamp: false })
  })
})

describe('showStamp', () => {
  const now = Date.parse('2026-11-03T12:00:00Z')
  it('shows within 7 days and hides after', () => {
    expect(showStamp('2026-10-27T13:00:00Z', now)).toBe(true)   // 6 days 23 h
    expect(showStamp('2026-10-27T12:00:00Z', now)).toBe(true)   // exactly 7 days
    expect(showStamp('2026-10-27T11:00:00Z', now)).toBe(false)  // 7 days 1 h
    expect(showStamp(null, now)).toBe(false)
    expect(showStamp('not a date', now)).toBe(false)
  })
})

describe('firstLine', () => {
  it('takes the first non empty line, normalised and trimmed', () => {
    expect(firstLine('\r\n  \nSjáumst kl 10\r\nTek iPadinn')).toBe('Sjáumst kl 10')
    expect(firstLine('  \n\n')).toBe('')
  })
})

describe('freshComment', () => {
  const ps = [participant({ user_id: 'me', short: 'H' }), participant({ user_id: 'a', short: 'Á' })]
  const c = (id: string, user: string, at: string, body = 'x') =>
    ({ id, created_at: at, project_id: 'pr', item_id: 'i1', module_id: null, body, user_id: user })
  it('newest foreign comment after the read mark wins', () => {
    const cs = [c('1', 'a', '2026-11-01T10:00:00Z', 'gamalt'), c('2', 'a', '2026-11-03T10:00:00Z', 'nýtt\nlína 2')]
    expect(freshComment(cs, ps, 'i1', 'me', '2026-11-02T00:00:00Z')).toEqual({ short: 'Á', line: 'nýtt' })
  })
  it('own comment never counts, even when newest', () => {
    const cs = [c('1', 'a', '2026-11-03T10:00:00Z', 'frá Árna'), c('2', 'me', '2026-11-03T11:00:00Z', 'mitt')]
    expect(freshComment(cs, ps, 'i1', 'me', null)).toEqual({ short: 'Á', line: 'frá Árna' })
  })
  it('older than the read mark, or on another item, gives null', () => {
    const cs = [c('1', 'a', '2026-11-01T10:00:00Z'), { ...c('2', 'a', '2026-11-03T10:00:00Z'), item_id: 'other' }]
    expect(freshComment(cs, ps, 'i1', 'me', '2026-11-02T00:00:00Z')).toBeNull()
  })
  it('no read mark means every foreign comment is fresh, unknown author is ?', () => {
    const cs = [c('1', 'gone', '2026-11-01T10:00:00Z', 'hæ')]
    expect(freshComment(cs, ps, 'i1', 'me', null)).toEqual({ short: '?', line: 'hæ' })
  })
})

describe('freshLine', () => {
  const summary = (kinds: { kind: UnreadKind; n: number }[], created = false) => ({ created, kinds, latest: '2026-11-03T00:00:00Z' })
  it('created wins over everything', () => {
    expect(freshLine(summary([{ kind: 'comment', n: 1 }], true), { short: 'Á', line: 'x' })).toEqual({ kind: 'created' })
  })
  it('a fresh comment wins over other kinds', () => {
    expect(freshLine(summary([{ kind: 'file', n: 1 }, { kind: 'comment', n: 1 }]), { short: 'Á', line: 'Sjáumst' }))
      .toEqual({ kind: 'comment', short: 'Á', line: 'Sjáumst' })
  })
  it('otherwise the first three kinds and how many more', () => {
    const s = summary([{ kind: 'file', n: 1 }, { kind: 'answer', n: 1 }, { kind: 'status', n: 1 }, { kind: 'plan', n: 1 }])
    expect(freshLine(s, null)).toEqual({ kind: 'kinds', kinds: s.kinds.slice(0, 3), more: 1 })
  })
})
