import { PLAN_STATUS_NAMES, STATUS_NAMES } from './status'
import type { Comment, Event, ItemStatus, PlanStatus } from './types'

// The "Saga" tab: trigger written events and comments of one item in one
// timeline, oldest first.

export type HistoryEntry =
  | { type: 'event'; id: string; at: string | null; actor: string | null; event: Event }
  | { type: 'comment'; id: string; at: string | null; actor: string; comment: Comment }

function timeOf(at: string | null): number {
  if (!at) return Number.NEGATIVE_INFINITY
  const t = Date.parse(at)
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t
}

export function itemHistory(events: Event[], comments: Comment[], itemId: string): HistoryEntry[] {
  const entries: HistoryEntry[] = [
    // comment.added is left out: the comment itself is in the timeline.
    ...events
      .filter((e) => e.item_id === itemId && e.kind !== 'comment.added')
      .map((e): HistoryEntry => ({ type: 'event', id: e.id, at: e.created_at, actor: e.actor, event: e })),
    ...comments
      .filter((c) => c.item_id === itemId)
      .map((c): HistoryEntry => ({ type: 'comment', id: c.id, at: c.created_at, actor: c.user_id, comment: c })),
  ]
  // Array.prototype.sort is stable, so equal times keep the order above.
  return entries.sort((a, b) => timeOf(a.at) - timeOf(b.at))
}

// One event as an i18n key under vinnubord.history plus its parameters.
// fields lists the changed columns of item.updated and action.updated,
// translated by the caller.
export type EventLine = { key: string; params: Record<string, string>; fields: string[] }

const SIMPLE: Record<string, string> = {
  'item.created': 'itemCreated',
  'plan.added': 'planAdded',
  'question.asked': 'questionAsked',
  'question.answered': 'questionAnswered',
  'action.added': 'actionAdded',
  'action.done': 'actionDone',
  'action.cancelled': 'actionCancelled',
  'ruling.added': 'rulingAdded',
  'comment.added': 'commentAdded',
  'analysis.done': 'analysisDone',
}

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

function fieldsOf(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((f): f is string => typeof f === 'string') : []
}

function itemStatusName(v: unknown): string {
  const s = str(v)
  return s && s in STATUS_NAMES ? STATUS_NAMES[s as ItemStatus] : '?'
}

function planStatusName(v: unknown): string {
  const s = str(v)
  return s && s in PLAN_STATUS_NAMES ? PLAN_STATUS_NAMES[s as PlanStatus] : '?'
}

export function describeEvent(event: Event, nameOf: (userId: string | null) => string): EventLine {
  const data = event.data ?? {}
  const line = (key: string, params: Record<string, string> = {}, fields: string[] = []): EventLine => ({
    key,
    params,
    fields,
  })

  switch (event.kind) {
    case 'item.status': {
      // A move into waiting, or a change of who it waits on, names the person.
      if (data.to === 'waiting' && str(data.waiting_on)) {
        return line('itemWaiting', { who: nameOf(str(data.waiting_on)) })
      }
      return line('itemStatus', { from: itemStatusName(data.from), to: itemStatusName(data.to) })
    }
    case 'item.updated':
      return line('itemUpdated', {}, fieldsOf(data.fields))
    case 'action.updated':
      return line('actionUpdated', {}, fieldsOf(data.fields))
    case 'plan.status':
      return line('planStatus', { to: planStatusName(data.to) })
    case 'file.added':
      return line('fileAdded', { name: str(data.name) ?? '?' })
    case 'file.updated':
      return line('fileUpdated', { name: str(data.name) ?? '?' })
    case 'analysis.failed': {
      // The reason shows after a colon. Without one the bare line has none.
      const error = str(data.error)?.trim() ?? ''
      return error === '' ? line('analysisFailedBare') : line('analysisFailed', { error })
    }
    default: {
      const key = SIMPLE[event.kind]
      return key ? line(key) : line('other', { kind: event.kind })
    }
  }
}
