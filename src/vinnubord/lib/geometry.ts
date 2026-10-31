// Pure board geometry: the pan and zoom view, fitting, wires between a card and
// its module, and pinch. No React, no DOM. Screen coordinates are relative to
// the board element's top left corner, world coordinates are the board's own.
// A world point (wx, wy) is drawn at (x + wx * z, y + wy * z).

export type View = { x: number; y: number; z: number }
export type Rect = { x: number; y: number; w: number; h: number }
export type WireEnds = { x1: number; y1: number; x2: number; y2: number; dir: 1 | -1 }
export type PinchPoint = { cx: number; cy: number; d: number }

export const MIN_ZOOM = 0.2
export const MAX_ZOOM = 2.5
// fitAll never zooms closer than this, so a near empty board does not fill the screen.
export const FIT_MAX_ZOOM = 1.6

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

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
  const z = clamp(view.z * factor, min, max)
  const f = z / view.z
  return { x: cx - (cx - view.x) * f, y: cy - (cy - view.y) * f, z }
}

// The view that shows every rect centred inside the viewport less padding.
// Capped at FIT_MAX_ZOOM, not floored, so everything fits even below MIN_ZOOM.
export function fitAll(
  rects: Rect[],
  viewport: { w: number; h: number },
  padding: { top: number; sides: number; bottom: number },
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
  const W = Math.max(1, viewport.w - 2 * padding.sides)
  const H = Math.max(1, viewport.h - padding.top - padding.bottom)
  const bw = maxx - minx
  const bh = maxy - miny
  const z = Math.min(FIT_MAX_ZOOM, bw > 0 ? W / bw : Infinity, bh > 0 ? H / bh : Infinity)
  return {
    x: padding.sides + (W - bw * z) / 2 - minx * z,
    y: padding.top + (H - bh * z) / 2 - miny * z,
    z,
  }
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
  const z = clamp(view.z * factor, min, max)
  const [wx, wy] = screenToWorld(view, prev.cx, prev.cy)
  return { x: next.cx - wx * z, y: next.cy - wy * z, z }
}
