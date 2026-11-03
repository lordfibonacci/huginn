import { describe, it, expect, vi } from 'vitest'
import { chatRows, latestForeignCommentAt } from './chat'
import { formatDay } from '../../shared/lib/dateUtils'
import type { Comment, Participant } from './types'

// formatDay reads i18n; a stub keeps the test free of the browser language detector.
vi.mock('../../shared/i18n', () => ({ default: { language: 'en', t: (key: string) => key } }))

const ps: Participant[] = [
  { id: 'p1', created_at: null, project_id: 'pr', user_id: 'me', display_name: 'Heimir', short: 'H', is_service: false },
  { id: 'p2', created_at: null, project_id: 'pr', user_id: 'a', display_name: 'Árni', short: 'Á', is_service: false },
  { id: 'p3', created_at: null, project_id: 'pr', user_id: 'c', display_name: 'Claude', short: 'C', is_service: true },
]
const c = (id: string, user: string, at: string, body = id): Comment =>
  ({ id, created_at: at, project_id: 'pr', item_id: 'i1', module_id: null, body, user_id: user })
const never = () => false

describe('chatRows', () => {
  it('orders by time, one day row per day, who by viewer and service', () => {
    const rows = chatRows([c('2', 'me', '2026-10-31T11:42:00Z'), c('1', 'a', '2026-10-31T11:20:00Z'), c('3', 'c', '2026-11-03T16:05:00Z')], ps, 'i1', 'me', never)
    expect(rows.map((r) => r.type)).toEqual(['day', 'message', 'message', 'day', 'message'])
    expect(rows.filter((r) => r.type === 'message').map((r) => r.type === 'message' && r.who)).toEqual(['them', 'me', 'claude'])
  })
  it('puts one new row before the first fresh message', () => {
    const fresh = (at: string | null) => at !== null && at >= '2026-11-02'
    const rows = chatRows([c('1', 'a', '2026-11-01T10:00:00Z'), c('2', 'a', '2026-11-03T10:00:00Z'), c('3', 'a', '2026-11-03T11:00:00Z')], ps, 'i1', 'me', fresh)
    expect(rows.map((r) => r.type)).toEqual(['day', 'message', 'day', 'new', 'message', 'message'])
    expect(rows.filter((r) => r.type === 'new')).toHaveLength(1)
  })
  it('skips other items, unknown author is them with ?', () => {
    const rows = chatRows([{ ...c('1', 'a', '2026-11-01T10:00:00Z'), item_id: 'x' }, c('2', 'gone', '2026-11-01T10:00:00Z')], ps, 'i1', 'me', never)
    expect(rows).toHaveLength(2)
    expect(rows[1]).toMatchObject({ who: 'them', short: '?', name: '?' })
  })
  it('a null created_at sorts first and gets no day row of its own', () => {
    const rows = chatRows([{ ...c('1', 'a', '2026-11-01T10:00:00Z'), created_at: null }, c('2', 'a', '2026-11-01T10:00:00Z')], ps, 'i1', 'me', never)
    expect(rows.map((r) => r.type)).toEqual(['message', 'day', 'message'])
  })
})

describe('latestForeignCommentAt', () => {
  it('newest comment on the item by someone else, null when none', () => {
    const cs = [c('1', 'a', '2026-11-01T10:00:00Z'), c('2', 'me', '2026-11-03T10:00:00Z'), { ...c('3', 'a', '2026-11-04T10:00:00Z'), item_id: 'x' }]
    expect(latestForeignCommentAt(cs, 'i1', 'me')).toBe('2026-11-01T10:00:00Z')
    expect(latestForeignCommentAt(cs, 'y', 'me')).toBeNull()
  })
})

describe('formatDay', () => {
  // Local noon, so the local day never shifts with the time zone.
  const now = new Date(2026, 10, 3, 12, 0)
  it('today and yesterday by name, no time', () => {
    expect(formatDay(new Date(2026, 10, 3, 8, 5).toISOString(), now)).toBe('dates.today')
    expect(formatDay(new Date(2026, 10, 2, 23, 30).toISOString(), now)).toBe('dates.yesterday')
  })
  it('an older day is day and month, with the year only in another year', () => {
    expect(formatDay(new Date(2026, 9, 30, 9, 0).toISOString(), now)).toBe('October 30')
    expect(formatDay(new Date(2025, 9, 30, 9, 0).toISOString(), now)).toBe('October 30, 2025')
  })
  it('an invalid date is empty', () => {
    expect(formatDay('nope', now)).toBe('')
  })
})
