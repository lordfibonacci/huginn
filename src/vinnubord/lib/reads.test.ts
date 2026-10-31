import { describe, expect, it } from 'vitest'
import { isUnread, needsReadMark } from './reads'
import type { Item, Read } from './types'

const ME = 'u-me'
const OTHER = 'u-other'

const item = (over: Partial<Item> = {}): Item => ({
  id: 'i1', created_at: null, project_id: 'p', module_id: null, title: 'T', summary: null, body: null,
  status: 'new', waiting_on: null, tags: [], pos_x: 0, pos_y: 0, source_ref: null, next_step: null,
  next_prompt: null, created_by: OTHER, updated_by: null, updated_at: '2026-10-31T10:00:00Z', closed_at: null,
  ...over,
})
const read = (over: Partial<Read> = {}): Read => ({
  project_id: 'p', item_id: 'i1', user_id: ME, read_at: '2026-10-31T10:00:00Z', ...over,
})

describe('isUnread', () => {
  it('unread when the viewer has no read row and someone else moved it last', () => {
    expect(isUnread(item(), [], ME)).toBe(true)
  })
  it('read when the viewer read it at or after the last update', () => {
    expect(isUnread(item(), [read()], ME)).toBe(false)
    expect(isUnread(item(), [read({ read_at: '2026-10-31T11:00:00Z' })], ME)).toBe(false)
  })
  it('unread again when updated after the read', () => {
    expect(isUnread(item({ updated_at: '2026-10-31T12:00:00Z' }), [read()], ME)).toBe(true)
  })
  it('compares instants, not strings', () => {
    expect(isUnread(item({ updated_at: '2026-10-31T10:00:00.5+00:00' }), [read({ read_at: '2026-10-31T10:00:01Z' })], ME)).toBe(false)
  })
  it('ignores read rows of other users and other items', () => {
    expect(isUnread(item(), [read({ user_id: OTHER }), read({ item_id: 'i2' })], ME)).toBe(true)
  })
  it('own moves never glow: updated_by, else created_by', () => {
    expect(isUnread(item({ updated_by: ME }), [], ME)).toBe(false)
    expect(isUnread(item({ created_by: ME, updated_by: null }), [], ME)).toBe(false)
    expect(isUnread(item({ created_by: ME, updated_by: OTHER }), [], ME)).toBe(true)
  })
})

describe('needsReadMark', () => {
  it('always marks when the panel opens, even on an own move', () => {
    expect(needsReadMark(item(), ME, true)).toBe(true)
    expect(needsReadMark(item({ updated_by: ME }), ME, true)).toBe(true)
  })
  it('marks a change while open only when someone else made it', () => {
    expect(needsReadMark(item({ updated_by: OTHER }), ME, false)).toBe(true)
    expect(needsReadMark(item({ updated_by: ME }), ME, false)).toBe(false)
    expect(needsReadMark(item({ created_by: ME, updated_by: null }), ME, false)).toBe(false)
  })
})
