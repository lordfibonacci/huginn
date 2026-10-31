import type { ItemPatch } from './api'
import { isOnBoard } from './status'
import type { Item, ItemStatus, Question } from './types'

// Pure helpers behind the item and module panels.

export const CLOSED_DAYS = 90
const DAY_MS = 24 * 60 * 60 * 1000

export type ModuleItems = { open: Item[]; done: Item[]; dropped: Item[] }

// Items of one module: open ones in data order, done and dropped ones closed
// in the last `days` days, newest first, each under its own heading.
export function moduleItems(items: Item[], moduleId: string, now: Date = new Date(), days = CLOSED_DAYS): ModuleItems {
  const since = now.getTime() - days * DAY_MS
  const mine = items.filter((i) => i.module_id === moduleId)
  const closedSince = (status: ItemStatus) =>
    mine
      .filter((i) => i.status === status && i.closed_at !== null && Date.parse(i.closed_at) >= since)
      .sort((a, b) => Date.parse(b.closed_at as string) - Date.parse(a.closed_at as string))
  return { open: mine.filter(isOnBoard), done: closedSince('done'), dropped: closedSince('dropped') }
}

// The patch a deliberate status change saves (ruling R13). waiting_on only
// means something while the item waits, so other statuses clear it. Waiting
// without someone to wait on is refused.
export function statusPatch(status: ItemStatus, waitingOn: string | null): ItemPatch | null {
  if (status === 'waiting') return waitingOn ? { status, waiting_on: waitingOn } : null
  return { status, waiting_on: null }
}

function createdTime(q: Question): number {
  return q.created_at ? Date.parse(q.created_at) : 0
}

// Unanswered questions first (they can be answered, ruling R6), then answered
// ones, read only. Both oldest first.
export function splitQuestions(questions: Question[]): { open: Question[]; answered: Question[] } {
  const sorted = [...questions].sort((a, b) => createdTime(a) - createdTime(b))
  return { open: sorted.filter((q) => q.answer === null), answered: sorted.filter((q) => q.answer !== null) }
}
