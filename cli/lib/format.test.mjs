import { describe, it, expect } from 'vitest'
import { STATUS_NOTE, briefCounts, briefLine, filterSince, itemLine, oneLine, statusMarkdown, whoamiText } from './format.mjs'

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
    expect(itemLine(items[0], participants)).toBe('[gold] Verk i01, Nýtt, frá H, 2026-10-28T08:00:00.000Z #i01')
    expect(itemLine(items[3], participants)).toBe('[lilac] Verk i04, Bíður, bíður Á, 2026-10-30T10:00:00.000Z #i04')
    expect(itemLine(items[1], participants)).toBe('[gold] Verk i02, Bíður, bíður C, 2026-10-31T09:00:00.000Z #i02')
  })

  it('names the creator when the item is not waiting, even with a stale waiting_on', () => {
    expect(itemLine(item('s', 'building', { waiting_on: 'u-a' }), participants)).toBe(
      '[teal] Verk s, Í byggingu, frá H, 2026-10-30T10:00:00.000Z #s',
    )
  })

  it('keeps a multi line title on one line', () => {
    expect(itemLine(item('z', 'ready', { title: 'Tvær\n  línur ' }), participants)).toBe(
      '[teal] Tvær línur, Tilbúið til byggingar, frá H, 2026-10-30T10:00:00.000Z #z',
    )
  })

  it('ends with the first 8 characters of the id, so a write command can take it', () => {
    const full = item('1a2b3c4d-0000-4000-8000-000000000001', 'new', { title: 'Langt' })
    expect(itemLine(full, participants)).toBe('[gold] Langt, Nýtt, frá H, 2026-10-30T10:00:00.000Z #1a2b3c4d')
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
        'Flokkað eftir því hver á næsta leik (waiting_on). Upphafslína lotunnar telur líka verk þar sem viðkomandi á opið handtak, svo tölurnar þar geta verið hærri.',
        '',
        '## Nýtt',
        '- [gold] Verk i01, Nýtt, frá H, 2026-10-28T08:00:00.000Z #i01',
        '',
        '## Bíður ákvörðunar',
        '- [lilac] Verk i05, Bíður, frá H, 2026-10-30T10:00:00.000Z #i05',
        '  - Spurning: Opin spurning #q3',
        '',
        '## Bíður Claude',
        '- [gold] Verk i12, Bíður, bíður C, 2026-10-31T11:00:00.000Z #i12',
        '- [gold] Verk i00, Bíður, bíður C, 2026-10-31T09:00:00.000Z #i00',
        '- [gold] Verk i02, Bíður, bíður C, 2026-10-31T09:00:00.000Z #i02',
        '  - Handtak, H: Keyra SQL í ritli #a1',
        '  - Spurning til Á: Hvaða litur? #q1',
        '',
        '## Bíður Árna',
        '- [lilac] Verk i04, Bíður, bíður Á, 2026-10-30T10:00:00.000Z #i04',
        '',
        '## Bíður Heimis',
        '- [lilac] Verk i03, Bíður, bíður H, 2026-10-30T10:00:00.000Z #i03',
        '',
        '## Bíður: Xena',
        '- [lilac] Verk i11, Bíður, bíður X, 2026-10-30T10:00:00.000Z #i11',
        '',
        '## Tilbúið til byggingar',
        '- [teal] Verk i06, Tilbúið til byggingar, frá H, 2026-10-30T10:00:00.000Z #i06',
        '',
        '## Í byggingu',
        '- [teal] Verk i07, Í byggingu, frá H, 2026-10-30T10:00:00.000Z #i07',
        '',
        '## Í bið',
        '- [stone] Verk i08, Í bið, frá H, 2026-10-30T10:00:00.000Z #i08',
        '',
      ].join('\n'),
    )
  })

  it('leaves out done and dropped items and says so on an empty board', () => {
    const closed = board([items[8], items[9]])
    expect(statusMarkdown(closed, participants)).toBe('# Staða: Metta\n\nEkkert opið verk.\n')
  })
})

