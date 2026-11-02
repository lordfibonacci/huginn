import type { Rect } from './geometry'

// Multi selection on the board (mouse only): a Ctrl or Cmd press drags a
// marquee, the cards it touches and the packs whose title it touches are
// selected, and a drag on any member moves the whole selection by the same
// delta. Everything here is geometry and sets, Board owns the DOM and the
// saves.

export type Point = { x: number; y: number }
export type SelTarget = { kind: 'card' | 'pack'; id: string }
export type Selection = { cards: ReadonlySet<string>; packs: ReadonlySet<string> }

export const EMPTY_SELECTION: Selection = { cards: new Set(), packs: new Set() }

// A press moves at least this far (screen px) before it is a marquee; under
// it the press is a Ctrl click.
export const MARQUEE_MIN = 4

type PressLike = { pointerType: string; button: number; ctrlKey: boolean; metaKey: boolean }

// Only a primary mouse press with Ctrl (Cmd on a Mac) draws a marquee.
export function isMarqueePress(e: PressLike): boolean {
  return e.pointerType === 'mouse' && e.button === 0 && (e.ctrlKey || e.metaKey)
}

export function selKey(t: SelTarget): string {
  return `${t.kind}:${t.id}`
}

export function isMember(sel: Selection, t: SelTarget): boolean {
  return t.kind === 'card' ? sel.cards.has(t.id) : sel.packs.has(t.id)
}

export function selectionSize(sel: Selection): number {
  return sel.cards.size + sel.packs.size
}

// The rectangle between two corners, any order.
export function marqueeRect(a: Point, b: Point): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) }
}

export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

export type Boxed = { id: string; rect: Rect }

// The selection a marquee makes: cards whose box it touches and packs whose
// title box it touches. With base it adds to that selection (Shift).
export function selectInRect(rect: Rect, cards: Boxed[], packTitles: Boxed[], base: Selection = EMPTY_SELECTION): Selection {
  const c = new Set(base.cards)
  const p = new Set(base.packs)
  for (const b of cards) if (intersects(rect, b.rect)) c.add(b.id)
  for (const b of packTitles) if (intersects(rect, b.rect)) p.add(b.id)
  return { cards: c, packs: p }
}

// Ctrl click: a card or pack joins the selection or leaves it.
export function toggleMember(sel: Selection, t: SelTarget): Selection {
  const c = new Set(sel.cards)
  const p = new Set(sel.packs)
  const set = t.kind === 'card' ? c : p
  if (set.has(t.id)) set.delete(t.id)
  else set.add(t.id)
  return { cards: c, packs: p }
}

// Every member's new place when the gripped member is at (x, y): the same
// delta from its start for all. start holds each member's position at the
// press, keyed by selKey, and must hold the grip.
export function groupMoves(start: Map<string, Point>, grip: SelTarget, x: number, y: number): Map<string, Point> {
  const g = start.get(selKey(grip))
  const out = new Map<string, Point>()
  if (!g) return out
  const dx = x - g.x
  const dy = y - g.y
  for (const [key, p] of start) out.set(key, { x: p.x + dx, y: p.y + dy })
  return out
}

export function parseSelKey(key: string): SelTarget {
  const i = key.indexOf(':')
  return { kind: key.slice(0, i) as SelTarget['kind'], id: key.slice(i + 1) }
}
