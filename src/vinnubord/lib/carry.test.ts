import { describe, expect, it } from 'vitest'
import { carrySpent, carryStep, type Carry } from './carry'

describe('carryStep', () => {
  it('starts from the data on the first drop', () => {
    expect(carryStep({ x: 100, y: 50 }, undefined, null, 30, -10)).toEqual({ x: 130, y: 40, baseX: 100, baseY: 50, viewId: null })
  })

  it('adds a second quick drop to the first while the data is stale', () => {
    const first = carryStep({ x: 100, y: 50 }, undefined, null, 30, 0)
    const second = carryStep({ x: 100, y: 50 }, first, null, 20, 5)
    expect(second).toEqual({ x: 150, y: 55, baseX: 100, baseY: 50, viewId: null })
  })

  it('starts from the data once the data shows the first drop', () => {
    const first = carryStep({ x: 100, y: 50 }, undefined, null, 30, 0)
    expect(carryStep({ x: 130, y: 50 }, first, null, 20, 0)).toEqual({ x: 150, y: 50, baseX: 130, baseY: 50, viewId: null })
  })

  it('ignores a carry made in another view', () => {
    const first = carryStep({ x: 100, y: 50 }, undefined, 'v1', 30, 0)
    expect(carryStep({ x: 100, y: 50 }, first, null, 20, 0)).toEqual({ x: 120, y: 50, baseX: 100, baseY: 50, viewId: null })
  })

  it('starts from a hand drop still on its way (a carry from the card pending)', () => {
    const pending: Carry = { x: 400, y: 300, baseX: 100, baseY: 50, viewId: null }
    expect(carryStep({ x: 100, y: 50 }, pending, null, 10, 10)).toEqual({ x: 410, y: 310, baseX: 100, baseY: 50, viewId: null })
  })

  it('rounds the result', () => {
    expect(carryStep({ x: 0, y: 0 }, undefined, null, 1.4, 2.6)).toMatchObject({ x: 1, y: 3 })
  })
})

describe('carrySpent', () => {
  const c: Carry = { x: 130, y: 50, baseX: 100, baseY: 50, viewId: 'v' }
  it('lives while the data still shows the base', () => {
    expect(carrySpent(c, { x: 100, y: 50 }, 'v')).toBe(false)
  })
  it('is spent when the data shows it', () => {
    expect(carrySpent(c, { x: 130, y: 50 }, 'v')).toBe(true)
  })
  it('is spent when someone else moved the card', () => {
    expect(carrySpent(c, { x: 500, y: 50 }, 'v')).toBe(true)
  })
  it('is spent in another view', () => {
    expect(carrySpent(c, { x: 100, y: 50 }, null)).toBe(true)
  })
})
