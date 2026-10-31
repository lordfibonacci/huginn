import { describe, it, expect } from 'vitest'
import {
  zoomAt,
  fitAll,
  screenToWorld,
  wireEndpoints,
  bezierControl,
  bezierPoint,
  bezierTail,
  pinchView,
  type View,
  type Rect,
} from './geometry'

describe('zoomAt', () => {
  it('keeps the world point under the cursor fixed', () => {
    const view: View = { x: 120, y: -40, z: 0.8 }
    const [wx, wy] = screenToWorld(view, 300, 200)
    const next = zoomAt(view, 1.25, 300, 200)
    const [ax, ay] = screenToWorld(next, 300, 200)
    expect(next.z).toBeCloseTo(1)
    expect(ax).toBeCloseTo(wx)
    expect(ay).toBeCloseTo(wy)
  })

  it('keeps the point fixed even when the zoom is clamped', () => {
    const view: View = { x: 10, y: 20, z: 2.2 }
    const [wx, wy] = screenToWorld(view, 50, 70)
    const next = zoomAt(view, 3, 50, 70)
    const [ax, ay] = screenToWorld(next, 50, 70)
    expect(next.z).toBe(2.5)
    expect(ax).toBeCloseTo(wx)
    expect(ay).toBeCloseTo(wy)
  })

  it('clamps to 0.2 and 2.5 by default', () => {
    expect(zoomAt({ x: 0, y: 0, z: 1 }, 100, 0, 0).z).toBe(2.5)
    expect(zoomAt({ x: 0, y: 0, z: 1 }, 0.01, 0, 0).z).toBe(0.2)
  })

  it('never zooms in when zooming out from a view already below the floor', () => {
    const view: View = { x: 40, y: 90, z: 0.1 }
    const [wx, wy] = screenToWorld(view, 500, 400)
    const next = zoomAt(view, 0.8, 500, 400)
    expect(next.z).toBe(0.1)
    const [ax, ay] = screenToWorld(next, 500, 400)
    expect(ax).toBeCloseTo(wx)
    expect(ay).toBeCloseTo(wy)
  })

  it('zooms in gradually from below the floor instead of snapping to it', () => {
    expect(zoomAt({ x: 0, y: 0, z: 0.1 }, 1.25, 0, 0).z).toBeCloseTo(0.125)
    expect(zoomAt({ x: 0, y: 0, z: 0.1 }, 10, 0, 0).z).toBe(1)
  })

  it('never zooms out when zooming in from a view already above the cap', () => {
    expect(zoomAt({ x: 0, y: 0, z: 3 }, 1.25, 0, 0).z).toBe(3)
    expect(zoomAt({ x: 0, y: 0, z: 3 }, 0.8, 0, 0).z).toBeCloseTo(2.4)
  })

  it('a fitted view of a huge board stays put on zoom out', () => {
    const fitted = fitAll([{ x: 0, y: 0, w: 20000, h: 100 }], { w: 1200, h: 800 }, { top: 90, sides: 40, bottom: 60 })
    expect(fitted.z).toBeLessThan(0.2)
    expect(zoomAt(fitted, 0.8, 600, 400).z).toBe(fitted.z)
  })

  it('honours custom limits', () => {
    expect(zoomAt({ x: 0, y: 0, z: 1 }, 10, 0, 0, 0.5, 1.5).z).toBe(1.5)
    expect(zoomAt({ x: 0, y: 0, z: 1 }, 0.1, 0, 0, 0.5, 1.5).z).toBe(0.5)
  })
})

describe('fitAll', () => {
  const vp = { w: 1200, h: 800 }
  const pad = { top: 90, sides: 40, bottom: 60 }

  function onScreen(view: View, r: Rect) {
    return {
      left: view.x + r.x * view.z,
      top: view.y + r.y * view.z,
      right: view.x + (r.x + r.w) * view.z,
      bottom: view.y + (r.y + r.h) * view.z,
    }
  }

  it('brings every rect inside the padded viewport', () => {
    const rects: Rect[] = [
      { x: -300, y: 100, w: 250, h: 150 },
      { x: 1800, y: 900, w: 250, h: 150 },
      { x: 400, y: -500, w: 600, h: 1200 },
    ]
    const view = fitAll(rects, vp, pad)
    for (const r of rects) {
      const s = onScreen(view, r)
      expect(s.left).toBeGreaterThanOrEqual(pad.sides - 1e-6)
      expect(s.right).toBeLessThanOrEqual(vp.w - pad.sides + 1e-6)
      expect(s.top).toBeGreaterThanOrEqual(pad.top - 1e-6)
      expect(s.bottom).toBeLessThanOrEqual(vp.h - pad.bottom + 1e-6)
    }
  })

  it('centres the content and does not zoom past 1.6', () => {
    const view = fitAll([{ x: 0, y: 0, w: 100, h: 50 }], vp, pad)
    expect(view.z).toBe(1.6)
    const s = onScreen(view, { x: 0, y: 0, w: 100, h: 50 })
    expect((s.left + s.right) / 2).toBeCloseTo(pad.sides + (vp.w - 2 * pad.sides) / 2)
    expect((s.top + s.bottom) / 2).toBeCloseTo(pad.top + (vp.h - pad.top - pad.bottom) / 2)
  })

  it('returns the identity view for no rects', () => {
    expect(fitAll([], vp, pad)).toEqual({ x: 0, y: 0, z: 1 })
  })
})

