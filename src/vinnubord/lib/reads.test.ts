import { describe, expect, it } from 'vitest'
import { freshChips, isActionFresh, isFresh, latestForeignAt, readAtOf, summarizeUnread, type UnreadSummary } from './reads'
import type { Event, Read, UnreadRow } from './types'

const ME = 'u-me'
const OTHER = 'u-other'

const read = (over: Partial<Read> = {}): Read => ({
  project_id: 'p', item_id: 'i1', user_id: ME, read_at: '2026-10-31T10:00:00Z', ...over,
})
const ev = (over: Partial<Event> = {}): Event => ({
  id: 'e1', created_at: '2026-11-01T10:00:00Z', project_id: 'p', item_id: 'i1', module_id: null,
  actor: OTHER, kind: 'item.updated', data: {}, ...over,
})

describe('summarizeUnread', () => {
  it('maps event kinds to unread kinds in UNREAD_ORDER and sets created', () => {
    const rows: UnreadRow[] = [
      { item_id: 'i1', kind: 'file.added', n: 1, latest: '2026-11-01T10:00:00Z' },
      { item_id: 'i1', kind: 'action.added', n: 2, latest: '2026-11-01T11:00:00Z' },
      { item_id: 'i1', kind: 'item.created', n: 1, latest: '2026-11-01T09:00:00Z' },
      { item_id: 'i2', kind: 'plan.added', n: 1, latest: '2026-11-01T08:00:00Z' },
      { item_id: 'i2', kind: 'plan.status', n: 2, latest: '2026-11-01T08:30:00Z' },
    ]
    const m = summarizeUnread(rows)
    expect(m.get('i1')).toEqual({ created: true, kinds: [{ kind: 'action', n: 2 }, { kind: 'file', n: 1 }], latest: '2026-11-01T11:00:00Z' })
    expect(m.get('i2')).toEqual({ created: false, kinds: [{ kind: 'plan', n: 3 }], latest: '2026-11-01T08:30:00Z' })
  })
  it('drops unknown kinds and items whose only rows are unknown', () => {
    expect(summarizeUnread([{ item_id: 'i9', kind: 'something.else', n: 4, latest: '2026-11-01T10:00:00Z' }]).size).toBe(0)
  })
  it('maps every event kind the triggers write', () => {
    const kinds = ['action.done', 'action.updated', 'action.cancelled', 'question.asked', 'question.answered', 'comment.added', 'item.status', 'ruling.added', 'analysis.done', 'analysis.failed', 'item.updated']
    const m = summarizeUnread(kinds.map((kind, i) => ({ item_id: `i${i}`, kind, n: 1, latest: '2026-11-01T10:00:00Z' })))
    expect([...m.values()].map((s) => s.kinds[0].kind)).toEqual(['actionDone', 'actionEdited', 'actionCancelled', 'question', 'answer', 'comment', 'status', 'ruling', 'analysis', 'analysisFailed', 'text'])
  })
  it('orders edited and cancelled actions right after done ones', () => {
    const rows: UnreadRow[] = [
      { item_id: 'i1', kind: 'question.asked', n: 1, latest: '2026-11-01T10:00:00Z' },
      { item_id: 'i1', kind: 'action.cancelled', n: 1, latest: '2026-11-01T10:00:00Z' },
      { item_id: 'i1', kind: 'action.updated', n: 2, latest: '2026-11-01T10:00:00Z' },
      { item_id: 'i1', kind: 'action.done', n: 1, latest: '2026-11-01T10:00:00Z' },
      { item_id: 'i1', kind: 'action.added', n: 1, latest: '2026-11-01T10:00:00Z' },
    ]
    expect(summarizeUnread(rows).get('i1')?.kinds.map((k) => k.kind)).toEqual(['action', 'actionDone', 'actionEdited', 'actionCancelled', 'question'])
  })
  it('compares latest as instants, not strings', () => {
    const m = summarizeUnread([
      { item_id: 'i1', kind: 'file.added', n: 1, latest: '2026-11-01T10:00:00.5+00:00' },
      { item_id: 'i1', kind: 'action.added', n: 1, latest: '2026-11-01T10:00:01Z' },
    ])
    expect(m.get('i1')?.latest).toBe('2026-11-01T10:00:01Z')
  })
})

