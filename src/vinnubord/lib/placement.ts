import type { Rect } from './geometry'

// Where a new item card lands on the board, in world coordinates. With a
// module it sits beside the module (left, then right, then further down on
// either side); without one it sits on the centre of the current view, moved
// down, right or left if a card or pack is already there. Pure, no DOM.

export const NEW_CARD_GAP = 40
const MAX_STEPS = 12

type Pos = { x: number; y: number }

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export function placeNewCard(opts: {
  anchor: Rect | null
  center: Pos
  size: { w: number; h: number }
  obstacles: Rect[]
}): Pos {
  const { anchor, center, size, obstacles } = opts
  const stepY = size.h + NEW_CARD_GAP
  const candidates: Pos[] = []
  if (anchor) {
    const left = anchor.x - NEW_CARD_GAP - size.w
    const right = anchor.x + anchor.w + NEW_CARD_GAP
    for (let k = 0; k < MAX_STEPS; k++) {
      const y = anchor.y + k * stepY
      candidates.push({ x: left, y }, { x: right, y })
    }
  } else {
    const x = center.x - size.w / 2
    const y = center.y - size.h / 2
    const stepX = size.w + NEW_CARD_GAP
    for (let k = 0; k < MAX_STEPS; k++) {
      const dy = k * stepY
      candidates.push({ x, y: y + dy }, { x: x + stepX, y: y + dy }, { x: x - stepX, y: y + dy })
    }
  }
  const round = (p: Pos): Pos => ({ x: Math.round(p.x), y: Math.round(p.y) })
  const free = candidates.find((p) => !obstacles.some((o) => overlaps({ ...p, ...size }, o)))
  return round(free ?? candidates[0])
}