describe('screenToWorld', () => {
  it('inverts the view transform', () => {
    expect(screenToWorld({ x: 100, y: 50, z: 2 }, 300, 250)).toEqual([100, 100])
  })
})

describe('wireEndpoints', () => {
  const mod: Rect = { x: 1000, y: 200, w: 300, h: 80 }

  it('leaves from the right side when the card is left of the module', () => {
    const card: Rect = { x: 200, y: 400, w: 250, h: 150 }
    const e = wireEndpoints(card, mod)
    expect(e.dir).toBe(1)
    expect(e.x1).toBe(450)
    expect(e.y1).toBe(475)
    expect(e.x2).toBe(1002)
    expect(e.y2).toBe(240)
  })

  it('leaves from the left side when the card is right of the module', () => {
    const card: Rect = { x: 1500, y: 100, w: 250, h: 150 }
    const e = wireEndpoints(card, mod)
    expect(e.dir).toBe(-1)
    expect(e.x1).toBe(1500)
    expect(e.y1).toBe(175)
    expect(e.x2).toBe(1298)
    expect(e.y2).toBe(240)
  })
})

describe('bezier', () => {
  const e = { x1: 0, y1: 0, x2: 400, y2: 100, dir: 1 as const }

  it('pulls control points along the wire direction, at least 90 px times zoom', () => {
    expect(bezierControl(e, 1)).toEqual([180, 0, 220, 100])
    const short = { x1: 0, y1: 0, x2: 20, y2: 0, dir: -1 as const }
    expect(bezierControl(short, 2)).toEqual([-180, 0, 200, 0])
  })

  it('starts and ends on the endpoints', () => {
    const c = bezierControl(e, 1)
    expect(bezierPoint(e, c, 0)).toEqual([0, 0])
    expect(bezierPoint(e, c, 1)).toEqual([400, 100])
    const [mx, my] = bezierPoint(e, c, 0.5)
    expect(mx).toBeCloseTo(200)
    expect(my).toBeCloseTo(50)
  })

  it('bezierTail is the part of the curve from t to the end', () => {
    const c = bezierControl(e, 1)
    expect(bezierTail(e, c, 0)).toEqual({ e, c })
    const t = 0.3
    const tail = bezierTail(e, c, t)
    const [sx, sy] = bezierPoint(e, c, t)
    expect(tail.e.x1).toBeCloseTo(sx)
    expect(tail.e.y1).toBeCloseTo(sy)
    expect(tail.e.x2).toBe(400)
    expect(tail.e.y2).toBe(100)
    for (const s of [0.25, 0.5, 0.9]) {
      const [ax, ay] = bezierPoint(tail.e, tail.c, s)
      const [bx, by] = bezierPoint(e, c, t + s * (1 - t))
      expect(ax).toBeCloseTo(bx)
      expect(ay).toBeCloseTo(by)
    }
  })

  it('bezierTail at 1 shrinks to the end point', () => {
    const c = bezierControl(e, 1)
    const tail = bezierTail(e, c, 1)
    expect(bezierPoint(tail.e, tail.c, 0.5)[0]).toBeCloseTo(400)
    expect(bezierPoint(tail.e, tail.c, 0.5)[1]).toBeCloseTo(100)
  })
})

describe('pinchView', () => {
  it('is a pure pan when the distance is unchanged', () => {
    const view: View = { x: 30, y: 40, z: 1.2 }
    const next = pinchView(view, { cx: 200, cy: 300, d: 120 }, { cx: 260, cy: 280, d: 120 })
    expect(next.z).toBeCloseTo(1.2)
    expect(next.x).toBeCloseTo(90)
    expect(next.y).toBeCloseTo(20)
  })

  it('doubles z and keeps the centre fixed when the distance doubles', () => {
    const view: View = { x: 30, y: 40, z: 0.6 }
    const [wx, wy] = screenToWorld(view, 200, 300)
    const next = pinchView(view, { cx: 200, cy: 300, d: 100 }, { cx: 200, cy: 300, d: 200 })
    expect(next.z).toBeCloseTo(1.2)
    const [ax, ay] = screenToWorld(next, 200, 300)
    expect(ax).toBeCloseTo(wx)
    expect(ay).toBeCloseTo(wy)
  })

  it('clamps zoom like zoomAt', () => {
    const next = pinchView({ x: 0, y: 0, z: 2 }, { cx: 0, cy: 0, d: 10 }, { cx: 0, cy: 0, d: 100 })
    expect(next.z).toBe(2.5)
  })

  it('never zooms in when pinching out from a view below the floor', () => {
    const next = pinchView({ x: 0, y: 0, z: 0.1 }, { cx: 0, cy: 0, d: 100 }, { cx: 0, cy: 0, d: 50 })
    expect(next.z).toBe(0.1)
  })
})
