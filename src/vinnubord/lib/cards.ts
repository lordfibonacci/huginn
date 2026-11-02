import { isActive, matches, type Filter } from './filters'
import type { UnreadSummary } from './reads'
import {
  BUCKET_TONE,
  countBucket,
  itemStatusLabel,
  itemTone,
  wireMode,
  type Counts,
  type Tone,
  type WireMode,
} from './status'
import type { Action, Item, Module, Participant } from './types'

// One card as the board and the list draw it. BoardPage computes these once,
// so the two always agree on tone, label, visibility and the unread mark.
export type CardModel = {
  item: Item
  tone: Tone
  bucket: keyof Counts | null
  label: string
  mode: WireMode
  visible: boolean
  fresh: UnreadSummary | null
  mover: { short: string; name: string } | null
  // Who the item waits for, when it waits and that person is a participant.
  waitingOn: { short: string; name: string } | null
}

export type CardContext = {
  viewerId: string
  participants: Participant[]
  actions: Action[]
  modules: Module[]
  unread: Map<string, UnreadSummary>
  filter: Filter
}

// items in board order (boardOrder), one model per item, same order.
// visible is false only when the filter is active and the item does not
// match it; the tone filter reads the bucket tone, as the counter pills do.
export function cardModels(items: Item[], ctx: CardContext): CardModel[] {
  const { viewerId, participants, actions, unread, filter } = ctx
  const packageOfModule = new Map(ctx.modules.map((m) => [m.id, m.package_id]))
  const filterOn = isActive(filter)
  return items.map((item) => {
    const tone = itemTone(item, viewerId, participants)
    const bucket = countBucket(item, actions, viewerId)
    const packageId = item.module_id ? (packageOfModule.get(item.module_id) ?? null) : null
    const fresh = unread.get(item.id) ?? null
    const visible =
      !filterOn || (bucket !== null && matches(item, { tone: BUCKET_TONE[bucket], packageId, unread: fresh !== null }, filter))
    const moverId = item.updated_by ?? item.created_by
    const mover = participants.find((p) => p.user_id === moverId)
    const waiter = item.status === 'waiting' ? participants.find((p) => p.user_id === item.waiting_on) : undefined
    return {
      item,
      tone,
      bucket,
      label: itemStatusLabel(item, viewerId, participants),
      mode: wireMode(item, tone),
      visible,
      fresh,
      mover: mover ? { short: mover.short, name: mover.display_name } : null,
      waitingOn: waiter ? { short: waiter.short, name: waiter.display_name } : null,
    }
  })
}
