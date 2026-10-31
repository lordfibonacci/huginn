import { describe, it, expect } from 'vitest'
import { filterSince, itemLine, statusMarkdown } from './format.mjs'

const C = { id: 'p-c', user_id: 'u-c', short: 'C', display_name: 'Claude', is_service: true, project_id: 'pr' }
const H = { id: 'p-h', user_id: 'u-h', short: 'H', display_name: 'Heimir', is_service: false, project_id: 'pr' }
const A = { id: 'p-a', user_id: 'u-a', short: 'Á', display_name: 'Árni', is_service: false, project_id: 'pr' }
const X = { id: 'p-x', user_id: 'u-x', short: 'X', display_name: 'Xena', is_service: false, project_id: 'pr' }
const participants = [H, A, C, X]

function item(id, status, extra = {}) {
  return {
    id,
    project_id: 'pr',
    module_id: null,
    title: `Verk ${id}`,
    status,
    waiting_on: null,
    created_by: 'u-h',
    updated_at: '2026-10-30T10:00:00+00:00',
    closed_at: null,
    tags: [],
    ...extra,
  }
}

function board(items, extra = {}) {
  return {
    project: { id: 'pr', slug: 'metta', name: 'Metta' },
    participants,
    packages: [],
    modules: [],
    items,
    plans: [],
    files: [],
    questions: [],
    actions: [],
    rulings: [],
    comments: [],
    events: [],
    reads: [],
    ...extra,
  }
}

const items = [
  item('i01', 'new', { updated_at: '2026-10-28T08:00:00+00:00' }),
  item('i02', 'waiting', { waiting_on: 'u-c', updated_at: '2026-10-31T09:00:00+00:00' }),
  item('i03', 'waiting', { waiting_on: 'u-h' }),
  item('i04', 'waiting', { waiting_on: 'u-a' }),
  item('i05', 'waiting', { waiting_on: null }),
  item('i06', 'ready'),
  item('i07', 'building'),
  item('i08', 'parked'),
  item('i09', 'done', { closed_at: '2026-10-30T10:00:00+00:00' }),
  item('i10', 'dropped', { closed_at: '2026-10-30T10:00:00+00:00' }),
  item('i11', 'waiting', { waiting_on: 'u-x' }),
  // Same group as i02: one newer, one with the same stamp as i02 to test the id tie break.
  item('i12', 'waiting', { waiting_on: 'u-c', updated_at: '2026-10-31T11:00:00+00:00' }),
  item('i00', 'waiting', { waiting_on: 'u-c', updated_at: '2026-10-31T09:00:00.000Z' }),
]

const actions = [
  { id: 'a1', item_id: 'i02', owner: 'u-h', body: 'Keyra SQL\ní ritli', done_at: null, created_at: '2026-10-31T09:00:00+00:00' },
  { id: 'a2', item_id: 'i02', owner: 'u-a', body: 'Búið handtak', done_at: '2026-10-31T10:00:00+00:00', created_at: '2026-10-31T08:00:00+00:00' },
]
const questions = [
  { id: 'q1', item_id: 'i02', asked_to: 'u-a', body: 'Hvaða litur?', answer: null, answered_at: null, created_at: '2026-10-31T09:30:00+00:00' },
  { id: 'q2', item_id: 'i02', asked_to: 'u-a', body: 'Svarað', answer: 'Blár', answered_at: '2026-10-31T09:40:00+00:00', created_at: '2026-10-31T09:10:00+00:00' },
  { id: 'q3', item_id: 'i05', asked_to: null, body: 'Opin spurning', answer: null, answered_at: null, created_at: '2026-10-31T09:30:00+00:00' },
]

const data = board(items, { actions, questions })

