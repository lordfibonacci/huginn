import { describe, it, expect } from 'vitest'
import { ARRANGE_GAP, arrangeGrid } from './arrange'

const box = (id: string, x: number, y: number, w = 100, h = 50) => ({ id, rect: { x, y, w, h } })

describe('arrangeGrid', () => {
  it('one box stays where it is and remembers its place', () => {
    const out = arrangeGrid([box('a', 10, 20)])
    expect(out.next.get('a')).toEqual({ x: 10, y: 20 })
    expect(out.prev.get('a')).toEqual({ x: 10, y: 20 })
  })
  it('four boxes make a 2 by 2 grid centred on their bounding box', () => {
    const out = arrangeGrid([box('a', 0, 0), box('b', 500, 0), box('c', 0, 300), box('d', 500, 300)])
    expect(ARRANGE_GAP).toBe(24)
    expect(out.next.get('a')).toEqual({ x: 188, y: 113 })
    expect(out.next.get('b')).toEqual({ x: 312, y: 113 })
    expect(out.next.get('c')).toEqual({ x: 188, y: 187 })
    expect(out.next.get('d')).toEqual({ x: 312, y: 187 })
  })
  it('reads rows top to bottom and left to right with a tolerance, five boxes make 3 and 2', () => {
    const out = arrangeGrid([box('e', 900, 30), box('a', 0, 0), box('d', 0, 400), box('b', 300, 20), box('c', 600, 0)])
    const order = [...out.next.entries()].sort((p, q) => p[1].y - q[1].y || p[1].x - q[1].x).map(([id]) => id)
    // Reading order is a, b, c, e (all within the tolerance of y 0), then d: the
    // second grid row holds e then d.
    expect(order).toEqual(['a', 'b', 'c', 'e', 'd'])
    const ys = new Set([...out.next.values()].map((p) => p.y))
    expect(ys.size).toBe(2)
  })
  it('column width follows the widest box, row height the tallest in that row', () => {
    const out = arrangeGrid([box('a', 0, 0, 100, 50), box('b', 200, 0, 200, 50), box('c', 0, 200, 100, 150), box('d', 200, 200, 100, 50)])
    const a = out.next.get('a')!
    const b = out.next.get('b')!
    const c = out.next.get('c')!
    expect(b.x - a.x).toBe(224)
    expect(c.y - a.y).toBe(74)
  })
})
