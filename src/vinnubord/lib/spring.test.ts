import { describe, it, expect } from 'vitest'
import { settled, stepSpring, type Spring } from './spring'

const start = (): Spring => ({ x: 0, y: 0, tx: 100, ty: 0, vx: 0, vy: 0 })

describe('stepSpring', () => {
  it('one step moves toward the target', () => {
    const s = stepSpring(start())
    expect(s.x).toBeGreaterThan(0)
    expect(s.x).toBeLessThan(100)
    expect(s.y).toBe(0)
    expect(s.vx).toBeGreaterThan(0)
  })

  it('is pure: the input is not changed', () => {
    const s0 = start()
    stepSpring(s0)
    expect(s0).toEqual(start())
  })

  it('after 60 steps from (0,0) to (100,0) x is within 0.5 of 100 and settled', () => {
    let s = start()
    for (let i = 0; i < 60; i++) s = stepSpring(s)
    expect(Math.abs(s.x - 100)).toBeLessThan(0.5)
    expect(settled(s)).toBe(true)
  })

  it('uses the given stiffness and damping', () => {
    const s = stepSpring(start(), 0.5, 1)
    expect(s.vx).toBeCloseTo(50)
    expect(s.x).toBeCloseTo(50)
  })
})

describe('settled', () => {
  it('false while far from the target', () => {
    expect(settled(start())).toBe(false)
  })
  it('false while still moving fast at the target', () => {
    expect(settled({ x: 100, y: 0, tx: 100, ty: 0, vx: 5, vy: 0 })).toBe(false)
  })
  it('true at rest on the target, respects eps', () => {
    expect(settled({ x: 100.05, y: 0, tx: 100, ty: 0, vx: 0.01, vy: 0 })).toBe(true)
    expect(settled({ x: 100.05, y: 0, tx: 100, ty: 0, vx: 0, vy: 0 }, 0.01)).toBe(false)
  })
})
