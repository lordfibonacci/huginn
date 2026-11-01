import { describe, expect, it } from 'vitest'
import { CARD_PAN_SLOP, PAN_THRESHOLD, isDoubleTap, panStep, pressOutcome, touchSlop, touchTracks } from './gesture'

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
    expect(panStep({ slop: PAN_THRESHOLD, dragging: false, dist: PAN_THRESHOLD })).toBe('wait')
    expect(panStep({ slop: PAN_THRESHOLD, dragging: false, dist: PAN_THRESHOLD + 1 })).toBe('start')
  })
  it('a card touch pans only past the card slop', () => {
    expect(panStep({ slop: CARD_PAN_SLOP, dragging: false, dist: CARD_PAN_SLOP })).toBe('wait')
    expect(panStep({ slop: CARD_PAN_SLOP, dragging: false, dist: CARD_PAN_SLOP + 1 })).toBe('start')
  })
  it('never pans a pointer that drags a card', () => {
    expect(panStep({ slop: CARD_PAN_SLOP, dragging: true, dist: 500 })).toBe('blocked')
  })
  it('the card slop is wider than the board threshold', () => {
    expect(CARD_PAN_SLOP).toBeGreaterThan(PAN_THRESHOLD)
  })
})

describe('touchTracks and touchSlop', () => {
  it('ignores fields and data-no-pan, tracks everything else', () => {
    expect(touchTracks('field')).toBe(false)
    expect(touchTracks('noPan')).toBe(false)
    expect(touchTracks('button')).toBe(true)
    expect(touchTracks('card')).toBe(true)
    expect(touchTracks('board')).toBe(true)
  })
  it('buttons and cards pan past the card slop, the board past the pan threshold', () => {
    expect(touchSlop('button')).toBe(CARD_PAN_SLOP)
    expect(touchSlop('card')).toBe(CARD_PAN_SLOP)
    expect(touchSlop('board')).toBe(PAN_THRESHOLD)
  })
})

describe('isDoubleTap', () => {
  const a = { t: 1000, x: 100, y: 100 }
  it('is false without a previous tap', () => expect(isDoubleTap(null, a)).toBe(false))
  it('is true within 300 ms and 24 px', () => expect(isDoubleTap(a, { t: 1299, x: 120, y: 110 })).toBe(true))
  it('is false after 300 ms', () => expect(isDoubleTap(a, { t: 1301, x: 100, y: 100 })).toBe(false))
  it('is false past 24 px', () => expect(isDoubleTap(a, { t: 1100, x: 125, y: 100 })).toBe(false))
})
