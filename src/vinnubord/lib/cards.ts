import { isActive, matches, type Filter } from './filters'
import { freshChips, readAtOf, type UnreadKind, type UnreadSummary } from './reads'
import {
  BUCKET_TONE,
  countBucket,
  isOpen,
  itemStatusLabel,
  itemTone,
  wireMode,
  type Counts,
  type Tone,
  type WireMode,
} from './status'
import type { Action, Comment, Item, Module, Participant, Read } from './types'

// One card as the board and the list draw it. BoardPage computes these once,
// so the two always agree on tone, label, visibility and the unread mark.
export type CardModel = {
  item: Item
  tone: Tone
  bucket: keyof Counts | null
  label: string
  mode: WireMode
  visible: boolean
  // Done or dropped, still drawn within CLOSED_LINGER_DAYS.
  closed: boolean
  fresh: UnreadSummary | null
  mover: { short: string; name: string } | null
  // Who the item waits for, when it waits and that person is a participant.
  waitingOn: { short: string; name: string } | null
  // Name of the item's module, null when it has none or the module is gone.
  moduleName: string | null
  // True when the item changed within CARD_STAMP_DAYS.
  showStamp: boolean
  // Newest comment by someone else since the viewer's read mark.
  freshComment: { short: string; line: string } | null
}

export type CardContext = {
  viewerId: string
  participants: Participant[]
  actions: Action[]
  modules: Module[]
  unread: Map<string, UnreadSummary>
  filter: Filter
  comments: Comment[]
  reads: Read[]
  now: number
  // Folded search text per item id (searchIndex).
  search: Map<string, string>
}

// A card shows its change stamp only while the change is recent.
export const CARD_STAMP_DAYS = 7

export function showStamp(updatedAt: string | null, now: number): boolean {
  if (!updatedAt) return false
  const at = Date.parse(updatedAt)
  if (Number.isNaN(at)) return false
  return now - at <= CARD_STAMP_DAYS * 86_400_000
}

// First non empty line of a text, trimmed, '' when there is none.
export function firstLine(body: string): string {
  for (const line of body.replace(/\r\n?/g, '\n').split('\n')) {
    const t = line.trim()
    if (t) return t
  }
  return ''
}

// The newest comment on the item by someone other than the viewer, written
// after the viewer's read mark (every such comment when there is no mark).
// A comment without a timestamp never counts.
export function freshComment(
  comments: Comment[],
  participants: Participant[],
  itemId: string,
  viewerId: string,
  readAt: string | null,
): { short: string; line: string } | null {
  const mark = readAt === null ? null : Date.parse(readAt)
  let best: Comment | null = null
  let bestAt = -Infinity
  for (const c of comments) {
    if (c.item_id !== itemId || c.user_id === viewerId || !c.created_at) continue
    const at = Date.parse(c.created_at)
    if (Number.isNaN(at) || (mark !== null && !(at > mark))) continue
    if (at > bestAt) {
      best = c
      bestAt = at
    }
  }
  if (!best) return null
  const author = best.user_id
  const short = participants.find((p) => p.user_id === author)?.short ?? '?'
  return { short, line: firstLine(best.body) }
}

// What the card's fresh line at its foot says: a new item, else a fresh comment,
// else the first unread kinds and how many more.
export type FreshLine =
  | { kind: 'created' }
  | { kind: 'comment'; short: string; line: string }
  | { kind: 'kinds'; kinds: { kind: UnreadKind; n: number }[]; more: number }

export function freshLine(summary: UnreadSummary, comment: { short: string; line: string } | null): FreshLine {
  if (summary.created) return { kind: 'created' }
  if (comment !== null) return { kind: 'comment', short: comment.short, line: comment.line }
  const chips = freshChips(summary)
  if (chips.created) return { kind: 'created' }
  return { kind: 'kinds', kinds: chips.shown, more: chips.more }
}

// items in board order (boardOrder), one model per item, same order.
// visible is false only when the filter is active and the item does not
// match it; the tone filter reads the bucket tone, as the counter pills do,
// so a closed card (no bucket) matches no tone but still matches the rest.
export function cardModels(items: Item[], ctx: CardContext): CardModel[] {
  const { viewerId, participants, actions, unread, filter } = ctx
  const packageOfModule = new Map(ctx.modules.map((m) => [m.id, m.package_id]))
  const nameOfModule = new Map(ctx.modules.map((m) => [m.id, m.name]))
  const filterOn = isActive(filter)
  return items.map((item) => {
    const tone = itemTone(item, viewerId, participants)
    const bucket = countBucket(item, actions, viewerId)
    const packageId = item.module_id ? (packageOfModule.get(item.module_id) ?? null) : null
    const fresh = unread.get(item.id) ?? null
    const text = ctx.search.get(item.id) ?? ''
    const visible =
      !filterOn ||
      matches(item, { tone: bucket !== null ? BUCKET_TONE[bucket] : null, packageId, unread: fresh !== null, text }, filter)
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
      closed: !isOpen(item),
      fresh,
      mover: mover ? { short: mover.short, name: mover.display_name } : null,
      waitingOn: waiter ? { short: waiter.short, name: waiter.display_name } : null,
      moduleName: item.module_id ? (nameOfModule.get(item.module_id) ?? null) : null,
      showStamp: showStamp(item.updated_at, ctx.now),
      freshComment: freshComment(ctx.comments, participants, item.id, viewerId, readAtOf(ctx.reads, item.id, viewerId)),
    }
  })
}
