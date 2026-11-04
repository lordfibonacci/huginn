import type { Rect } from './geometry'
import type { Boxed } from './selection'
import type { ViewZonePosition, Zone } from './types'

// Boxes (kassar) on the board: a titled rectangle drawn behind the cards.
// A box owns its size everywhere and its place on the main board; inside a
// view it may sit somewhere else (hg_view_zone_positions). What lies in a
// box is decided at the press, by the centre of each card and pack title.

export type Point = { x: number; y: number }
export type Size = { w: number; h: number }

export const ZONE_MIN: Size = { w: 160, h: 120 }
export const ZONE_TITLE_MAX = 60
export const DEFAULT_ZONE_TITLE = 'Kassi'
export const DEFAULT_ZONE_COLOR = 'lilac'

export const ZONE_TITLE_EMPTY = 'Kassinn þarf nafn.'
export const ZONE_TITLE_TOO_LONG = 'Nafnið má mest vera 60 stafir.'

// The box places of one view, keyed by zone id. The main board (null) has
// none, every box sits at its own pos_x and pos_y there.
export function zonePositionsOf(rows: ViewZonePosition[], viewId: string | null): Map<string, Point> {
  const out = new Map<string, Point>()
  if (viewId === null) return out
  for (const r of rows) if (r.view_id === viewId) out.set(r.zone_id, { x: r.pos_x, y: r.pos_y })
  return out
}

// Where a box is drawn: the view place when there is one, else its own, and
// always its own size.
export function zoneRect(zone: Zone, positions: Map<string, Point>): Rect {
  const p = positions.get(zone.id)
  return { x: p ? p.x : zone.pos_x, y: p ? p.y : zone.pos_y, w: zone.w, h: zone.h }
}

export function clampZoneSize(size: Size): Size {
  return { w: Math.max(ZONE_MIN.w, Math.round(size.w)), h: Math.max(ZONE_MIN.h, Math.round(size.h)) }
}

// A drawn box is kept only when both sides reach the minimum.
export function draftBigEnough(rect: Rect): boolean {
  return rect.w >= ZONE_MIN.w && rect.h >= ZONE_MIN.h
}

function centreInside(rect: Rect, box: Rect): boolean {
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  return rect.x <= cx && cx <= rect.x + rect.w && rect.y <= cy && cy <= rect.y + rect.h
}

// The cards and pack titles whose centre lies in the box, the border
// included, in input order.
export function zoneMembers(rect: Rect, cards: Boxed[], packTitles: Boxed[]): { cards: string[]; packs: string[] } {
  return {
    cards: cards.filter((b) => centreInside(rect, b.rect)).map((b) => b.id),
    packs: packTitles.filter((b) => centreInside(rect, b.rect)).map((b) => b.id),
  }
}

export function normalizeZoneTitle(input: string): { ok: true; title: string } | { ok: false; reason: string } {
  const title = input.replace(/\s+/g, ' ').trim()
  if (title === '') return { ok: false, reason: ZONE_TITLE_EMPTY }
  if (title.length > ZONE_TITLE_MAX) return { ok: false, reason: ZONE_TITLE_TOO_LONG }
  return { ok: true, title }
}
