import type { Action, Event, Read, UnreadRow } from './types'

// "Nýtt hjá þeim sem horfir": the server (hg_unread) counts events by other
// authors on an item after the viewer's read mark. This file groups those rows
// per item and decides what a fresh row in a panel list looks like. Own moves
// never count, and a read mark is stamped by the server clock.

export type UnreadKind =
  | 'created' | 'action' | 'actionDone' | 'actionEdited' | 'actionCancelled' | 'question' | 'answer' | 'file' | 'comment'
  | 'status' | 'plan' | 'ruling' | 'analysis' | 'analysisFailed' | 'text'

export type UnreadSummary = { created: boolean; kinds: { kind: UnreadKind; n: number }[]; latest: string }

export const UNREAD_ORDER: readonly UnreadKind[] = [
  'action', 'actionDone', 'actionEdited', 'actionCancelled', 'question', 'answer', 'file', 'comment', 'status', 'plan', 'ruling',
  'analysis', 'analysisFailed', 'text',
]

const KIND_OF: Record<string, UnreadKind> = {
  'item.created': 'created',
  'action.added': 'action',
  'action.done': 'actionDone',
  'action.updated': 'actionEdited',
  'action.cancelled': 'actionCancelled',
  'question.asked': 'question',
  'question.answered': 'answer',
  'file.added': 'file',
  'comment.added': 'comment',
  'item.status': 'status',
  'plan.added': 'plan',
  'plan.status': 'plan',
  'ruling.added': 'ruling',
  'analysis.done': 'analysis',
  'analysis.failed': 'analysisFailed',
  'item.updated': 'text',
}

// Unread rows grouped per item. Unknown event kinds are dropped, and an item
// with only unknown rows is not in the map.
export function summarizeUnread(rows: UnreadRow[]): Map<string, UnreadSummary> {
  const out = new Map<string, UnreadSummary>()
  for (const row of rows) {
    const kind = KIND_OF[row.kind]
    if (!kind) continue
    let s = out.get(row.item_id)
    if (!s) {
      s = { created: false, kinds: [], latest: row.latest }
      out.set(row.item_id, s)
    }
    if (Date.parse(row.latest) > Date.parse(s.latest)) s.latest = row.latest
    if (kind === 'created') {
      s.created = true
      continue
    }
    const found = s.kinds.find((k) => k.kind === kind)
    if (found) found.n += row.n
    else s.kinds.push({ kind, n: row.n })
  }
  for (const s of out.values()) {
    s.kinds.sort((a, b) => UNREAD_ORDER.indexOf(a.kind) - UNREAD_ORDER.indexOf(b.kind))
  }
  return out
}

// What a card shows: a new item shows only that, otherwise the first kinds in
// order and how many more there are.
export function freshChips(
  summary: UnreadSummary,
  max = 3,
): { created: true } | { created: false; shown: { kind: UnreadKind; n: number }[]; more: number } {
  if (summary.created) return { created: true }
  return {
    created: false,
    shown: summary.kinds.slice(0, max),
    more: Math.max(0, summary.kinds.length - max),
  }
}

// A row in the panel is fresh when someone else wrote it after the viewer's
// read mark as it was when the panel opened (no mark: everything is fresh).
export function isFresh(
  createdAt: string | null,
  author: string | null,
  readAtOnOpen: string | null,
  viewerId: string,
): boolean {
  if (!createdAt || author === viewerId) return false
  return readAtOnOpen === null || Date.parse(createdAt) > Date.parse(readAtOnOpen)
}

// An action row is fresh when its add or its last change (body, owner or
// payload) is fresh by the rule above.
export function isActionFresh(
  action: Pick<Action, 'created_at' | 'created_by' | 'updated_at' | 'updated_by'>,
  fresh: (at: string | null, by: string | null) => boolean,
): boolean {
  return fresh(action.created_at, action.created_by) || fresh(action.updated_at, action.updated_by)
}

export function readAtOf(reads: Read[], itemId: string, viewerId: string): string | null {
  return reads.find((r) => r.item_id === itemId && r.user_id === viewerId)?.read_at ?? null
}

// Newest event on the item by someone else (a null actor counts as someone
// else). The open panel marks the item read again whenever this changes.
export function latestForeignAt(events: Event[], itemId: string, viewerId: string): string | null {
  let best: string | null = null
  for (const e of events) {
    if (e.item_id !== itemId || e.actor === viewerId || !e.created_at) continue
    if (best === null || Date.parse(e.created_at) > Date.parse(best)) best = e.created_at
  }
  return best
}
