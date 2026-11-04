import { describe, it, expect } from 'vitest'
import {
  DEFAULT_ZONE_COLOR,
  DEFAULT_ZONE_TITLE,
  ZONE_MIN,
  ZONE_TITLE_EMPTY,
  ZONE_TITLE_TOO_LONG,
  clampZoneSize,
  draftBigEnough,
  normalizeZoneTitle,
  zoneMembers,
  zonePositionsOf,
  zoneRect,
} from './zones'
import type { ViewZonePosition, Zone } from './types'

function zone(over: Partial<Zone> = {}): Zone {
  return {
    id: 'z1', created_at: null, project_id: 'pr', title: 'Fyrir sýningu', color: 'coral', note: null,
    pos_x: 100, pos_y: 200, w: 400, h: 300, created_by: null, ...over,
  }
}
const row = (view_id: string, zone_id: string, pos_x: number, pos_y: number): ViewZonePosition => ({ project_id: 'pr', view_id, zone_id, pos_x, pos_y })

describe('zonePositionsOf and zoneRect', () => {
  it('is empty for the main board and keyed by zone in a view', () => {
    const rows = [row('v1', 'z1', 5, 6), row('v2', 'z1', 7, 8)]
    expect(zonePositionsOf(rows, null).size).toBe(0)
    expect(zonePositionsOf(rows, 'v1').get('z1')).toEqual({ x: 5, y: 6 })
  })
  it('takes the view position and always the own size', () => {
    expect(zoneRect(zone(), new Map())).toEqual({ x: 100, y: 200, w: 400, h: 300 })
    expect(zoneRect(zone(), new Map([['z1', { x: 5, y: 6 }]]))).toEqual({ x: 5, y: 6, w: 400, h: 300 })
  })
})

describe('clampZoneSize and draftBigEnough', () => {
  it('never goes under the minimum and rounds', () => {
    expect(ZONE_MIN).toEqual({ w: 160, h: 120 })
    expect(clampZoneSize({ w: 10, h: 500.4 })).toEqual({ w: 160, h: 500 })
    expect(clampZoneSize({ w: 160, h: 120 })).toEqual({ w: 160, h: 120 })
  })
  it('a draft needs both sides at the minimum', () => {
    expect(draftBigEnough({ x: 0, y: 0, w: 160, h: 120 })).toBe(true)
    expect(draftBigEnough({ x: 0, y: 0, w: 159, h: 500 })).toBe(false)
    expect(draftBigEnough({ x: 0, y: 0, w: 500, h: 119 })).toBe(false)
  })
})

describe('zoneMembers', () => {
  const rect = { x: 0, y: 0, w: 400, h: 300 }
  it('takes cards and pack titles whose centre lies inside, the border included', () => {
    const cards = [
      { id: 'in', rect: { x: 10, y: 10, w: 100, h: 50 } },
      { id: 'edge', rect: { x: 350, y: 0, w: 100, h: 50 } },
      { id: 'out', rect: { x: 351, y: 0, w: 100, h: 50 } },
      { id: 'far', rect: { x: 1000, y: 1000, w: 100, h: 50 } },
    ]
    const packs = [{ id: 'p-in', rect: { x: 0, y: 200, w: 200, h: 40 } }, { id: 'p-out', rect: { x: 0, y: 290, w: 200, h: 40 } }]
    expect(zoneMembers(rect, cards, packs)).toEqual({ cards: ['in', 'edge'], packs: ['p-in'] })
  })
  it('is empty when nothing is inside', () => {
    expect(zoneMembers(rect, [], [])).toEqual({ cards: [], packs: [] })
  })
})

describe('normalizeZoneTitle', () => {
  it('trims and folds whitespace', () => {
    expect(normalizeZoneTitle('  Fyrir   sýningu ')).toEqual({ ok: true, title: 'Fyrir sýningu' })
  })
  it('refuses empty and too long', () => {
    expect(normalizeZoneTitle('   ')).toEqual({ ok: false, reason: ZONE_TITLE_EMPTY })
    expect(normalizeZoneTitle('a'.repeat(61))).toEqual({ ok: false, reason: ZONE_TITLE_TOO_LONG })
    expect(normalizeZoneTitle('a'.repeat(60)).ok).toBe(true)
  })
  it('defaults', () => {
    expect(DEFAULT_ZONE_TITLE).toBe('Kassi')
    expect(DEFAULT_ZONE_COLOR).toBe('lilac')
  })
})
