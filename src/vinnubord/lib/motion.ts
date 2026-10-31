// Pure pieces of the board motion: when the wire canvas may skip a frame,
// how far the entry draw up has come, and reading a CSS time token.

// What one canvas frame knows before it draws. changed: the wire list, the
// view, the hot set or a watched element size changed since the last draw.
// moving: a card spring moved this frame. sparks: sparks alive on any wire.
// drawingUp: the entry draw up is still running. awake: inside a window the
// board asked to keep drawing for (cards popping in change their rects).
export type FrameState = {
  changed: boolean
  moving: boolean
  sparks: number
  drawingUp: boolean
  awake: boolean
}

// True when the last drawn frame is still correct and drawing can be skipped.
export function canvasIdle(f: FrameState): boolean {
  return !f.changed && !f.moving && f.sparks === 0 && !f.drawingUp && !f.awake
}

// Share of each wire drawn, elapsed ms after the draw up started, eased out
// (cubic) so the wires shoot out and settle. 1 means fully drawn.
export function drawUpProgress(elapsed: number, duration: number): number {
  if (duration <= 0) return 1
  const t = Math.min(1, Math.max(0, elapsed / duration))
  return 1 - (1 - t) ** 3
}

// A CSS time ("0.7s", "150ms") in ms, 0 when it cannot be read.
export function parseDuration(value: string): number {
  const m = value.trim().match(/^(-?[\d.]+)(ms|s)$/)
  if (!m) return 0
  const n = Number(m[1])
  if (!Number.isFinite(n)) return 0
  return m[2] === 's' ? n * 1000 : n
}
