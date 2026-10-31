import type { Event, Item, Participant } from './types'

// The new item toast (ruling R22). A toast is due for an item.created event
// by someone other than the viewer that was not in the set of event ids seen
// so far. The caller seeds the set with every event of the first load, so
// nothing that was already there when the board opened ever toasts.

export type NewItemToast = { eventId: string; itemId: string; short: string; title: string }

// Short shown when the actor is null (written outside a session) or unknown.
export const UNKNOWN_SHORT = '?'

export function newItemEvents(seen: ReadonlySet<string>, events: Event[], viewerId: string): Event[] {
  return events.filter(
    (e) => e.kind === 'item.created' && e.item_id !== null && e.actor !== viewerId && !seen.has(e.id),
  )
}

// What the toast says, or null when the item is not on the board data
// (deleted, or not loaded yet).
export function toastFor(event: Event, items: Item[], participants: Participant[]): NewItemToast | null {
  const item = items.find((i) => i.id === event.item_id)
  if (!item) return null
  const actor = event.actor ? participants.find((p) => p.user_id === event.actor) : undefined
  return { eventId: event.id, itemId: item.id, short: actor?.short ?? UNKNOWN_SHORT, title: item.title }
}
