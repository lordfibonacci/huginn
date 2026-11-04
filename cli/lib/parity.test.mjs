import { describe, it, expect } from 'vitest'
import * as web from '../../src/vinnubord/lib/status.ts'
import * as webWindow from '../../src/vinnubord/lib/boardWindow.ts'
import { CLOSED_HISTORY_DAYS, EVENTS_LIMIT } from './client.mjs'
import { CLOSED_LINGER_DAYS, STATUS_NAMES, isOnBoard, isOpen, toneOf, waitsFor } from './status.mjs'
import { readFileSync } from 'node:fs'
import * as webUpload from '../../src/vinnubord/lib/upload.ts'
import * as webTags from '../../src/vinnubord/lib/tags.ts'
import * as webCards from '../../src/vinnubord/lib/cards.ts'
import * as webPlacement from '../../src/vinnubord/lib/placement.ts'
import {
  BOARD_SIZES,
  CARD_STAMP_DAYS,
  CSS_TOKENS,
  MAX_NAME_LENGTH,
  MAX_UPLOAD_BYTES,
  NEW_CARD_GAP,
  NOTE_MAX,
  TAG_MAX,
  normalizeNote,
  normalizeTag,
  placeNewCard,
  storageSafeName,
  validateUpload,
} from './write.mjs'

// The CLI copies a few helpers from src/vinnubord/lib/status.ts and the board
// window constants from boardWindow.ts, because plain node cannot import the
// TypeScript source (ruling R3). These tests keep the copies in step with the web.

const STATUSES = ['new', 'waiting', 'ready', 'building', 'parked', 'done', 'dropped']
const participants = [
  { id: 'p-c', user_id: 'u-c', short: 'C', display_name: 'Claude', is_service: true },
  { id: 'p-h', user_id: 'u-h', short: 'H', display_name: 'Heimir', is_service: false },
]
const WAITING_ON = [null, 'u-c', 'u-h', 'u-unknown']

describe('status parity with the web', () => {
  it('STATUS_NAMES agree', () => {
    expect(STATUS_NAMES).toEqual(web.STATUS_NAMES)
  })

  it('isOpen and isOnBoard agree for every status and closed_at', () => {
    const now = Date.parse('2026-11-04T12:00:00Z')
    const closedAts = [null, new Date(now - 2 * 86_400_000).toISOString(), new Date(now - 4 * 86_400_000).toISOString()]
    for (const status of STATUSES) {
      expect(isOpen({ status }), status).toBe(web.isOpen({ status }))
      for (const closed_at of closedAts) {
        expect(isOnBoard({ status, closed_at }, now), `${status} ${closed_at}`).toBe(web.isOnBoard({ status, closed_at }, now))
      }
    }
    expect(CLOSED_LINGER_DAYS).toBe(web.CLOSED_LINGER_DAYS)
  })

  it('toneOf matches itemTone seen by no particular viewer', () => {
    for (const status of STATUSES) {
      for (const waiting_on of WAITING_ON) {
        const item = { id: 'i', status, waiting_on }
        expect(toneOf(item, participants), `${status} ${waiting_on}`).toBe(web.itemTone(item, '', participants))
      }
    }
  })

  it('waitsFor agrees for every waiting_on, viewer and action state', () => {
    const ACTIONS = [
      [],
      [{ id: 'a', item_id: 'i', owner: 'u-h', done_at: null }],
      [{ id: 'a', item_id: 'i', owner: 'u-h', done_at: '2026-10-31T00:00:00Z' }],
      [{ id: 'a', item_id: 'other', owner: 'u-h', done_at: null }],
      [{ id: 'a', item_id: 'i', owner: 'u-c', done_at: null }],
    ]
    for (const status of STATUSES) {
      for (const waiting_on of WAITING_ON) {
        for (const actions of ACTIONS) {
          for (const viewer of ['u-c', 'u-h', 'u-unknown']) {
            const item = { id: 'i', status, waiting_on }
            const label = `${status} ${waiting_on} ${viewer} ${JSON.stringify(actions)}`
            expect(waitsFor(item, actions, viewer), label).toBe(web.waitsFor(item, actions, viewer))
          }
        }
      }
    }
  })
})

describe('board window parity with the web', () => {
  it('CLOSED_HISTORY_DAYS and EVENTS_LIMIT agree with loadBoard', () => {
    expect(CLOSED_HISTORY_DAYS).toBe(webWindow.CLOSED_HISTORY_DAYS)
    expect(EVENTS_LIMIT).toBe(webWindow.EVENTS_LIMIT)
  })
})

