import { describe, expect, it } from 'vitest'
import { OPEN_STOP, SHEET_HALF, sheetFraction, snapSheet } from './sheet'

describe('sheetFraction', () => {
  it('maps each stop to how far down the sheet sits', () => {
    expect(sheetFraction('full')).toBe(0)
    expect(sheetFraction('half')).toBe(SHEET_HALF)
    expect(sheetFraction('closed')).toBe(1)
  })
})

describe('snapSheet', () => {
  const h = 800
  const half = SHEET_HALF * h

  it('snaps to the nearest stop on a slow release', () => {
    expect(snapSheet(30, h, 0)).toBe('full')
    expect(snapSheet(half + 40, h, 0)).toBe('half')
    expect(snapSheet(h - 50, h, 0)).toBe('closed')
  })

  it('a flick down goes one stop down from where the sheet is', () => {
    expect(snapSheet(40, h, 1)).toBe('half')
    expect(snapSheet(half + 10, h, 1)).toBe('closed')
  })

  it('a flick up goes one stop up from where the sheet is', () => {
    expect(snapSheet(h - 40, h, -1)).toBe('half')
    expect(snapSheet(half - 10, h, -1)).toBe('full')
  })

  it('a slow drift does not count as a flick', () => {
    expect(snapSheet(half + 30, h, 0.2)).toBe('half')
  })

  it('handles a zero height sheet', () => {
    expect(snapSheet(0, 0, 0)).toBe('full')
  })
})

it('opens full', () => expect(OPEN_STOP).toBe('full'))
