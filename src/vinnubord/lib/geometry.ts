// Pure board geometry: the pan and zoom view, fitting, wires between a card and
// its module, and pinch. No React, no DOM. Screen coordinates are relative to
// the board element's top left corner, world coordinates are the board's own.
// A world point (wx, wy) is drawn at (x + wx * z, y + wy * z).

import { SHEET_HALF } from './sheet'

export type View = { x: number; y: number; z: number }
export type Rect = { x: number; y: number; w: number; h: number }
export type WireEnds = { x1: number; y1: number; x2: number; y2: number; dir: 1 | -1 }
export type PinchPoint = { cx: number; cy: number; d: number }

// Free area around the board content: what the toolbar, the list drawer and the
// panel leave uncovered. fitAll, fitWidth and revealView centre inside it.
export type Padding = { top: number; left: number; right: number; bottom: number }
export const DEFAULT_PADDING: Padding = { top: 90, left: 40, right: 40, bottom: 60 }

export const MIN_ZOOM = 0.2
export const MAX_ZOOM = 2.5
// fitAll never zooms closer than this, so a near empty board does not fill the screen.
export const FIT_MAX_ZOOM = 1.6

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

// Clamp a new zoom to [min, max], but a view already outside that range (a
// fitAll of a huge board can land below min) is never pushed further out and
// never snaps: zooming out below the floor keeps z, zooming in moves freely.
const clampZoom = (current: number, next: number, min: number, max: number) =>
  clamp(next, Math.min(min, current), Math.max(max, current))

export function screenToWorld(view: View, sx: number, sy: number): [number, number] {
  return [(sx - view.x) / view.z, (sy - view.y) / view.z]
}

// Zoom by factor around the screen point (cx, cy), which stays over the same world point.
export function zoomAt(
  view: View,
  factor: number,
  cx: number,
  cy: number,
  min = MIN_ZOOM,
  max = MAX_ZOOM,
): View {
  const z = clampZoom(view.z, view.z * factor, min, max)
  const f = z / view.z
  return { x: cx - (cx - view.x) * f, y: cy - (cy - view.y) * f, z }
}

// The view that shows every rect centred inside the viewport less padding.
// Capped at FIT_MAX_ZOOM, not floored, so everything fits even below MIN_ZOOM.
// zoomAt and pinchView then keep such a view instead of snapping to MIN_ZOOM.
export function fitAll(
  rects: Rect[],
  viewport: { w: number; h: number },
  padding: Padding,
): View {
  if (rects.length === 0) return { x: 0, y: 0, z: 1 }
  let minx = Infinity
  let miny = Infinity
  let maxx = -Infinity
  let maxy = -Infinity
  for (const r of rects) {
    minx = Math.min(minx, r.x)
    miny = Math.min(miny, r.y)
    maxx = Math.max(maxx, r.x + r.w)
    maxy = Math.max(maxy, r.y + r.h)
  }
  const W = Math.max(1, viewport.w - padding.left - padding.right)
  const H = Math.max(1, viewport.h - padding.top - padding.bottom)
  const bw = maxx - minx
  const bh = maxy - miny
  const z = Math.min(FIT_MAX_ZOOM, bw > 0 ? W / bw : Infinity, bh > 0 ? H / bh : Infinity)
  return {
    x: padding.left + (W - bw * z) / 2 - minx * z,
    y: padding.top + (H - bh * z) / 2 - miny * z,
    z,
  }
}

// The view that fits a rect to the padded viewport width, centred when it is
// narrower than the width, with its top at the top padding. Capped at maxZoom.
// For a tall column on a phone, where fitting the height would be tiny.
export function fitWidth(
  rect: Rect,
  viewport: { w: number; h: number },
  padding: Padding,
  maxZoom = FIT_MAX_ZOOM,
): View {
  const W = Math.max(1, viewport.w - padding.left - padding.right)
  const z = Math.min(maxZoom, W / rect.w)
  return {
    x: padding.left + (W - rect.w * z) / 2 - rect.x * z,
    y: padding.top - rect.y * z,
    z,
  }
}

// A CSS length such as "460px" as a number, 0 for anything else.
export function parsePx(raw: string): number {
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) ? n : 0
}

