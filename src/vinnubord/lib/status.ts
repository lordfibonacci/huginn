import type { Action, Item, Participant } from './types'

export type Tone = 'gold' | 'coral' | 'lilac' | 'teal' | 'stone'

function isServiceUser(userId: string | null, participants: Participant[]): boolean {
  if (!userId) return false
  return participants.some((p) => p.user_id === userId && p.is_service)
}

export function itemTone(item: Item, viewerId: string, participants: Participant[]): Tone {
  switch (item.status) {
    case 'new':
      return 'gold'
    case 'waiting':
      if (item.waiting_on === viewerId) return 'coral'
      if (isServiceUser(item.waiting_on, participants)) return 'gold'
      return 'lilac'
    case 'ready':
    case 'building':
      return 'teal'
    default:
      return 'stone'
  }
}

// Status labels are hard coded Icelandic (ruling R5), not routed through i18n.
export function itemStatusLabel(item: Item, viewerId: string, participants: Participant[]): string {
  switch (item.status) {
    case 'new': {
      const creator = participants.find((p) => p.user_id === item.created_by)
      return `Nýtt frá ${creator ? creator.short : '?'}`
    }
    case 'waiting': {
      if (item.waiting_on === viewerId) return 'Bíður þín'
      if (isServiceUser(item.waiting_on, participants)) return 'Svarað, bíður Claude'
      const who = participants.find((p) => p.user_id === item.waiting_on)
      return `Bíður ${who ? who.display_name : '?'}`
    }
    case 'ready':
      return 'Tilbúið til byggingar'
    case 'building':
      return 'Í byggingu'
    case 'parked':
      return 'Í bið'
    case 'done':
      return 'Lokið'
    case 'dropped':
      return 'Hætt við'
  }
}

export function isOnBoard(item: Item): boolean {
  return item.status !== 'done' && item.status !== 'dropped'
}

export function waitsFor(item: Item, actions: Action[], viewerId: string): boolean {
  if (item.waiting_on === viewerId) return true
  return actions.some((a) => a.item_id === item.id && a.owner === viewerId && a.done_at === null)
}

export type Counts = { new: number; mine: number; others: number; build: number; parked: number }

// Buckets are exclusive per item on the board. "mine" takes precedence: anything
// waiting for the viewer (waiting_on or an open owned action) counts only there.
export function countsFor(
  items: Item[],
  actions: Action[],
  viewerId: string,
  _participants: Participant[],
): Counts {
  const c: Counts = { new: 0, mine: 0, others: 0, build: 0, parked: 0 }
  for (const item of items) {
    if (!isOnBoard(item)) continue
    if (waitsFor(item, actions, viewerId)) {
      c.mine++
      continue
    }
    switch (item.status) {
      case 'new':
        c.new++
        break
      case 'waiting':
        c.others++
        break
      case 'ready':
      case 'building':
        c.build++
        break
      case 'parked':
        c.parked++
        break
    }
  }
  return c
}
