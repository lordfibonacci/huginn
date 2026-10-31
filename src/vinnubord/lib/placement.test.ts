import { describe, expect, it } from 'vitest'
import { NEW_CARD_GAP, placeNewCard } from './placement'

const size = { w: 250, h: 110 }
const G = NEW_CARD_GAP

describe('placeNewCard', () => {
  it('puts the card left of its module, top aligned, when that spot is free', () => {
    const anchor = { x: 1450, y: 900, w: 300, h: 60 }
    expect(placeNewCard({ anchor, center: { x: 0, y: 0 }, size, obstacles: [] })).toEqual({
      x: 1450 - G - 250,
      y: 900,
    })
  })

  it('tries the right side of the module when the left is taken', () => {
    const anchor = { x: 1450, y: 900, w: 300, h: 60 }
    const left = { x: 1450 - G - 250, y: 900, w: 250, h: 110 }
    expect(placeNewCard({ anchor, center: { x: 0, y: 0 }, size, obstacles: [left] })).toEqual({
      x: 1450 + 300 + G,
      y: 900,
    })
  })

  it('steps down on the left when both sides are taken', () => {
    const anchor = { x: 1450, y: 900, w: 300, h: 60 }
    const left = { x: 1450 - G - 250, y: 900, w: 250, h: 110 }
    const right = { x: 1450 + 300 + G, y: 900, w: 250, h: 110 }
    const pos = placeNewCard({ anchor, center: { x: 0, y: 0 }, size, obstacles: [left, right] })
    expect(pos).toEqual({ x: 1450 - G - 250, y: 900 + 110 + G })
  })

  it('without a module, centres the card on the view centre', () => {
    expect(placeNewCard({ anchor: null, center: { x: 500, y: 300 }, size, obstacles: [] })).toEqual({
      x: 375,
      y: 245,
    })
  })

  it('without a module, moves off a card sitting at the centre', () => {
    const blocker = { x: 375, y: 245, w: 250, h: 110 }
    const pos = placeNewCard({ anchor: null, center: { x: 500, y: 300 }, size, obstacles: [blocker] })
    const overlaps = pos.x < 375 + 250 && pos.x + 250 > 375 && pos.y < 245 + 110 && pos.y + 110 > 245
    expect(overlaps).toBe(false)
  })

  it('returns whole numbers', () => {
    const pos = placeNewCard({ anchor: null, center: { x: 100.4, y: 100.6 }, size, obstacles: [] })
    expect(Number.isInteger(pos.x) && Number.isInteger(pos.y)).toBe(true)
  })

  it('falls back to the first spot when everything near is taken', () => {
    const anchor = { x: 0, y: 0, w: 300, h: 60 }
    const wall = { x: -100000, y: -100000, w: 200000, h: 200000 }
    expect(placeNewCard({ anchor, center: { x: 0, y: 0 }, size, obstacles: [wall] })).toEqual({ x: -G - 250, y: 0 })
  })
})
