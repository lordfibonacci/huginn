import type { Item, Read } from './types'

// "Nýtt hjá þeim sem horfir": the viewer has not opened the item since its last
// change, and that change was made by someone else. Own moves never glow.
export function isUnread(item: Item, reads: Read[], viewerId: string): boolean {
  const lastMover = item.updated_by ?? item.created_by
  if (lastMover === viewerId) return false
  const updated = Date.parse(item.updated_at)
  return !reads.some(
    (r) => r.item_id === item.id && r.user_id === viewerId && Date.parse(r.read_at) >= updated,
  )
}

// Ruling R14 with one exception: the panel marks the item read when it opens,
// and again when the item changes while open, unless the viewer made that
// change. An own move never glows, so marking it only costs a write.
export function needsReadMark(
  item: Pick<Item, 'updated_by' | 'created_by'>,
  viewerId: string,
  opening: boolean,
): boolean {
  if (opening) return true
  return (item.updated_by ?? item.created_by) !== viewerId
}
