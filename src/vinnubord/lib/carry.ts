// Where the hidden cards of a folded pack go when the pack is dropped. They
// have no element and no spring, so the drop writes them straight to the
// database by the pack's delta, and the place written is kept as a carry until
// the data shows it. Same reading as a card's pending drop: a carry made in
// another view, one the data shows, or one someone else moved off its base, is
// spent; while it lives it is the card's place, so a second quick drop adds
// its delta to the first instead of to the stale data.

type Point = { x: number; y: number }

// base is the data position the first carry started from.
export type Carry = { x: number; y: number; baseX: number; baseY: number; viewId: string | null }

export function carrySpent(c: Carry, data: Point, viewId: string | null): boolean {
  if (c.viewId !== viewId) return true
  if (data.x === c.x && data.y === c.y) return true
  return !(data.x === c.baseX && data.y === c.baseY)
}

// The carry after a folded drop by (dx, dy): from the live carry when there
// is one, else from the data.
export function carryStep(data: Point, c: Carry | undefined, viewId: string | null, dx: number, dy: number): Carry {
  const live = c && !carrySpent(c, data, viewId) ? c : null
  const from = live ?? data
  return {
    x: Math.round(from.x + dx),
    y: Math.round(from.y + dy),
    baseX: live ? live.baseX : data.x,
    baseY: live ? live.baseY : data.y,
    viewId,
  }
}
