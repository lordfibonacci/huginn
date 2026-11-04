import { describe, it, expect } from 'vitest'
import { foldLine, packsKey, parseCollapsed, serializeCollapsed } from './packs'

describe('collapsed packs storage', () => {
  it('key per project', () => {
    expect(packsKey('p1')).toBe('hg.packs.p1')
  })
  it('round trips and ignores rubbish', () => {
    const ids = new Set(['a', 'b'])
    expect([...parseCollapsed(serializeCollapsed(ids))]).toEqual(['a', 'b'])
    expect(parseCollapsed(null).size).toBe(0)
    expect(parseCollapsed('not json').size).toBe(0)
    expect(parseCollapsed('{"collapsed":"a"}').size).toBe(0)
    expect([...parseCollapsed('{"collapsed":["a",1,null,"b"]}')]).toEqual(['a', 'b'])
  })
})

describe('foldLine', () => {
  it('singular and plural', () => {
    expect(foldLine(1, 1)).toBe('1 módúll · 1 kort · fellt saman')
    expect(foldLine(2, 6)).toBe('2 módúlar · 6 kort · fellt saman')
    expect(foldLine(0, 0)).toBe('0 módúlar · 0 kort · fellt saman')
  })
})
