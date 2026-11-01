// Momentum for a released pan. Pure: the release velocity comes from the last
// pointer samples, each frame step returns the move and the decayed velocity.
// Velocities are px per ms.

// Only samples this close before the release count.
export const FLING_WINDOW_MS = 80
// A release at or above this speed (px/ms) starts a fling.
export const FLING_START = 0.2
// A fling below this speed (px/ms) is over.
export const FLING_STOP = 0.02
// Speed left after one 16 ms frame.
export const FLING_DECAY = 0.95

export type Sample = { t: number; x: number; y: number }
export type Velocity = { vx: number; vy: number }

const ZERO: Velocity = { vx: 0, vy: 0 }

// Speed of the pointer over the last FLING_WINDOW_MS before releasedAt. Zero
// with fewer than two samples in the window, which includes a finger that
// rested before it lifted.
export function releaseVelocity(samples: Sample[], releasedAt: number): Velocity {
  const inWindow = samples.filter((s) => s.t >= releasedAt - FLING_WINDOW_MS)
  if (inWindow.length < 2) return { ...ZERO }
  const first = inWindow[0]
  const last = inWindow[inWindow.length - 1]
  const gap = last.t - first.t
  if (gap <= 0) return { ...ZERO }
  return { vx: (last.x - first.x) / gap, vy: (last.y - first.y) / gap }
}

// One frame: move by velocity times dt (dt clamped to 32 ms so a stalled frame
// does not jump), then decay the velocity by FLING_DECAY per 16 ms.
export function flingStep(v: Velocity, dt: number): { dx: number; dy: number; vx: number; vy: number } {
  const d = Math.min(Math.max(dt, 0), 32)
  const k = Math.pow(FLING_DECAY, d / 16)
  return { dx: v.vx * d, dy: v.vy * d, vx: v.vx * k, vy: v.vy * k }
}

export function flingStarts(v: Velocity): boolean {
  return Math.hypot(v.vx, v.vy) > FLING_START
}

export function flingDone(v: Velocity): boolean {
  return Math.hypot(v.vx, v.vy) < FLING_STOP
}
