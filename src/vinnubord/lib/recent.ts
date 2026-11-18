import type { BoardData } from './types'

// "Nýlega breytt" (spec 2026-11-18): the last movement of an item is the
// newest stamp on the item or on anything that belongs to it, and a card is
// recent while that movement is inside the viewer's window. The pill, the
// list sorts and the list row date all read this one clock.

export const RECENT_HOURS = [24, 72, 168] as const
export type RecentHours = (typeof RECENT_HOURS)[number]
export const DEFAULT_RECENT_HOURS: RecentHours = 72

// localStorage key of the window. One for every project: it is a personal
// setting, like the language.
export const RECENT_KEY = 'hg.recent'

export function parseRecentHours(raw: string | null): RecentHours {
  const n = Number(raw)
  return (RECENT_HOURS as readonly number[]).includes(n) ? (n as RecentHours) : DEFAULT_RECENT_HOURS
}

function ms(stamp: string | null | undefined): number {
  if (!stamp) return 0
  const at = Date.parse(stamp)
  return Number.isNaN(at) ? 0 : at
}

// Epoch ms of the last movement per item id, 0 when no stamp parses. Counts
// the item itself, its chat, files (a replace too), questions and answers,
// actions (done, cancelled or edited too), plans and their rulings. Rows of
// an item that is not loaded, and module comments, are skipped. What moves
// no stamp in the database (a drag, keywords, a file note, a silent tag
// change, a read mark) does not count.
export function lastChangeByItem(
  data: Pick<BoardData, 'items' | 'comments' | 'files' | 'questions' | 'actions' | 'plans' | 'rulings'>,
): Map<string, number> {
  const latest = new Map<string, number>()
  for (const item of data.items) latest.set(item.id, Math.max(ms(item.created_at), ms(item.updated_at)))
  const bump = (itemId: string | null | undefined, ...stamps: (string | null)[]) => {
    if (!itemId) return
    const have = latest.get(itemId)
    if (have === undefined) return
    let best = have
    for (const s of stamps) best = Math.max(best, ms(s))
    if (best !== have) latest.set(itemId, best)
  }
  for (const c of data.comments) bump(c.item_id, c.created_at)
  for (const f of data.files) bump(f.item_id, f.created_at, f.updated_at)
  for (const q of data.questions) bump(q.item_id, q.created_at, q.answered_at)
  for (const a of data.actions) bump(a.item_id, a.created_at, a.done_at, a.updated_at)
  const itemOfPlan = new Map<string, string>()
  for (const p of data.plans) {
    itemOfPlan.set(p.id, p.item_id)
    bump(p.item_id, p.created_at, p.updated_at)
  }
  for (const r of data.rulings) bump(itemOfPlan.get(r.plan_id), r.created_at)
  return latest
}

// A stamp ahead of now (the server clock runs ahead of the browser) is recent.
export function isRecent(changedAt: number, now: number, hours: RecentHours): boolean {
  return changedAt > 0 && now - changedAt <= hours * 3_600_000
}
