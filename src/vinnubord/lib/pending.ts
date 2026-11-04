// A card's dropped position waiting for the database (the spring keeps it as
// its target until the data shows the save).
//
// base is the data position the first of a run of quick drops started from:
// data still showing base is stale and ignored. Data at pos means the save
// landed. viewId is the view the drop was made in (null for the main board):
// in another view the pending is spent and the card rests where that view has
// it. via holds earlier drops of the run whose saves went out but had not yet
// shown when a later drop replaced them (a quick second drop, an arrange
// undone at once): data at a via point is that save arriving late, stale like
// base, and it spends the via points up to it. Anything else means someone
// else moved the card, and the pending is spent.
//
// One case cannot be told apart: a drop back onto base while via is not
// empty. Data at pos may then be the stale base, so the pending stays until a
// late save shows or the data moves elsewhere. Its target is the data then, so
// a pending kept that way never shows the card in a wrong place.

type Point = { x: number; y: number }

export type Pending = { x: number; y: number; baseX: number; baseY: number; viewId: string | null; via: Point[] }

const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y

// The pending after a drop at (x, y), already rounded. prev is the live
// pending of the card, data its data position, sent whether prev's save
// already went out (a save still in its debounce is cancelled by the new drop
// and never arrives, so it does not join via).
export function pendingDrop(prev: Pending | null, x: number, y: number, data: Point, viewId: string | null, sent: boolean): Pending {
  const live = prev && prev.viewId === viewId ? prev : null
  if (!live) return { x, y, baseX: data.x, baseY: data.y, viewId, via: [] }
  return {
    x,
    y,
    baseX: live.baseX,
    baseY: live.baseY,
    viewId,
    via: sent ? [...live.via, { x: live.x, y: live.y }] : live.via,
  }
}

// The pending after new data, or null when it is spent.
export function pendingStep(p: Pending, data: Point, viewId: string | null): Pending | null {
  if (p.viewId !== viewId) return null
  const base = { x: p.baseX, y: p.baseY }
  if (same(data, p)) return same(p, base) && p.via.length > 0 ? p : null
  if (same(data, base)) return p
  const late = p.via.findIndex((v) => same(v, data))
  if (late >= 0) return { ...p, via: p.via.slice(late + 1) }
  return null
}

// A save of (x, y) in viewId failed. null: it was the pending itself, which
// rolls back to the data. A failed earlier drop leaves via, since it never
// shows in the data.
export function pendingFailed(p: Pending, failed: Point, viewId: string | null): Pending | null {
  if (p.viewId !== viewId) return p
  if (same(p, failed)) return null
  return { ...p, via: p.via.filter((v) => !same(v, failed)) }
}
