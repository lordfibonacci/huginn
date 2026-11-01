import { describe, expect, it } from 'vitest'
import { FLING_DECAY, FLING_START, FLING_STOP, flingDone, flingStarts, flingStep, releaseVelocity } from './fling'

describe('releaseVelocity', () => {
  it('uses the samples inside the 80 ms window before release', () => {
    const v = releaseVelocity([{ t: 0, x: 0, y: 0 }, { t: 50, x: 100, y: 0 }, { t: 100, x: 150, y: 20 }], 100)
    // 50 px over 50 ms from the first sample inside the window (t 50) to the last (t 100): 1 px/ms, y 0.4
    expect(v.vx).toBeCloseTo(1)
    expect(v.vy).toBeCloseTo(0.4)
  })
  it('is zero with fewer than two samples in the window', () => {
    expect(releaseVelocity([{ t: 100, x: 5, y: 5 }], 100)).toEqual({ vx: 0, vy: 0 })
  })
  it('is zero when the finger rested before release', () => {
    expect(releaseVelocity([{ t: 0, x: 0, y: 0 }, { t: 10, x: 100, y: 0 }], 200)).toEqual({ vx: 0, vy: 0 })
  })
})

describe('flingStep and flingDone', () => {
  it('moves by velocity times dt and decays by FLING_DECAY per 16 ms', () => {
    const s = flingStep({ vx: 1, vy: 0 }, 16)
    expect(s.dx).toBeCloseTo(16)
    expect(s.vx).toBeCloseTo(FLING_DECAY)
  })
  it('clamps dt to 32 ms', () => {
    expect(flingStep({ vx: 1, vy: 0 }, 100).dx).toBeCloseTo(32)
  })
  it('starts above FLING_START and ends below FLING_STOP', () => {
    expect(flingStarts({ vx: FLING_START + 0.01, vy: 0 })).toBe(true)
    expect(flingStarts({ vx: 0.1, vy: 0.1 })).toBe(false)
    expect(flingDone({ vx: FLING_STOP / 2, vy: 0 })).toBe(true)
    expect(flingDone({ vx: 0.1, vy: 0 })).toBe(false)
  })
})
