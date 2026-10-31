// Damped spring for a dragged card, one animation frame per step. Pure: each
// step returns a new state. Stiffness k pulls toward the target (tx, ty),
// damping d bleeds speed. Values from mockup v7.

export type Spring = { x: number; y: number; tx: number; ty: number; vx: number; vy: number }

export function stepSpring(s: Spring, k = 0.12, d = 0.72): Spring {
  const vx = (s.vx + (s.tx - s.x) * k) * d
  const vy = (s.vy + (s.ty - s.y) * k) * d
  return { x: s.x + vx, y: s.y + vy, tx: s.tx, ty: s.ty, vx, vy }
}

// At rest: within eps of the target on both axes and slower than eps.
export function settled(s: Spring, eps = 0.1): boolean {
  return (
    Math.abs(s.tx - s.x) < eps &&
    Math.abs(s.ty - s.y) < eps &&
    Math.abs(s.vx) < eps &&
    Math.abs(s.vy) < eps
  )
}
