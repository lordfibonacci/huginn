import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatStamp, formatStampShort } from './dateUtils'

// dateUtils reads i18n; a stub keeps the test free of the browser language detector.
// It is hoisted and mutable so one case can switch the language.
const i18nStub = vi.hoisted(() => ({ language: 'en', t: (key: string) => key }))
vi.mock('../i18n', () => ({ default: i18nStub }))

// Local noon, so the local day never shifts with the time zone.
const now = new Date(2026, 10, 13, 12, 0)
const at = (y: number, m: number, d: number, h: number, min: number) => new Date(y, m, d, h, min).toISOString()

describe('formatStamp', () => {
  it('today and yesterday by name, with the clock', () => {
    expect(formatStamp(at(2026, 10, 13, 8, 5), now)).toBe('dates.today 08:05')
    expect(formatStamp(at(2026, 10, 12, 14, 32), now)).toBe('dates.yesterday 14:32')
    expect(formatStamp(at(2026, 10, 12, 0, 5), now)).toBe('dates.yesterday 00:05')
  })
  it('an older day is the date with the clock, the year only in another year', () => {
    expect(formatStamp(at(2026, 10, 11, 23, 59), now)).toBe('November 11, 23:59')
    expect(formatStamp(at(2025, 9, 30, 16, 5), now)).toBe('October 30, 2025, 16:05')
  })
  it('just after midnight, a minute ago is yesterday', () => {
    const justAfter = new Date(2026, 10, 13, 0, 1)
    expect(formatStamp(at(2026, 10, 12, 23, 59), justAfter)).toBe('dates.yesterday 23:59')
    expect(formatStamp(at(2026, 10, 13, 0, 0), justAfter)).toBe('dates.today 00:00')
  })
  it('yesterday across a month and a year boundary', () => {
    expect(formatStamp(at(2026, 9, 31, 9, 0), new Date(2026, 10, 1, 12, 0))).toBe('dates.yesterday 09:00')
    expect(formatStamp(at(2025, 11, 31, 9, 0), new Date(2026, 0, 1, 12, 0))).toBe('dates.yesterday 09:00')
  })
  it('an invalid date is empty', () => {
    expect(formatStamp('nope', now)).toBe('')
  })
})

describe('formatStampShort', () => {
  it('the clock today and yesterday', () => {
    expect(formatStampShort(at(2026, 10, 13, 8, 5), now)).toBe('dates.today 08:05')
    expect(formatStampShort(at(2026, 10, 12, 14, 32), now)).toBe('dates.yesterday 14:32')
  })
  it('an older day is the date alone', () => {
    expect(formatStampShort(at(2026, 10, 11, 23, 59), now)).toBe('November 11')
    expect(formatStampShort(at(2025, 9, 30, 16, 5), now)).toBe('October 30, 2025')
  })
  it('an invalid date is empty', () => {
    expect(formatStampShort('nope', now)).toBe('')
  })
})

describe('stamps in Icelandic', () => {
  afterEach(() => {
    i18nStub.language = 'en'
  })
  it('the date part follows the active language', () => {
    i18nStub.language = 'is'
    expect(formatStamp(at(2026, 10, 11, 23, 59), now)).toBe('11. nóvember, 23:59')
    expect(formatStamp(at(2025, 9, 30, 16, 5), now)).toBe('30. október 2025, 16:05')
    expect(formatStampShort(at(2025, 9, 30, 16, 5), now)).toBe('30. október 2025')
  })
})