describe('write helpers parity with the web', () => {
  const NAMES = ['a.md', 'Skýrsla á íslensku.md', 'ÞÆÖ ðé.pdf', '???', '', 'x'.repeat(181), 'mynd (1).PNG', 'a/b\c.txt']

  it('TAG_MAX and normalizeTag agree with tags.ts', () => {
    expect(TAG_MAX).toBe(webTags.TAG_MAX)
    for (const v of ['  Fyrir   SÝNINGU ', '', '   ', 'x'.repeat(40), 'x'.repeat(41), 'a, b', 'Árni	leiðarvísir', null])
      expect(normalizeTag(v)).toEqual(webTags.normalizeTag(v))
  })

  it('the card stamp rule matches the web', () => {
    expect(CARD_STAMP_DAYS).toBe(webCards.CARD_STAMP_DAYS)
  })

  it('upload limits and validateUpload agree with upload.ts', () => {
    expect(MAX_UPLOAD_BYTES).toBe(webUpload.MAX_UPLOAD_BYTES)
    expect(MAX_NAME_LENGTH).toBe(webUpload.MAX_NAME_LENGTH)
    for (const name of NAMES) {
      for (const size of [-1, 0, 1, webUpload.MAX_UPLOAD_BYTES, webUpload.MAX_UPLOAD_BYTES + 1]) {
        expect(validateUpload({ name, size }), `${name} ${size}`).toEqual(webUpload.validateUpload({ name, size }))
      }
    }
  })

  it('NOTE_MAX and normalizeNote agree with upload.ts', () => {
    expect(NOTE_MAX).toBe(webUpload.NOTE_MAX)
    for (const v of ['  a \r\n b ', '', 'x'.repeat(201), 'x'.repeat(200)]) expect(normalizeNote(v)).toEqual(webUpload.normalizeNote(v))
  })

  it('storageSafeName agrees with upload.ts', () => {
    for (const name of NAMES) expect(storageSafeName(name), name).toBe(webUpload.storageSafeName(name))
  })

  it('placeNewCard agrees with placement.ts', () => {
    expect(NEW_CARD_GAP).toBe(webPlacement.NEW_CARD_GAP)
    const size = { w: 250, h: 110 }
    const anchor = { x: 1450, y: 900, w: 300, h: 60 }
    const G = webPlacement.NEW_CARD_GAP
    const cases = [
      { anchor, center: { x: 0, y: 0 }, size, obstacles: [] },
      { anchor, center: { x: 0, y: 0 }, size, obstacles: [{ x: 1450 - G - 250, y: 900, w: 250, h: 110 }] },
      { anchor: null, center: { x: 500, y: 300 }, size, obstacles: [] },
      { anchor: null, center: { x: 500, y: 300 }, size, obstacles: [{ x: 375, y: 245, w: 250, h: 110 }] },
      { anchor: null, center: { x: 100.4, y: 100.6 }, size, obstacles: [] },
      { anchor, center: { x: 0, y: 0 }, size, obstacles: [{ x: -1e5, y: -1e5, w: 2e5, h: 2e5 }] },
    ]
    // Plus seeded random boards.
    let seed = 7
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let n = 0; n < 200; n++) {
      const obstacles = Array.from({ length: Math.floor(rand() * 12) }, () => ({
        x: Math.round(rand() * 1600),
        y: Math.round(rand() * 1600),
        w: 250,
        h: 120,
      }))
      const a = rand() < 0.5 ? null : { x: Math.round(rand() * 1200), y: Math.round(rand() * 1200), w: 292, h: 49 }
      cases.push({ anchor: a, center: { x: rand() * 1600, y: rand() * 1600 }, size: { w: 250, h: 120 }, obstacles })
    }
    for (const c of cases) expect(placeNewCard(c)).toEqual(webPlacement.placeNewCard(c))
  })

  it('board sizes agree with the --hg-* tokens in vinnubord.css and NEW_CARD_SIZE in Board.tsx', () => {
    const css = readFileSync(new URL('../../src/vinnubord/vinnubord.css', import.meta.url), 'utf8')
    const token = (name) => {
      const m = css.match(new RegExp(`--hg-${name}:\s*([^;]+);`))
      if (!m) throw new Error(`token --hg-${name} missing`)
      return m[1].trim()
    }
    const px = (name) => Number(token(name).replace(/px$/, ''))
    const pads = (name) => token(name).split(/\s+/).map((v) => Number(v.replace(/px$/, '')))

    for (const [key, name] of Object.entries(CSS_TOKENS)) {
      expect(BOARD_SIZES[key], `${key} = --hg-${name}`).toBe(px(name))
    }
    // Shorthand paddings: top right bottom left, a missing left repeats right.
    const box = (name) => {
      const [t, r, b = t, l = r] = pads(name)
      return { y: t + b, x: r + l }
    }
    expect([BOARD_SIZES.modulePadY, BOARD_SIZES.modulePadX]).toEqual([box('module-pad').y, box('module-pad').x])
    expect([BOARD_SIZES.cardPadY, BOARD_SIZES.cardPadX]).toEqual([box('card-pad').y, box('card-pad').x])
    expect([BOARD_SIZES.chipPadY, BOARD_SIZES.chipPadX]).toEqual([box('card-chip-pad').y, box('card-chip-pad').x])
    expect(BOARD_SIZES.gap).toBe(webPlacement.NEW_CARD_GAP)
    // The pack head is padding, the title button (at least --hg-touch tall,
    // the same token the CLI reads as touch) and the title gap.
    expect(BOARD_SIZES.touch, 'touch = --hg-touch').toBe(px('touch'))
    expect(BOARD_SIZES.packHead).toBe(
      Math.round(px('pack-pad-top') + Math.max(px('touch'), px('pack-title-size') * 1.37) + px('pack-title-gap')),
    )
    // The rail starts at or above the first module.
    expect(px('pack-rail-top')).toBeLessThanOrEqual(BOARD_SIZES.packHead)

    const board = readFileSync(new URL('../../src/vinnubord/components/Board.tsx', import.meta.url), 'utf8')
    const m = board.match(/const NEW_CARD_SIZE = \{ w: (\d+), h: (\d+) \}/)
    expect(m).not.toBeNull()
    expect(BOARD_SIZES.cardW).toBe(Number(m[1]))
    expect(BOARD_SIZES.newCardH).toBe(Number(m[2]))
  })
})
