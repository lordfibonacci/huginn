import type { Action, Item, ItemStatus, Participant, PlanStatus } from './types'

// Plain status names (ruling R5, hard coded Icelandic). itemStatusLabel below is
// the viewer relative label; these are for selects, history lines and prompts.
export const STATUS_NAMES: Record<ItemStatus, string> = {
  new: 'Nýtt',
  waiting: 'Bíður',
  ready: 'Tilbúið til byggingar',
  building: 'Í byggingu',
  parked: 'Í bið',
  done: 'Lokið',
  dropped: 'Hætt við',
}

export const PLAN_STATUS_NAMES: Record<PlanStatus, string> = {
  todo: 'Ekki byrjað',
  building: 'Í byggingu',
  done: 'Lokið',
}

export type Tone = 'gold' | 'coral' | 'lilac' | 'teal' | 'stone'

// The five tones, in the order the settings color picker shows them.
export const TONES: readonly Tone[] = ['gold', 'lilac', 'coral', 'teal', 'stone']

export function isTone(value: string): value is Tone {
  return (TONES as readonly string[]).includes(value)
}

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
// A waiting item with nobody to wait on reads 'Bíður ákvörðunar', the same
// heading the CLI prints in cli/lib/format.mjs.
export function itemStatusLabel(item: Item, viewerId: string, participants: Participant[]): string {
  switch (item.status) {
    case 'new': {
      const creator = participants.find((p) => p.user_id === item.created_by)
      return `Nýtt frá ${creator ? creator.short : '?'}`
    }
    case 'waiting': {
      if (item.waiting_on === null) return 'Bíður ákvörðunar'
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

function isOpenMine(a: Action, viewerId: string): boolean {
  return a.owner === viewerId && a.done_at === null
}

export function waitsFor(item: Item, actions: Action[], viewerId: string): boolean {
  if (item.waiting_on === viewerId) return true
  return actions.some((a) => a.item_id === item.id && isOpenMine(a, viewerId))
}

// Open actions owned by the viewer per item, the same rule waitsFor uses.
// Items without one are absent from the map.
export function mineActionsByItem(actions: Action[], viewerId: string): Map<string, number> {
  const map = new Map<string, number>()
  for (const a of actions) {
    if (isOpenMine(a, viewerId)) map.set(a.item_id, (map.get(a.item_id) ?? 0) + 1)
  }
  return map
}

export type Counts = { new: number; mine: number; others: number; build: number; parked: number; unread: number }

// The counter bucket of one item, null when it is off the board. Buckets are
// exclusive. "mine" takes precedence: anything waiting for the viewer
// (waiting_on or an open owned action) counts only there.
export function countBucket(item: Item, actions: Action[], viewerId: string): keyof Counts | null {
  if (!isOnBoard(item)) return null
  if (waitsFor(item, actions, viewerId)) return 'mine'
  switch (item.status) {
    case 'new':
      return 'new'
    case 'waiting':
      return 'others'
    case 'ready':
    case 'building':
      return 'build'
    case 'parked':
      return 'parked'
    default:
      return null
  }
}

// Tone of each counter pill. The tone filter matches an item by this tone of
// its bucket (not by itemTone), so a pill filters exactly what it counts.
export const BUCKET_TONE: Record<keyof Counts, Tone> = {
  new: 'gold',
  mine: 'coral',
  others: 'lilac',
  build: 'teal',
  parked: 'stone',
  unread: 'gold',
}

// "unread" is counted beside the exclusive buckets: an item can be mine and unread.
export function countsFor(items: Item[], actions: Action[], viewerId: string, unreadIds: Set<string>): Counts {
  const c: Counts = { new: 0, mine: 0, others: 0, build: 0, parked: 0, unread: 0 }
  for (const item of items) {
    const bucket = countBucket(item, actions, viewerId)
    if (bucket) c[bucket]++
    if (isOnBoard(item) && unreadIds.has(item.id)) c.unread++
  }
  return c
}

// How the wire of an item behaves: pulse (three sparks at a time) when it is
// new or waits on someone, calm (a rare single spark) when it is in build,
// parked (dashed, no sparks) when it is on hold.
export type WireMode = 'pulse' | 'calm' | 'parked'

export function wireMode(item: Item, tone: Tone): WireMode {
  if (item.status === 'parked') return 'parked'
  return tone === 'gold' || tone === 'coral' || tone === 'lilac' ? 'pulse' : 'calm'
}
