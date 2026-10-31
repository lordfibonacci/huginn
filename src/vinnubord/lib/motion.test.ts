import { describe, expect, it } from 'vitest'
import { canvasIdle, drawUpProgress, parseDuration } from './motion'

describe('canvasIdle', () => {
  const quiet = { changed: false, moving: false, sparks: 0, drawingUp: false, awake: false }

  it('is idle when nothing moved, changed, sparks or draws up', () => {
    expect(canvasIdle(quiet)).toBe(true)
  })

  it('draws on any change, moving spring, live spark, draw up or wake window', () => {
    expect(canvasIdle({ ...quiet, changed: true })).toBe(false)
    expect(canvasIdle({ ...quiet, moving: true })).toBe(false)
    expect(canvasIdle({ ...quiet, sparks: 1 })).toBe(false)
    expect(canvasIdle({ ...quiet, drawingUp: true })).toBe(false)
    expect(canvasIdle({ ...quiet, awake: true })).toBe(false)
  })
})

describe('drawUpProgress', () => {
  it('runs from 0 to 1 over the duration and clamps', () => {
    expect(drawUpProgress(-50, 1100)).toBe(0)
    expect(drawUpProgress(0, 1100)).toBe(0)
    expect(drawUpProgress(1100, 1100)).toBe(1)
    expect(drawUpProgress(5000, 1100)).toBe(1)
  })

  it('eases out: past half way at the midpoint, and only grows', () => {
    const mid = drawUpProgress(550, 1100)
    expect(mid).toBeGreaterThan(0.5)
    expect(mid).toBeLessThan(1)
    let last = 0
    for (let t = 0; t <= 1100; t += 50) {
      const p = drawUpProgress(t, 1100)
      expect(p).toBeGreaterThanOrEqual(last)
      last = p
    }
  })

  it('is done at once when the duration is zero', () => {
    expect(drawUpProgress(0, 0)).toBe(1)
  })
})

describe('parseDuration', () => {
  it('reads seconds and milliseconds from a css time', () => {
    expect(parseDuration('0.7s')).toBe(700)
    expect(parseDuration(' 150ms ')).toBe(150)
    expect(parseDuration('0s')).toBe(0)
  })

  it('is 0 for anything it cannot read', () => {
    expect(parseDuration('')).toBe(0)
    expect(parseDuration('fast')).toBe(0)
  })
})
