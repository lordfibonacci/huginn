import { describe, it, expect } from 'vitest'
import * as web from '../../src/vinnubord/lib/status.ts'
import * as webWindow from '../../src/vinnubord/lib/boardWindow.ts'
import { CLOSED_HISTORY_DAYS, EVENTS_LIMIT } from './client.mjs'
import { STATUS_NAMES, isOnBoard, toneOf } from './status.mjs'

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

  it('isOnBoard agrees for every status', () => {
    for (const status of STATUSES) {
      expect(isOnBoard({ status }), status).toBe(web.isOnBoard({ status }))
    }
  })

  it('toneOf matches itemTone seen by no particular viewer', () => {
    for (const status of STATUSES) {
      for (const waiting_on of WAITING_ON) {
        const item = { id: 'i', status, waiting_on }
        expect(toneOf(item, participants), `${status} ${waiting_on}`).toBe(web.itemTone(item, '', participants))
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
