import { describe, expect, it } from 'vitest'
import { TAG_MAX, normalizeTag, tagNameTaken, tagRows } from './tags'

const tag = (id: string, name: string) => ({ id, created_at: null, project_id: 'pr', name, created_by: null })

describe('normalizeTag', () => {
  it('lowercases with Icelandic letters, collapses whitespace and trims', () => {
    expect(normalizeTag('  Fyrir   SÝNINGU ')).toEqual({ ok: true, name: 'fyrir sýningu' })
    expect(normalizeTag('Árni	leiðarvísir')).toEqual({ ok: true, name: 'árni leiðarvísir' })
  })
  it('refuses empty, over 40 characters and a comma', () => {
    expect(normalizeTag('')).toEqual({ ok: false, reason: 'Taggið þarf nafn.' })
    expect(normalizeTag('   ')).toEqual({ ok: false, reason: 'Taggið þarf nafn.' })
    expect(normalizeTag('x'.repeat(TAG_MAX + 1))).toEqual({ ok: false, reason: 'Tagg má mest vera 40 stafir.' })
    expect(normalizeTag('x'.repeat(TAG_MAX)).ok).toBe(true)
    expect(normalizeTag('a, b')).toEqual({ ok: false, reason: 'Tagg má ekki hafa kommu.' })
    expect(normalizeTag(null).ok).toBe(false)
  })
})

describe('tagRows', () => {
  it('counts items by exact name and sorts by count, then name in Icelandic order', () => {
    const tags = [tag('t1', 'öryggi'), tag('t2', 'efni'), tag('t3', 'askur')]
    const items = [{ tags: ['efni', 'askur'] }, { tags: ['efni'] }, { tags: [] }]
    expect(tagRows(tags, items)).toEqual([
      { id: 't2', name: 'efni', count: 2 },
      { id: 't3', name: 'askur', count: 1 },
      { id: 't1', name: 'öryggi', count: 0 },
    ])
  })
})

describe('tagNameTaken', () => {
  const tags = [tag('t1', 'efni'), tag('t2', 'askur')]
  it('is taken ignoring case, except by itself', () => {
    expect(tagNameTaken('Efni', tags)).toBe('Taggið er þegar á listanum.')
    expect(tagNameTaken('efni', tags, 't1')).toBeNull()
    expect(tagNameTaken('nýtt', tags)).toBeNull()
  })
})
