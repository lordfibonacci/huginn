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

// Whether a single pointer that has not panned yet starts a pan.
export function panStep(s: { fromCard: boolean; dragging: boolean; dist: number }): 'wait' | 'start' | 'blocked' {
  if (s.dragging) return 'blocked'
  return s.dist > (s.fromCard ? CARD_PAN_SLOP : PAN_THRESHOLD) ? 'start' : 'wait'
}