describe('itemLine', () => {
  it('reads tone, title, status, who and when', () => {
    expect(itemLine(items[0], participants)).toBe('[gold] Verk i01, Nýtt, frá H, 2026-10-28T08:00:00.000Z')
    expect(itemLine(items[3], participants)).toBe('[lilac] Verk i04, Bíður, bíður Á, 2026-10-30T10:00:00.000Z')
    expect(itemLine(items[1], participants)).toBe('[gold] Verk i02, Bíður, bíður C, 2026-10-31T09:00:00.000Z')
  })

  it('names the creator when the item is not waiting, even with a stale waiting_on', () => {
    expect(itemLine(item('s', 'building', { waiting_on: 'u-a' }), participants)).toBe(
      '[teal] Verk s, Í byggingu, frá H, 2026-10-30T10:00:00.000Z',
    )
  })

  it('keeps a multi line title on one line', () => {
    expect(itemLine(item('z', 'ready', { title: 'Tvær\n  línur ' }), participants)).toBe(
      '[teal] Tvær línur, Tilbúið til byggingar, frá H, 2026-10-30T10:00:00.000Z',
    )
  })
})

describe('statusMarkdown', () => {
  it('is the same string twice for the same data', () => {
    expect(statusMarkdown(data, participants)).toBe(statusMarkdown(data, participants))
  })

  it('does not depend on the order rows arrive in', () => {
    const shuffled = board([...items].reverse(), { actions: [...actions].reverse(), questions: [...questions].reverse() })
    expect(statusMarkdown(shuffled, [...participants].reverse())).toBe(statusMarkdown(data, participants))
  })

  it('groups by status and waiting_on in the fixed order', () => {
    expect(statusMarkdown(data, participants)).toBe(
      [
        '# Staða: Metta',
        '',
        '## Nýtt',
        '- [gold] Verk i01, Nýtt, frá H, 2026-10-28T08:00:00.000Z',
        '',
        '## Bíður ákvörðunar',
        '- [lilac] Verk i05, Bíður, frá H, 2026-10-30T10:00:00.000Z',
        '  - Spurning: Opin spurning',
        '',
        '## Bíður Claude',
        '- [gold] Verk i12, Bíður, bíður C, 2026-10-31T11:00:00.000Z',
        '- [gold] Verk i00, Bíður, bíður C, 2026-10-31T09:00:00.000Z',
        '- [gold] Verk i02, Bíður, bíður C, 2026-10-31T09:00:00.000Z',
        '  - Handtak, H: Keyra SQL í ritli',
        '  - Spurning til Á: Hvaða litur?',
        '',
        '## Bíður Árna',
        '- [lilac] Verk i04, Bíður, bíður Á, 2026-10-30T10:00:00.000Z',
        '',
        '## Bíður Heimis',
        '- [lilac] Verk i03, Bíður, bíður H, 2026-10-30T10:00:00.000Z',
        '',
        '## Bíður: Xena',
        '- [lilac] Verk i11, Bíður, bíður X, 2026-10-30T10:00:00.000Z',
        '',
        '## Tilbúið til byggingar',
        '- [teal] Verk i06, Tilbúið til byggingar, frá H, 2026-10-30T10:00:00.000Z',
        '',
        '## Í byggingu',
        '- [teal] Verk i07, Í byggingu, frá H, 2026-10-30T10:00:00.000Z',
        '',
        '## Í bið',
        '- [stone] Verk i08, Í bið, frá H, 2026-10-30T10:00:00.000Z',
        '',
      ].join('\n'),
    )
  })

  it('leaves out done and dropped items and says so on an empty board', () => {
    const closed = board([items[8], items[9]])
    expect(statusMarkdown(closed, participants)).toBe('# Staða: Metta\n\nEkkert opið verk.\n')
  })
})

describe('filterSince', () => {
  it('keeps items changed at or after the stamp and their rows', () => {
    const out = filterSince(data, '2026-10-31T09:00:00Z')
    expect(out.items.map((i) => i.id).sort()).toEqual(['i00', 'i02', 'i12'])
    expect(out.actions.map((a) => a.id)).toEqual(['a1', 'a2'])
    expect(out.questions.map((q) => q.id)).toEqual(['q1', 'q2'])
    expect(out.participants).toBe(data.participants)
  })
})
