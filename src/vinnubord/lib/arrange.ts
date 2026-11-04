// Arrange a selection of cards into a tidy grid.
//
// The rule: read the boxes in reading order. Sort them by y, then walk them
// into reading rows: a box joins the current row while its y is within
// ARRANGE_ROW_TOLERANCE of the y of the row's first box, else it starts a new
// row. Each reading row is sorted by x and the rows are flattened. The grid has
// ceil(sqrt(n)) columns, every column as wide as the widest box plus the gap,
// and every grid row as tall as its tallest box plus the gap. The grid is
// centred on the bounding box of the inputs and every position is rounded.
// prev holds every input position, so the move can be undone.

import type { Rect } from './geometry'
import type { Boxed } from './selection'

export const ARRANGE_GAP = 24
export const ARRANGE_ROW_TOLERANCE = 40

export type Point = { x: number; y: number }
export type Arranged = { next: Map<string, Point>; prev: Map<string, Point> }

function bounds(boxes: Boxed[]): Rect {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const { rect } of boxes) {
    minX = Math.min(minX, rect.x)
    minY = Math.min(minY, rect.y)
    maxX = Math.max(maxX, rect.x + rect.w)
    maxY = Math.max(maxY, rect.y + rect.h)
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

function readingOrder(boxes: Boxed[]): Boxed[] {
  const byY = [...boxes].sort((a, b) => a.rect.y - b.rect.y)
  const rows: Boxed[][] = []
  for (const b of byY) {
    const row = rows[rows.length - 1]
    if (row && Math.abs(b.rect.y - row[0].rect.y) <= ARRANGE_ROW_TOLERANCE) row.push(b)
    else rows.push([b])
  }
  return rows.flatMap((row) => row.sort((a, b) => a.rect.x - b.rect.x))
}

export function arrangeGrid(boxes: Boxed[], gap = ARRANGE_GAP): Arranged {
  const next = new Map<string, Point>()
  const prev = new Map<string, Point>()
  for (const { id, rect } of boxes) prev.set(id, { x: rect.x, y: rect.y })
  const n = boxes.length
  if (n === 0) return { next, prev }

  const order = readingOrder(boxes)
  const cols = Math.ceil(Math.sqrt(n))
  const cellW = Math.max(...order.map((b) => b.rect.w)) + gap
  const rowH: number[] = []
  for (let i = 0; i < n; i += cols) {
    rowH.push(Math.max(...order.slice(i, i + cols).map((b) => b.rect.h)) + gap)
  }
  const W = cols * cellW - gap
  const H = rowH.reduce((s, h) => s + h, 0) - gap

  const box = bounds(boxes)
  const x0 = box.x + box.w / 2 - W / 2
  const y0 = box.y + box.h / 2 - H / 2

  let top = 0
  order.forEach((b, k) => {
    const row = Math.floor(k / cols)
    if (k > 0 && k % cols === 0) top += rowH[row - 1]
    next.set(b.id, { x: Math.round(x0 + (k % cols) * cellW), y: Math.round(y0 + top) })
  })
  return { next, prev }
}
