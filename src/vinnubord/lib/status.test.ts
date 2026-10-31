import { describe, it, expect } from 'vitest'
import {
  BUCKET_TONE,
  countBucket,
  countsFor,
  isOnBoard,
  itemStatusLabel,
  itemTone,
  waitsFor,
  wireMode,
} from './status'
import type { Item, Participant, Action } from './types'

const ME = 'u-me'
const OTHER = 'u-other'
const SVC = 'u-claude'

const participants: Participant[] = [
  { id: 'p1', created_at: null, project_id: 'pr', user_id: ME, display_name: 'Heimir', short: 'H', is_service: false },
  { id: 'p2', created_at: null, project_id: 'pr', user_id: OTHER, display_name: 'Árni', short: 'Á', is_service: false },
  { id: 'p3', created_at: null, project_id: 'pr', user_id: SVC, display_name: 'Claude', short: 'C', is_service: true },
]

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'i1', created_at: null, project_id: 'pr', module_id: null, title: 'T', summary: null, body: null,
    status: 'new', waiting_on: null, tags: [], pos_x: 0, pos_y: 0, source_ref: null, next_step: null,
    next_prompt: null, created_by: OTHER, updated_by: null, updated_at: '2026-01-01T00:00:00Z', closed_at: null,
    ...over,
  }
}

function action(over: Partial<Action> = {}): Action {
  return {
    id: 'a1', created_at: null, project_id: 'pr', item_id: 'i1', body: 'x', owner: ME, payload: null,
    done_at: null, done_by: null, ...over,
  }
}

describe('itemTone', () => {
  it('new is gold', () => {
    expect(itemTone(item({ status: 'new' }), ME, participants)).toBe('gold')
  })
  it('waiting on viewer is coral', () => {
    expect(itemTone(item({ status: 'waiting', waiting_on: ME }), ME, participants)).toBe('coral')
  })
  it('same item for the other viewer is lilac', () => {
    expect(itemTone(item({ status: 'waiting', waiting_on: ME }), OTHER, participants)).toBe('lilac')
  })
  it('waiting on service is gold', () => {
    expect(itemTone(item({ status: 'waiting', waiting_on: SVC }), ME, participants)).toBe('gold')
  })
  it('ready and building are teal', () => {
    expect(itemTone(item({ status: 'ready' }), ME, participants)).toBe('teal')
    expect(itemTone(item({ status: 'building' }), ME, participants)).toBe('teal')
  })
  it('parked, done, dropped are stone', () => {
    expect(itemTone(item({ status: 'parked' }), ME, participants)).toBe('stone')
    expect(itemTone(item({ status: 'done' }), ME, participants)).toBe('stone')
    expect(itemTone(item({ status: 'dropped' }), ME, participants)).toBe('stone')
  })
})

describe('itemStatusLabel', () => {
  it('new shows creator short, with fallback', () => {
    expect(itemStatusLabel(item({ status: 'new', created_by: OTHER }), ME, participants)).toBe('Nýtt frá Á')
    expect(itemStatusLabel(item({ status: 'new', created_by: 'nobody' }), ME, participants)).toBe('Nýtt frá ?')
  })
  it('waiting labels', () => {
    expect(itemStatusLabel(item({ status: 'waiting', waiting_on: ME }), ME, participants)).toBe('Bíður þín')
    expect(itemStatusLabel(item({ status: 'waiting', waiting_on: OTHER }), ME, participants)).toBe('Bíður Árni')
    expect(itemStatusLabel(item({ status: 'waiting', waiting_on: SVC }), ME, participants)).toBe('Svarað, bíður Claude')
  })
  it('other statuses', () => {
    expect(itemStatusLabel(item({ status: 'ready' }), ME, participants)).toBe('Tilbúið til byggingar')
    expect(itemStatusLabel(item({ status: 'building' }), ME, participants)).toBe('Í byggingu')
    expect(itemStatusLabel(item({ status: 'parked' }), ME, participants)).toBe('Í bið')
    expect(itemStatusLabel(item({ status: 'done' }), ME, participants)).toBe('Lokið')
    expect(itemStatusLabel(item({ status: 'dropped' }), ME, participants)).toBe('Hætt við')
  })
})

