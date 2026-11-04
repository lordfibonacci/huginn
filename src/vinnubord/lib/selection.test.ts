import { describe, expect, it } from 'vitest'
import {
  EMPTY_SELECTION,
  groupMoves,
  intersects,
  isMarqueePress,
  isMember,
  marqueeRect,
  parseSelKey,
  selKey,
  selectInRect,
  selectionSize,
  toggleMember,
} from './selection'

describe('isMarqueePress', () => {
  it('is a primary mouse press with Ctrl or Cmd', () => {
    expect(isMarqueePress({ pointerType: 'mouse', button: 0, ctrlKey: true, metaKey: false })).toBe(true)
    expect(isMarqueePress({ pointerType: 'mouse', button: 0, ctrlKey: false, metaKey: true })).toBe(true)
    expect(isMarqueePress({ pointerType: 'mouse', button: 0, ctrlKey: false, metaKey: false })).toBe(false)
    expect(isMarqueePress({ pointerType: 'mouse', button: 2, ctrlKey: true, metaKey: false })).toBe(false)
    expect(isMarqueePress({ pointerType: 'touch', button: 0, ctrlKey: true, metaKey: false })).toBe(false)
  })
})

describe('marqueeRect and intersects', () => {
  it('normalizes corners in any order', () => {
    expect(marqueeRect({ x: 10, y: 20 }, { x: 4, y: 30 })).toEqual({ x: 4, y: 20, w: 6, h: 10 })
  })
  it('touching edges do not intersect, overlap does', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 }
    expect(intersects(a, { x: 10, y: 0, w: 5, h: 5 })).toBe(false)
    expect(intersects(a, { x: 9, y: 9, w: 5, h: 5 })).toBe(true)
    expect(intersects(a, { x: -5, y: -5, w: 20, h: 20 })).toBe(true)
  })
})

describe('selectInRect', () => {
  const cards = [
    { id: 'a', rect: { x: 0, y: 0, w: 100, h: 50 } },
    { id: 'b', rect: { x: 500, y: 500, w: 100, h: 50 } },
  ]
  const packs = [
    { id: 'p', rect: { x: 200, y: 0, w: 300, h: 44 } },
    { id: 'q', rect: { x: 200, y: 900, w: 300, h: 44 } },
  ]
  it('takes the cards and pack titles the rectangle touches', () => {
    const sel = selectInRect({ x: 50, y: 10, w: 200, h: 20 }, cards, packs)
    expect([...sel.cards]).toEqual(['a'])
    expect([...sel.packs]).toEqual(['p'])
    expect(selectionSize(sel)).toBe(2)
  })
  it('adds to a base selection', () => {
    const base = selectInRect({ x: 50, y: 10, w: 20, h: 20 }, cards, packs)
    const sel = selectInRect({ x: 510, y: 510, w: 5, h: 5 }, cards, packs, base)
    expect([...sel.cards].sort()).toEqual(['a', 'b'])
    expect(sel.packs.size).toBe(0)
  })
  it('an empty rectangle selects nothing', () => {
    expect(selectionSize(selectInRect({ x: 1000, y: 1000, w: 0, h: 0 }, cards, packs))).toBe(0)
  })
})

describe('members', () => {
  it('toggleMember adds and removes without touching the other kind', () => {
    const one = toggleMember(EMPTY_SELECTION, { kind: 'card', id: 'a' })
    expect(isMember(one, { kind: 'card', id: 'a' })).toBe(true)
    const two = toggleMember(one, { kind: 'pack', id: 'p' })
    expect(isMember(two, { kind: 'pack', id: 'p' })).toBe(true)
    const back = toggleMember(two, { kind: 'card', id: 'a' })
    expect(isMember(back, { kind: 'card', id: 'a' })).toBe(false)
    expect(isMember(back, { kind: 'pack', id: 'p' })).toBe(true)
    expect(EMPTY_SELECTION.cards.size).toBe(0)
  })
  it('selKey round trips', () => {
    expect(parseSelKey(selKey({ kind: 'pack', id: 'x:y' }))).toEqual({ kind: 'pack', id: 'x:y' })
  })
})

describe('groupMoves', () => {
  it('moves every member by the grip delta', () => {
    const start = new Map([
      ['card:a', { x: 0, y: 0 }],
      ['card:b', { x: 100, y: 10 }],
      ['pack:p', { x: 1000, y: 60 }],
    ])
    const moves = groupMoves(start, { kind: 'card', id: 'b' }, 130, 50)
    expect(moves.get('card:a')).toEqual({ x: 30, y: 40 })
    expect(moves.get('card:b')).toEqual({ x: 130, y: 50 })
    expect(moves.get('pack:p')).toEqual({ x: 1030, y: 100 })
  })
  it('an unknown grip moves nothing', () => {
    expect(groupMoves(new Map(), { kind: 'card', id: 'z' }, 1, 1).size).toBe(0)
  })
})

describe('zone targets', () => {
  it('a zone is never a member of the selection', () => {
    const sel = { cards: new Set(['a']), packs: new Set(['p']) }
    expect(isMember(sel, { kind: 'zone', id: 'a' })).toBe(false)
  })
  it('groupMoves with a zone grip moves every member by the same delta', () => {
    const start = new Map([
      [selKey({ kind: 'zone', id: 'z' }), { x: 100, y: 100 }],
      [selKey({ kind: 'card', id: 'a' }), { x: 120, y: 130 }],
      [selKey({ kind: 'pack', id: 'p' }), { x: 300, y: 100 }],
    ])
    const out = groupMoves(start, { kind: 'zone', id: 'z' }, 110, 90)
    expect(out.get('zone:z')).toEqual({ x: 110, y: 90 })
    expect(out.get('card:a')).toEqual({ x: 130, y: 120 })
    expect(out.get('pack:p')).toEqual({ x: 310, y: 90 })
    expect(parseSelKey('zone:z')).toEqual({ kind: 'zone', id: 'z' })
  })
})
