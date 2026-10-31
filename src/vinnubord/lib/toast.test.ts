import { describe, expect, it } from 'vitest'
import { newItemEvents, toastFor } from './toast'
import type { Event, Item, Participant } from './types'

const VIEWER = 'viewer'
const OTHER = 'other'

function ev(id: string, kind: string, actor: string | null, itemId: string | null = `item-${id}`): Event {
  return { id, created_at: null, project_id: 'p', item_id: itemId, module_id: null, actor, kind, data: {} }
}

describe('newItemEvents', () => {
  it('returns item.created events by someone else that were not seen', () => {
    const seen = new Set(['e1'])
    const events = [ev('e1', 'item.created', OTHER), ev('e2', 'item.created', OTHER)]
    expect(newItemEvents(seen, events, VIEWER).map((e) => e.id)).toEqual(['e2'])
  })

  it('never returns events that were present at load', () => {
    const events = [ev('e1', 'item.created', OTHER), ev('e2', 'item.created', null)]
    expect(newItemEvents(new Set(['e1', 'e2']), events, VIEWER)).toEqual([])
  })

  it('skips the viewer own items', () => {
    expect(newItemEvents(new Set(), [ev('e1', 'item.created', VIEWER)], VIEWER)).toEqual([])
  })

  it('keeps an unknown actor (null), which is not the viewer', () => {
    expect(newItemEvents(new Set(), [ev('e1', 'item.created', null)], VIEWER).map((e) => e.id)).toEqual(['e1'])
  })

  it('skips other kinds and events without an item', () => {
    const events = [ev('e1', 'item.status', OTHER), ev('e2', 'comment.created', OTHER), ev('e3', 'item.created', OTHER, null)]
    expect(newItemEvents(new Set(), events, VIEWER)).toEqual([])
  })
})

describe('toastFor', () => {
  const participants = [{ user_id: OTHER, short: 'Á', display_name: 'Árni' }] as Participant[]
  const items = [{ id: 'item-e1', title: 'Efnaskrá B' }] as Item[]

  it('uses the actor short and the item title', () => {
    expect(toastFor(ev('e1', 'item.created', OTHER), items, participants)).toEqual({
      eventId: 'e1',
      itemId: 'item-e1',
      short: 'Á',
      title: 'Efnaskrá B',
    })
  })

  it('falls back to a neutral short when the actor is null or unknown', () => {
    expect(toastFor(ev('e1', 'item.created', null), items, participants)?.short).toBe('?')
    expect(toastFor(ev('e1', 'item.created', 'stranger'), items, participants)?.short).toBe('?')
  })

  it('returns null when the item is not in the board data', () => {
    expect(toastFor(ev('e9', 'item.created', OTHER), items, participants)).toBeNull()
  })
})
