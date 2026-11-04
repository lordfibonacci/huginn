import { describe, expect, it } from 'vitest'
import { pendingDrop, pendingFailed, pendingStep, type Pending } from './pending'

const B = { x: 100, y: 50 }
const P1 = { x: 300, y: 50 }
const P3 = { x: 500, y: 90 }

// Feeds data positions through pendingStep, as the board does on each load.
function run(p: Pending | null, data: { x: number; y: number }[], viewId: string | null = null): Pending | null {
  for (const d of data) {
    if (!p) return null
    p = pendingStep(p, d, viewId)
  }
  return p
}

describe('pendingDrop', () => {
  it('starts from the data on a first drop', () => {
    expect(pendingDrop(null, 300, 50, B, null, true)).toEqual({ x: 300, y: 50, baseX: 100, baseY: 50, viewId: null, via: [] })
  })

  it('keeps the base and adds a sent drop to via', () => {
    const first = pendingDrop(null, P1.x, P1.y, B, null, true)
    expect(pendingDrop(first, P3.x, P3.y, B, null, true)).toEqual({ ...P3, baseX: 100, baseY: 50, viewId: null, via: [P1] })
  })

  it('leaves out a drop whose save was still in its debounce', () => {
    const first = pendingDrop(null, P1.x, P1.y, B, null, true)
    expect(pendingDrop(first, P3.x, P3.y, B, null, false).via).toEqual([])
  })

  it('starts over when the live pending was made in another view', () => {
    const first = pendingDrop(null, P1.x, P1.y, B, 'v1', true)
    expect(pendingDrop(first, P3.x, P3.y, { x: 7, y: 8 }, null, true)).toEqual({ ...P3, baseX: 7, baseY: 8, viewId: null, via: [] })
  })
})

describe('pendingStep', () => {
  it('ignores stale base and spends on the save landing', () => {
    const p = pendingDrop(null, P1.x, P1.y, B, null, true)
    expect(run(p, [B])).toEqual(p)
    expect(run(p, [B, P1])).toBeNull()
  })

  it('a quick second drop survives the late save of the first', () => {
    const first = pendingDrop(null, P1.x, P1.y, B, null, true)
    const second = pendingDrop(first, P3.x, P3.y, B, null, true)
    const after = run(second, [B, P1])
    expect(after).toEqual({ ...second, via: [] })
    expect(run(second, [B, P1, P3])).toBeNull()
  })

  it('an early undo back to base waits for the late arrange save', () => {
    const arranged = pendingDrop(null, P1.x, P1.y, B, null, true)
    const undo = pendingDrop(arranged, B.x, B.y, B, null, true)
    // stale base, then the arrange echo: both keep the undo
    expect(run(undo, [B])).toEqual(undo)
    expect(run(undo, [B, P1])).toEqual({ ...undo, via: [] })
    // the undo save lands
    expect(run(undo, [B, P1, B])).toBeNull()
  })

  it('a failed via point leaves via, so the landing spends the pending', () => {
    const arranged = pendingDrop(null, P1.x, P1.y, B, null, true)
    const undo = pendingDrop(arranged, B.x, B.y, B, null, true)
    const failed = pendingFailed(undo, P1, null) as Pending
    expect(failed.via).toEqual([])
    expect(run(failed, [B])).toBeNull()
  })

  it('merged reloads: data jumps from base to the final place of a second drop', () => {
    const first = pendingDrop(null, P1.x, P1.y, B, null, true)
    const second = pendingDrop(first, P3.x, P3.y, B, null, true)
    expect(run(second, [B, P3])).toBeNull()
  })

  it('merged reloads after an undo to base: the pending holds the data place, a foreign move spends it', () => {
    const arranged = pendingDrop(null, P1.x, P1.y, B, null, true)
    const undo = pendingDrop(arranged, B.x, B.y, B, null, true)
    const held = run(undo, [B, B]) as Pending
    expect(held).not.toBeNull()
    expect({ x: held.x, y: held.y }).toEqual(B)
    expect(run(held, [{ x: 900, y: 900 }])).toBeNull()
  })

  it('a base inside via is matched as base, so the earlier echo still counts', () => {
    const p1 = pendingDrop(null, P1.x, P1.y, B, null, true)
    const back = pendingDrop(p1, B.x, B.y, B, null, true)
    const p3 = pendingDrop(back, P3.x, P3.y, B, null, true)
    expect(p3.via).toEqual([P1, B])
    // stale base does not slice P1 off
    expect(run(p3, [B])).toEqual(p3)
    // the late P1 and B echoes keep it, the P3 save spends it
    expect(run(p3, [B, P1])).toEqual({ ...p3, via: [B] })
    expect(run(p3, [B, P1, B])).toEqual({ ...p3, via: [B] })
    expect(run(p3, [B, P1, B, P3])).toBeNull()
  })

  it('a foreign move to a spent via point spends the pending', () => {
    const first = pendingDrop(null, P1.x, P1.y, B, null, true)
    const second = pendingDrop(first, P3.x, P3.y, B, null, true)
    expect(run(second, [P1, P1])).toBeNull()
  })

  it('a foreign move anywhere else spends the pending', () => {
    const p = pendingDrop(null, P1.x, P1.y, B, null, true)
    expect(run(p, [{ x: 1, y: 2 }])).toBeNull()
  })

  it('is spent by a view switch', () => {
    const p = pendingDrop(null, P1.x, P1.y, B, 'v1', true)
    expect(run(p, [B], null)).toBeNull()
    expect(run(p, [B], 'v2')).toBeNull()
    expect(run(p, [B], 'v1')).toEqual(p)
  })
})

describe('pendingFailed', () => {
  it('rolls back when the failed save is the pending itself', () => {
    const p = pendingDrop(null, P1.x, P1.y, B, null, true)
    expect(pendingFailed(p, P1, null)).toBeNull()
  })

  it('leaves a pending of another view alone', () => {
    const p = pendingDrop(null, P1.x, P1.y, B, 'v1', true)
    expect(pendingFailed(p, P1, null)).toBe(p)
  })
})