// The padding that leaves out what covers the board: the list drawer on the
// left, the side panel on the right, and on a phone the half sheet. SHEET_HALF
// is how far the sheet is pushed down at the half stop, so it covers the bottom
// 1 minus SHEET_HALF of the board and the free area is the upper SHEET_HALF.
// Written as h minus h times SHEET_HALF, which stays a whole pixel (800 gives 440).
export function freeRect(
  size: { w: number; h: number },
  cover: { list: number; panel: number; sheet: boolean },
  base: Padding = DEFAULT_PADDING,
): Padding {
  return {
    top: base.top,
    left: base.left + cover.list,
    right: base.right + cover.panel,
    bottom: cover.sheet ? Math.max(base.bottom, size.h - size.h * SHEET_HALF) : base.bottom,
  }
}

// The view that brings a card into the centre of the free area. A zoom already
// readable (REVEAL_MIN_ZOOM to MAX_ZOOM) is kept, else it goes to the minimum.
export const REVEAL_MIN_ZOOM = 0.8
export function revealView(
  card: Rect,
  current: View,
  size: { w: number; h: number },
  padding: Padding,
): View {
  const z = current.z >= REVEAL_MIN_ZOOM && current.z <= MAX_ZOOM ? current.z : REVEAL_MIN_ZOOM
  const fx = padding.left + (size.w - padding.left - padding.right) / 2
  const fy = padding.top + (size.h - padding.top - padding.bottom) / 2
  return { x: fx - (card.x + card.w / 2) * z, y: fy - (card.y + card.h / 2) * z, z }
}

// The opening view on a phone or a touch board: the pack's top left corner at
// pad px from the board's top left, at a readable zoom. left is what covers the
// board's left edge (an open list drawer), the corner starts right of it.
export const START_ZOOM = 0.8
export const START_PAD = 16
export function startAtPack(pack: { x: number; y: number }, z = START_ZOOM, pad = START_PAD, left = 0): View {
  return { x: left + pad - pack.x * z, y: pad - pack.y * z, z }
}

// Wire from card a to module b. It leaves the card on the side facing the
// module: the right side when the card's centre is left of the module's
// centre, else the left side. It lands 2 px inside the module's near edge.
export function wireEndpoints(a: Rect, b: Rect): WireEnds {
  const ay = a.y + a.h / 2
  const by = b.y + b.h / 2
  if (a.x + a.w / 2 < b.x + b.w / 2) {
    return { x1: a.x + a.w, y1: ay, x2: b.x + 2, y2: by, dir: 1 }
  }
  return { x1: a.x, y1: ay, x2: b.x + b.w - 2, y2: by, dir: -1 }
}

// Cubic control points: pulled horizontally along dir by at least 90 px times
// zoom, or 45 percent of the horizontal span when that is longer.
export function bezierControl(e: WireEnds, z: number): [number, number, number, number] {
  const dx = Math.max(90 * z, Math.abs(e.x2 - e.x1) * 0.45) * e.dir
  return [e.x1 + dx, e.y1, e.x2 - dx, e.y2]
}

// Point on the cubic at t in [0, 1], c from bezierControl.
export function bezierPoint(
  e: WireEnds,
  c: [number, number, number, number],
  t: number,
): [number, number] {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const d = 3 * u * t * t
  const f = t * t * t
  return [a * e.x1 + b * c[0] + d * c[2] + f * e.x2, a * e.y1 + b * c[1] + d * c[3] + f * e.y2]
}

// The part of the cubic from t to its end (de Casteljau split), as endpoints
// and control points that draw just that part. The entry draw up uses it to
// grow each wire out of its module towards the card.
export function bezierTail(
  e: WireEnds,
  c: [number, number, number, number],
  t: number,
): { e: WireEnds; c: [number, number, number, number] } {
  if (t <= 0) return { e, c }
  const lerp = (a: number, b: number) => a + (b - a) * t
  const p12x = lerp(c[0], c[2])
  const p12y = lerp(c[1], c[3])
  const p23x = lerp(c[2], e.x2)
  const p23y = lerp(c[3], e.y2)
  const [sx, sy] = bezierPoint(e, c, t)
  return {
    e: { x1: sx, y1: sy, x2: e.x2, y2: e.y2, dir: e.dir },
    c: [lerp(p12x, p23x), lerp(p12y, p23y), p23x, p23y],
  }
}

// Two finger gesture step: zoom by the change in finger distance and keep the
// world point that was under the old centre under the new centre (pan follows).
export function pinchView(
  view: View,
  prev: PinchPoint,
  next: PinchPoint,
  min = MIN_ZOOM,
  max = MAX_ZOOM,
): View {
  const factor = prev.d > 0 ? next.d / prev.d : 1
  const z = clampZoom(view.z, view.z * factor, min, max)
  const [wx, wy] = screenToWorld(view, prev.cx, prev.cy)
  return { x: next.cx - wx * z, y: next.cy - wy * z, z }
}
