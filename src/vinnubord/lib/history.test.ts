import { describe, expect, it } from 'vitest'
import { describeEvent, itemHistory } from './history'
import type { Comment, Event } from './types'

function ev(id: string, at: string | null, kind: string, data: Record<string, unknown> = {}, itemId = 'i1'): Event {
  return { id, created_at: at, project_id: 'p', item_id: itemId, module_id: null, actor: 'u1', kind, data }
}

function cm(id: string, at: string | null, body: string, itemId: string | null = 'i1'): Comment {
  return { id, created_at: at, project_id: 'p', item_id: itemId, module_id: null, body, user_id: 'u2' }
}

describe('itemHistory', () => {
  it('merges events and comments of one item in time order', () => {
    const events = [ev('e2', '2026-10-31T12:00:00Z', 'item.status'), ev('e1', '2026-10-31T10:00:00Z', 'item.created')]
    const comments = [cm('c1', '2026-10-31T11:00:00Z', 'hæ')]
    const out = itemHistory(events, comments, 'i1')
    expect(out.map((e) => e.id)).toEqual(['e1', 'c1', 'e2'])
    expect(out[1]).toMatchObject({ type: 'comment', actor: 'u2' })
    expect(out[0]).toMatchObject({ type: 'event', actor: 'u1' })
  })

  it('leaves out other items and comment.added events, the comment itself shows', () => {
    const events = [
      ev('e1', '2026-10-31T10:00:00Z', 'item.created'),
      ev('e2', '2026-10-31T11:00:00Z', 'comment.added'),
      ev('e3', '2026-10-31T11:00:00Z', 'item.created', {}, 'other'),
    ]
    const comments = [cm('c1', '2026-10-31T11:00:00Z', 'hæ'), cm('c2', '2026-10-31T11:00:00Z', 'x', 'other')]
    expect(itemHistory(events, comments, 'i1').map((e) => e.id)).toEqual(['e1', 'c1'])
  })

  it('keeps input order on equal times and puts missing times first', () => {
    const events = [ev('e1', '2026-10-31T10:00:00Z', 'a'), ev('e2', '2026-10-31T10:00:00Z', 'b'), ev('e0', null, 'c')]
    expect(itemHistory(events, [], 'i1').map((e) => e.id)).toEqual(['e0', 'e1', 'e2'])
  })
})

describe('describeEvent', () => {
  const nameOf = (id: string | null) => (id === 'h' ? 'Heimir' : id === 'a' ? 'Árni' : '?')

  it('describes a status move with Icelandic status names', () => {
    expect(describeEvent(ev('e', null, 'item.status', { from: 'new', to: 'ready' }), nameOf)).toEqual({
      key: 'itemStatus',
      params: { from: 'Nýtt', to: 'Tilbúið til byggingar' },
      fields: [],
    })
  })

  it('names who an item now waits on', () => {
    const e = ev('e', null, 'item.status', { from: 'waiting', to: 'waiting', waiting_on: 'a', waiting_on_from: 'h' })
    expect(describeEvent(e, nameOf)).toEqual({ key: 'itemWaiting', params: { who: 'Árni' }, fields: [] })
  })

  it('lists the changed fields of an update', () => {
    const e = ev('e', null, 'item.updated', { fields: ['summary', 'next_step'] })
    expect(describeEvent(e, nameOf)).toEqual({ key: 'itemUpdated', params: {}, fields: ['summary', 'next_step'] })
  })

  it('lists the changed fields of an action and names a cancel', () => {
    const e = ev('e', null, 'action.updated', { fields: ['body', 'owner'] })
    expect(describeEvent(e, nameOf)).toEqual({ key: 'actionUpdated', params: {}, fields: ['body', 'owner'] })
    expect(describeEvent(ev('e', null, 'action.updated', { fields: 'body' }), nameOf).fields).toEqual([])
    expect(describeEvent(ev('e', null, 'action.cancelled', { reason: 'prófun' }), nameOf).key).toBe('actionCancelled')
  })

  it('names the added file and the plan status', () => {
    expect(describeEvent(ev('e', null, 'file.added', { name: 'spec.md' }), nameOf).params).toEqual({ name: 'spec.md' })
    expect(describeEvent(ev('e2', null, 'file.updated', { name: 'spec.md', file_id: 'f1' }), nameOf)).toMatchObject({ key: 'fileUpdated', params: { name: 'spec.md' } })
    expect(describeEvent(ev('e', null, 'plan.status', { from: 'todo', to: 'done' }), nameOf)).toEqual({
      key: 'planStatus',
      params: { to: 'Lokið' },
      fields: [],
    })
  })

  it('passes the reason of a failed analysis, and uses the bare line without one', () => {
    expect(describeEvent(ev('e', null, 'analysis.failed', { error: ' API 529 ', stage: 'before_write' }), nameOf)).toEqual({
      key: 'analysisFailed',
      params: { error: 'API 529' },
      fields: [],
    })
    for (const data of [{}, { error: '' }, { error: '   ' }, { error: 42 }]) {
      expect(describeEvent(ev('e', null, 'analysis.failed', data), nameOf)).toEqual({
        key: 'analysisFailedBare',
        params: {},
        fields: [],
      })
    }
  })

  it('maps the simple kinds and falls back for unknown ones', () => {
    expect(describeEvent(ev('e', null, 'question.answered'), nameOf).key).toBe('questionAnswered')
    expect(describeEvent(ev('e', null, 'action.done'), nameOf).key).toBe('actionDone')
    expect(describeEvent(ev('e', null, 'ruling.added'), nameOf).key).toBe('rulingAdded')
    expect(describeEvent(ev('e', null, 'analysis.done', { model: 'm' }), nameOf).key).toBe('analysisDone')
    expect(describeEvent(ev('e', null, 'something.new'), nameOf)).toEqual({
      key: 'other',
      params: { kind: 'something.new' },
      fields: [],
    })
  })

  it('survives malformed data', () => {
    expect(describeEvent(ev('e', null, 'item.status', { to: 42 }), nameOf)).toEqual({
      key: 'itemStatus',
      params: { from: '?', to: '?' },
      fields: [],
    })
    expect(describeEvent(ev('e', null, 'item.updated', { fields: 'x' }), nameOf).fields).toEqual([])
  })
})