describe('control characters from the database', () => {
  const NASTY = 'Ill\x1b[31m\n## fake\x9b\x07\x7f\u0085end'
  const CONTROL = /[\u0000-\u001f\u007f-\u009f]/

  it('oneLine strips C0, DEL and C1 and keeps one line', () => {
    expect(oneLine(NASTY)).toBe('Ill[31m ## fakeend')
    expect(oneLine('a \x1b b')).toBe('a b')
  })

  it('a title and a display_name render as clean single lines', () => {
    const evil = { id: 'p-e', user_id: 'u-e', short: 'E\x1b', display_name: `Eve${NASTY}`, is_service: false }
    const ps = [...participants, evil]
    const nasty = item('n1', 'waiting', { title: `Verk${NASTY}`, waiting_on: 'u-e' })
    const md = statusMarkdown(board([nasty], { participants: ps }), ps)
    expect(md).toBe(
      [
        '# Staða: Metta',
        '',
        STATUS_NOTE,
        '',
        '## Bíður: EveIll[31m ## fakeend',
        '- [lilac] VerkIll[31m ## fakeend, Bíður, bíður E, 2026-10-30T10:00:00.000Z #n1',
        '',
      ].join('\n'),
    )
    for (const line of md.split('\n')) expect(line).not.toMatch(CONTROL)
    expect(md.split('\n').filter((l) => l.startsWith('#'))).toHaveLength(2)
  })

  it('whoamiText cleans every database string', () => {
    const text = whoamiText(
      { email: `c@h.is${NASTY}` },
      { slug: `metta${NASTY}`, name: `Metta${NASTY}` },
      { display_name: `Claude${NASTY}`, short: 'C\x9b', is_service: true },
    )
    const lines = text.split('\n')
    expect(lines).toEqual([
      'c@h.isIll[31m ## fakeend',
      'Verkefni: MettaIll[31m ## fakeend (mettaIll[31m ## fakeend)',
      'Þátttakandi: ClaudeIll[31m ## fakeend (C), þjónustunotandi',
    ])
    for (const line of lines) expect(line).not.toMatch(CONTROL)
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

describe('briefCounts and briefLine', () => {
  it('counts per participant by waitsFor: on board and waiting_on, or an open owned action', () => {
    // i02 waits on C and H owns its open action a1; a2 for Á is done. i09 is done
    // and i10 dropped, so their waiting_on and actions do not count.
    const extra = [
      { id: 'a3', item_id: 'i09', owner: 'u-a', body: 'Lokað verk', done_at: null, created_at: '2026-10-31T09:00:00+00:00' },
      { id: 'a4', item_id: 'i03', owner: 'u-h', body: 'Sama verk tvisvar', done_at: null, created_at: '2026-10-31T09:00:00+00:00' },
    ]
    const closedWaiting = item('i13', 'done', { waiting_on: 'u-a', closed_at: '2026-10-30T10:00:00+00:00' })
    const d = board([...items, closedWaiting], { actions: [...actions, ...extra], questions })
    expect(briefCounts(d, participants)).toEqual([
      { short: 'C', display_name: 'Claude', count: 3 },
      { short: 'Á', display_name: 'Árni', count: 1 },
      { short: 'H', display_name: 'Heimir', count: 2 },
      { short: 'X', display_name: 'Xena', count: 1 },
    ])
  })

  it('lists every participant, zero included, in the statusMarkdown order', () => {
    const counts = briefCounts(board([], {}), [...participants].reverse())
    expect(counts.map((c) => [c.short, c.count])).toEqual([
      ['C', 0],
      ['Á', 0],
      ['H', 0],
      ['X', 0],
    ])
  })

  it('briefLine is one deterministic line with genitive names and a fallback', () => {
    const counts = [
      { short: 'C', display_name: 'Claude', count: 3 },
      { short: 'Á', display_name: 'Árni', count: 1 },
      { short: 'H', display_name: 'Heimir', count: 0 },
      { short: 'X', display_name: 'Xena' + String.fromCharCode(10) + 'Ný lína' + String.fromCharCode(27), count: 2 },
    ]
    expect(briefLine(counts)).toBe('Huginn: 3 bíða Claude, 1 bíða Árna, 0 bíða Heimis, 2 bíða: Xena Ný lína')
    expect(briefLine(counts)).toBe(briefLine(counts))
  })

  it('briefLine on a project without participants', () => {
    expect(briefLine([])).toBe('Huginn: enginn þátttakandi.')
  })
})
