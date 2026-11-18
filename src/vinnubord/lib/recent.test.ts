import { describe, it, expect } from 'vitest'
import { DEFAULT_RECENT_HOURS, RECENT_HOURS, RECENT_KEY, isRecent, lastChangeByItem, parseRecentHours } from './recent'
import type { Action, Comment, FileRow, Item, Plan, Question, Ruling } from './types'

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'i1', created_at: '2026-11-01T00:00:00Z', project_id: 'pr', module_id: null, title: 'Item', summary: null,
    body: null, status: 'new', waiting_on: null, tags: [], keywords: [], pos_x: 0, pos_y: 0, source_ref: null,
    next_step: null, next_prompt: null, created_by: 'u', updated_by: null,
    updated_at: '2026-11-02T00:00:00Z', closed_at: null, ...over,
  }
}
const comment = (over: Partial<Comment>): Comment => ({
  id: 'c', created_at: null, project_id: 'pr', item_id: 'i1', module_id: null, body: 'x', user_id: 'u', ...over,
})
const file = (over: Partial<FileRow>): FileRow => ({
  id: 'f', created_at: null, project_id: 'pr', item_id: 'i1', name: 'a.md', storage_path: 'p', size: 1, mime: null,
  repo_path: null, note: null, uploaded_by: 'u', updated_at: null, updated_by: null, ...over,
})
const question = (over: Partial<Question>): Question => ({
  id: 'q', created_at: null, project_id: 'pr', item_id: 'i1', body: 'x', asked_by: 'u', asked_to: null, answer: null,
  answered_by: null, answered_at: null, ...over,
})
const action = (over: Partial<Action>): Action => ({
  id: 'a', created_at: null, project_id: 'pr', item_id: 'i1', body: 'x', owner: 'u', created_by: null, payload: null,
  done_at: null, done_by: null, updated_at: null, updated_by: null, cancelled: false, cancel_reason: null, ...over,
})
const plan = (over: Partial<Plan>): Plan => ({
  id: 'pl', created_at: null, project_id: 'pr', item_id: 'i1', name: 'P', path: null, status: 'todo', position: 0,
  updated_at: '2026-11-01T00:00:00Z', ...over,
})
const ruling = (over: Partial<Ruling>): Ruling => ({
  id: 'r', created_at: null, project_id: 'pr', plan_id: 'pl', code: 'R1', body: 'x', cost: null, reversed: false, ...over,
})

const none = { comments: [], files: [], questions: [], actions: [], plans: [], rulings: [] }
const at = (iso: string) => Date.parse(iso)
const LATE = '2026-11-10T08:00:00Z'

describe('lastChangeByItem', () => {
  it('an item alone is the later of created_at and updated_at', () => {
    expect(lastChangeByItem({ ...none, items: [item()] }).get('i1')).toBe(at('2026-11-02T00:00:00Z'))
    const born = item({ created_at: '2026-11-05T00:00:00Z', updated_at: '2026-11-02T00:00:00Z' })
    expect(lastChangeByItem({ ...none, items: [born] }).get('i1')).toBe(at('2026-11-05T00:00:00Z'))
  })
  it('every kind of thing on the item moves it', () => {
    const cases = [
      { comments: [comment({ created_at: LATE })] },
      { files: [file({ created_at: LATE })] },
      { files: [file({ created_at: '2026-11-01T00:00:00Z', updated_at: LATE })] },
      { questions: [question({ created_at: LATE })] },
      { questions: [question({ created_at: '2026-11-01T00:00:00Z', answered_at: LATE })] },
      { actions: [action({ created_at: LATE })] },
      { actions: [action({ created_at: '2026-11-01T00:00:00Z', done_at: LATE })] },
      { actions: [action({ created_at: '2026-11-01T00:00:00Z', updated_at: LATE })] },
      { plans: [plan({ created_at: LATE })] },
      { plans: [plan({ updated_at: LATE })] },
      { plans: [plan({})], rulings: [ruling({ created_at: LATE })] },
    ]
    for (const [n, extra] of cases.entries()) {
      expect(lastChangeByItem({ ...none, items: [item()], ...extra }).get('i1'), `case ${n}`).toBe(at(LATE))
    }
  })
  it('an older thing on the item never moves it back', () => {
    const data = { ...none, items: [item()], comments: [comment({ created_at: '2026-10-01T00:00:00Z' })] }
    expect(lastChangeByItem(data).get('i1')).toBe(at('2026-11-02T00:00:00Z'))
  })
  it('the newest wins by time across stamp forms, not by string order', () => {
    // 09:00 at +01:00 is 08:00 UTC: later as a string, earlier in time.
    const data = {
      ...none,
      items: [item({ updated_at: '2026-11-10T09:00:00+01:00' })],
      comments: [comment({ created_at: '2026-11-10T08:30:00.123456+00:00' })],
      actions: [action({ created_at: '2026-11-10T08:15:00Z' })],
    }
    expect(lastChangeByItem(data).get('i1')).toBe(at('2026-11-10T08:30:00.123456+00:00'))
  })
  it('ignores a module comment, a row of an item that is not loaded and a ruling of an unknown plan', () => {
    const data = {
      ...none,
      items: [item()],
      comments: [comment({ item_id: null, module_id: 'm1', created_at: LATE }), comment({ item_id: 'gone', created_at: LATE })],
      files: [file({ item_id: 'gone', created_at: LATE })],
      rulings: [ruling({ plan_id: 'nope', created_at: LATE })],
    }
    const map = lastChangeByItem(data)
    expect(map.get('i1')).toBe(at('2026-11-02T00:00:00Z'))
    expect([...map.keys()]).toEqual(['i1'])
  })
  it('null and unparsable stamps are skipped, an item with none is 0', () => {
    const blank = item({ created_at: null, updated_at: 'nope' })
    expect(lastChangeByItem({ ...none, items: [blank], comments: [comment({ created_at: 'x' })] }).get('i1')).toBe(0)
  })
})

describe('isRecent', () => {
  const now = at('2026-11-18T12:00:00Z')
  it('is inside the window, the edge included', () => {
    expect(isRecent(at('2026-11-18T11:00:00Z'), now, 24)).toBe(true)
    expect(isRecent(at('2026-11-17T12:00:00Z'), now, 24)).toBe(true)
    expect(isRecent(at('2026-11-17T11:59:59Z'), now, 24)).toBe(false)
    expect(isRecent(at('2026-11-15T12:00:00Z'), now, 72)).toBe(true)
    expect(isRecent(at('2026-11-11T12:00:00Z'), now, 168)).toBe(true)
    expect(isRecent(at('2026-11-11T11:00:00Z'), now, 168)).toBe(false)
  })
  it('a stamp ahead of the browser clock counts, an item with no stamp never does', () => {
    expect(isRecent(at('2026-11-18T12:00:05Z'), now, 24)).toBe(true)
    expect(isRecent(0, now, 168)).toBe(false)
  })
})

describe('the window', () => {
  it('has three choices, 72 hours by default, one key for every project', () => {
    expect([...RECENT_HOURS]).toEqual([24, 72, 168])
    expect(DEFAULT_RECENT_HOURS).toBe(72)
    expect(RECENT_KEY).toBe('hg.recent')
  })
  it('parses a stored choice and falls back to the default', () => {
    expect(parseRecentHours('24')).toBe(24)
    expect(parseRecentHours('72')).toBe(72)
    expect(parseRecentHours('168')).toBe(168)
    for (const raw of [null, '', 'abc', '48', '72.5', '-24', '{}']) expect(parseRecentHours(raw), String(raw)).toBe(72)
  })
})