describe('freshChips', () => {
  it('a created item shows only that, whatever else is unread', () => {
    expect(freshChips({ created: true, kinds: [{ kind: 'action', n: 3 }, { kind: 'analysis', n: 1 }], latest: '' })).toEqual({ created: true })
  })
  it('shows at most max kinds in order and counts the rest', () => {
    const s: UnreadSummary = { created: false, kinds: [{ kind: 'action', n: 2 }, { kind: 'file', n: 1 }, { kind: 'status', n: 1 }, { kind: 'text', n: 1 }], latest: '' }
    expect(freshChips(s)).toEqual({ created: false, shown: s.kinds.slice(0, 3), more: 1 })
    expect(freshChips(s, 2)).toEqual({ created: false, shown: s.kinds.slice(0, 2), more: 2 })
  })
})

describe('isFresh', () => {
  it('fresh when another author wrote it after the read mark, or there is no mark', () => {
    expect(isFresh('2026-11-01T10:00:00Z', OTHER, '2026-11-01T09:00:00Z', ME)).toBe(true)
    expect(isFresh('2026-11-01T10:00:00Z', OTHER, null, ME)).toBe(true)
    expect(isFresh('2026-11-01T10:00:00Z', null, null, ME)).toBe(true)
  })
  it('not fresh when read later, by the viewer, or without a time', () => {
    expect(isFresh('2026-11-01T10:00:00Z', OTHER, '2026-11-01T10:00:00Z', ME)).toBe(false)
    expect(isFresh('2026-11-01T10:00:00Z', ME, null, ME)).toBe(false)
    expect(isFresh(null, OTHER, null, ME)).toBe(false)
  })
})

describe('isActionFresh', () => {
  const fresh = (at: string | null, by: string | null) => isFresh(at, by, '2026-11-01T09:00:00Z', ME)
  const act = { created_at: '2026-11-01T08:00:00Z', created_by: OTHER, updated_at: null, updated_by: null }
  it('fresh when added or changed by someone else after the read mark', () => {
    expect(isActionFresh({ ...act, created_at: '2026-11-01T10:00:00Z' }, fresh)).toBe(true)
    expect(isActionFresh({ ...act, updated_at: '2026-11-01T10:00:00Z', updated_by: OTHER }, fresh)).toBe(true)
  })
  it('not fresh when old, or changed by the viewer', () => {
    expect(isActionFresh(act, fresh)).toBe(false)
    expect(isActionFresh({ ...act, updated_at: '2026-11-01T10:00:00Z', updated_by: ME }, fresh)).toBe(false)
  })
})

describe('readAtOf and latestForeignAt', () => {
  it('readAtOf finds the viewer mark on the item only', () => {
    expect(readAtOf([read(), read({ user_id: OTHER, read_at: '2030-01-01T00:00:00Z' })], 'i1', ME)).toBe('2026-10-31T10:00:00Z')
    expect(readAtOf([read()], 'i2', ME)).toBeNull()
  })
  it('latestForeignAt is the newest event on the item by someone else, null actor included', () => {
    const events = [ev({ created_at: '2026-11-01T10:00:00Z', actor: ME }), ev({ created_at: '2026-11-01T09:00:00Z', actor: OTHER }), ev({ created_at: '2026-11-01T09:30:00Z', actor: null }), ev({ item_id: 'i2', created_at: '2026-11-01T12:00:00Z', actor: OTHER })]
    expect(latestForeignAt(events, 'i1', ME)).toBe('2026-11-01T09:30:00Z')
    expect(latestForeignAt([ev({ actor: ME })], 'i1', ME)).toBeNull()
  })
})
