import { describe, expect, it } from 'vitest'
import { CARD_PAN_SLOP, PAN_THRESHOLD, panStep, pressOutcome } from './gesture'

describe('pressOutcome', () => {
  const base = { dragging: false, moved: false, touch: false, sawPinch: false }
  it('a moved drag drops', () => {
    expect(pressOutcome({ ...base, dragging: true, moved: true })).toBe('drop')
    expect(pressOutcome({ ...base, touch: true, dragging: true, moved: true })).toBe('drop')
  })
  it('mouse lifted on down and not moved is a tap', () => {
    expect(pressOutcome({ ...base, dragging: true })).toBe('tap')
  })
  it('touch released before the long press is a tap', () => {
    expect(pressOutcome({ ...base, touch: true })).toBe('tap')
  })
  it('touch held to lift and let go without moving is nothing', () => {
    expect(pressOutcome({ ...base, touch: true, dragging: true })).toBe('none')
  })
  it('a press that saw a pinch never taps', () => {
    expect(pressOutcome({ ...base, touch: true, sawPinch: true })).toBe('none')
  })
})

describe('panStep', () => {
  it('off card pans past the small threshold', () => {
    expect(panStep({ fromCard: false, dragging: false, dist: PAN_THRESHOLD })).toBe('wait')
    expect(panStep({ fromCard: false, dragging: false, dist: PAN_THRESHOLD + 1 })).toBe('start')
  })
  it('a card touch pans only past the card slop', () => {
    expect(panStep({ fromCard: true, dragging: false, dist: CARD_PAN_SLOP })).toBe('wait')
    expect(panStep({ fromCard: true, dragging: false, dist: CARD_PAN_SLOP + 1 })).toBe('start')
  })
  it('never pans a pointer that drags a card', () => {
    expect(panStep({ fromCard: true, dragging: true, dist: 500 })).toBe('blocked')
  })
  it('the card slop is wider than the board threshold', () => {
    expect(CARD_PAN_SLOP).toBeGreaterThan(PAN_THRESHOLD)
  })
})
