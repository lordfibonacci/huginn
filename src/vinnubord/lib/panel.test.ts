import { describe, expect, it } from 'vitest'
import { moduleItems, splitQuestions, statusPatch } from './panel'
import type { Item, Question } from './types'

function item(id: string, over: Partial<Item> = {}): Item {
  return {
    id,
    created_at: '2026-10-01T00:00:00Z',
    project_id: 'p',
    module_id: 'm1',
    title: id,
    summary: null,
    body: null,
    status: 'new',
    waiting_on: null,
    tags: [],
    pos_x: 0,
    pos_y: 0,
    source_ref: null,
    next_step: null,
    next_prompt: null,
    created_by: 'u',
    updated_by: null,
    updated_at: '2026-10-01T00:00:00Z',
    closed_at: null,
    ...over,
  }
}

function q(id: string, answer: string | null, at: string): Question {
  return {
    id,
    created_at: at,
    project_id: 'p',
    item_id: 'i',
    body: id,
    asked_by: 'c',
    asked_to: null,
    answer,
    answered_by: answer ? 'a' : null,
    answered_at: answer ? at : null,
  }
}

describe('moduleItems', () => {
  const now = new Date('2026-10-31T12:00:00Z')

  it('splits a module into open, done and dropped, closed ones newest first', () => {
    const items = [
      item('open1', { status: 'waiting' }),
      item('done1', { status: 'done', closed_at: '2026-10-20T00:00:00Z' }),
      item('done2', { status: 'done', closed_at: '2026-10-30T00:00:00Z' }),
      item('drop1', { status: 'dropped', closed_at: '2026-10-29T00:00:00Z' }),
      item('parked', { status: 'parked' }),
      item('elsewhere', { module_id: 'm2' }),
    ]
    const out = moduleItems(items, 'm1', now)
    expect(out.open.map((i) => i.id)).toEqual(['open1', 'parked'])
    expect(out.done.map((i) => i.id)).toEqual(['done2', 'done1'])
    expect(out.dropped.map((i) => i.id)).toEqual(['drop1'])
  })

  it('keeps only items closed in the last 90 days', () => {
    const items = [
      item('old', { status: 'done', closed_at: '2026-07-01T00:00:00Z' }),
      item('edge', { status: 'done', closed_at: '2026-08-02T12:00:00Z' }),
      item('noStamp', { status: 'dropped', closed_at: null }),
    ]
    const out = moduleItems(items, 'm1', now)
    expect(out.done.map((i) => i.id)).toEqual(['edge'])
    expect(out.dropped).toEqual([])
  })
})

describe('statusPatch', () => {
  it('keeps waiting_on only for waiting', () => {
    expect(statusPatch('waiting', 'a')).toEqual({ status: 'waiting', waiting_on: 'a' })
    expect(statusPatch('ready', 'a')).toEqual({ status: 'ready', waiting_on: null })
  })

  it('refuses waiting without someone to wait on', () => {
    expect(statusPatch('waiting', null)).toBeNull()
  })
})

describe('splitQuestions', () => {
  it('puts unanswered first, both groups oldest first', () => {
    const out = splitQuestions([
      q('a2', 'já', '2026-10-31T02:00:00Z'),
      q('o2', null, '2026-10-31T03:00:00Z'),
      q('a1', 'nei', '2026-10-31T01:00:00Z'),
      q('o1', null, '2026-10-31T00:00:00Z'),
    ])
    expect(out.open.map((x) => x.id)).toEqual(['o1', 'o2'])
    expect(out.answered.map((x) => x.id)).toEqual(['a1', 'a2'])
  })
})
