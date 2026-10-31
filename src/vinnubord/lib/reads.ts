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