describe('isOnBoard and waitsFor', () => {
  it('done and dropped are off board', () => {
    expect(isOnBoard(item({ status: 'done' }))).toBe(false)
    expect(isOnBoard(item({ status: 'dropped' }))).toBe(false)
    expect(isOnBoard(item({ status: 'parked' }))).toBe(true)
  })
  it('waitsFor by waiting_on or open owned action', () => {
    expect(waitsFor(item({ waiting_on: ME }), [], ME)).toBe(true)
    expect(waitsFor(item(), [action()], ME)).toBe(true)
    expect(waitsFor(item(), [action({ done_at: '2026-01-01T00:00:00Z' })], ME)).toBe(false)
    expect(waitsFor(item(), [action({ owner: OTHER })], ME)).toBe(false)
    expect(waitsFor(item(), [action({ item_id: 'other' })], ME)).toBe(false)
  })
})

describe('countsFor', () => {
  it('counts an open action owned by viewer into mine', () => {
    const items = [
      item({ id: 'i1', status: 'ready' }),
      item({ id: 'i2', status: 'new' }),
      item({ id: 'i3', status: 'waiting', waiting_on: OTHER }),
      item({ id: 'i4', status: 'building' }),
      item({ id: 'i5', status: 'parked' }),
      item({ id: 'i6', status: 'done' }),
    ]
    const c = countsFor(items, [action({ item_id: 'i1' })], ME, participants)
    expect(c).toEqual({ new: 1, mine: 1, others: 1, build: 1, parked: 1 })
  })
})

describe('countBucket', () => {
  it('puts each on board item in exactly the bucket countsFor counts', () => {
    const acts = [action({ item_id: 'i1' })]
    expect(countBucket(item({ id: 'i1', status: 'ready' }), acts, ME)).toBe('mine')
    expect(countBucket(item({ id: 'i2', status: 'new' }), acts, ME)).toBe('new')
    expect(countBucket(item({ id: 'i3', status: 'waiting', waiting_on: OTHER }), acts, ME)).toBe('others')
    expect(countBucket(item({ id: 'i4', status: 'building' }), acts, ME)).toBe('build')
    expect(countBucket(item({ id: 'i5', status: 'ready' }), acts, ME)).toBe('build')
    expect(countBucket(item({ id: 'i6', status: 'parked' }), acts, ME)).toBe('parked')
  })
  it('waiting on the service user counts as others, waiting on viewer as mine', () => {
    expect(countBucket(item({ status: 'waiting', waiting_on: SVC }), [], ME)).toBe('others')
    expect(countBucket(item({ status: 'waiting', waiting_on: ME }), [], ME)).toBe('mine')
  })
  it('done and dropped have no bucket', () => {
    expect(countBucket(item({ status: 'done' }), [], ME)).toBeNull()
    expect(countBucket(item({ status: 'dropped', waiting_on: ME }), [], ME)).toBeNull()
  })
})

describe('BUCKET_TONE', () => {
  it('maps every counter bucket to its pill tone', () => {
    expect(BUCKET_TONE).toEqual({ new: 'gold', mine: 'coral', others: 'lilac', build: 'teal', parked: 'stone' })
  })
})

describe('wireMode', () => {
  it('pulse for items waiting on someone or new', () => {
    expect(wireMode(item({ status: 'new' }), 'gold')).toBe('pulse')
    expect(wireMode(item({ status: 'waiting', waiting_on: ME }), 'coral')).toBe('pulse')
    expect(wireMode(item({ status: 'waiting', waiting_on: OTHER }), 'lilac')).toBe('pulse')
  })
  it('calm for teal, parked for parked items', () => {
    expect(wireMode(item({ status: 'building' }), 'teal')).toBe('calm')
    expect(wireMode(item({ status: 'parked' }), 'stone')).toBe('parked')
  })
})
