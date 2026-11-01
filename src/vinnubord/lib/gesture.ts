// Pure pointer decisions shared by useViewport and useCardDrag. Distances are
// Manhattan distances in screen px from the pointerdown point.

// A pointer that starts off cards pans past this.
export const PAN_THRESHOLD = 3
// A touch that starts on a card pans past this, and the same movement cancels
// the card's long press, so the two never both act on one finger.
export const CARD_PAN_SLOP = 10

export type PressState = { dragging: boolean; moved: boolean; touch: boolean; sawPinch: boolean }

// What the release of a card press means.
export function pressOutcome(p: PressState): 'drop' | 'tap' | 'none' {
  if (p.dragging && p.moved) return 'drop'
  if (p.sawPinch) return 'none'
  // Mouse lifts on down, so a still mouse press is a tap. A touch that lifted
  // by long press and did not move is just put back.
  if (!p.touch || !p.dragging) return 'tap'
  return 'none'
}

// What a touch started on, as classified by useViewport.
export type TouchKind = 'field' | 'noPan' | 'button' | 'card' | 'board'

// Fields and data-no-pan areas keep their own touch behaviour; everything else
// is tracked, buttons included (a swipe that starts on a button still pans).
export function touchTracks(kind: TouchKind): boolean {
  return kind !== 'field' && kind !== 'noPan'
}

// How far a tracked touch moves before it becomes a pan.
export function touchSlop(kind: TouchKind): number {
  return kind === 'button' || kind === 'card' ? CARD_PAN_SLOP : PAN_THRESHOLD
}

// Whether a single pointer that has not panned yet starts a pan.
export function panStep(s: { slop: number; dragging: boolean; dist: number }): 'wait' | 'start' | 'blocked' {
  if (s.dragging) return 'blocked'
  return s.dist > s.slop ? 'start' : 'wait'
}

// Two quick taps close together are a double tap. Unlike the pan slops this
// distance is straight line (the spec test has a 20 + 10 px pair that counts).
export const DOUBLE_TAP_MS = 300
export const DOUBLE_TAP_SLOP = 24
// A double tap on the empty board zooms in by this around the tap.
export const DOUBLE_TAP_FACTOR = 2

export type Tap = { t: number; x: number; y: number }

export function isDoubleTap(prev: Tap | null, next: Tap): boolean {
  if (!prev) return false
  return next.t - prev.t <= DOUBLE_TAP_MS && Math.hypot(next.x - prev.x, next.y - prev.y) <= DOUBLE_TAP_SLOP
}
