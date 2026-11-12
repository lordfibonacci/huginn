import { describe, expect, it } from 'vitest'
import { HEAL_DELAYS_MS, WAKE_RETRY_MS, WAKE_STALE_MS, channelStep, healDelay, isPostgresReady, wakePlan } from './realtime'

describe('channelStep', () => {
  it('first subscribe goes live without a reload (the first load is already running)', () => {
    expect(channelStep(false, 'SUBSCRIBED')).toEqual({ live: true, lost: false, reload: false })
  })
  it('an error, time out or close drops live and remembers the gap', () => {
    for (const s of ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']) {
      expect(channelStep(false, s)).toEqual({ live: false, lost: true, reload: false })
    }
  })
  it('subscribing again after a gap goes live and reloads to fetch what was missed', () => {
    expect(channelStep(true, 'SUBSCRIBED')).toEqual({ live: true, lost: false, reload: true })
  })
  it('an unknown status changes nothing', () => {
    expect(channelStep(true, 'SOMETHING')).toEqual({ live: null, lost: true, reload: false })
  })
})

describe('healDelay', () => {
  it('waits 4, 10, then 30 seconds', () => {
    expect(HEAL_DELAYS_MS).toEqual([4000, 10000, 30000])
    expect(healDelay(0)).toBe(4000)
    expect(healDelay(1)).toBe(10000)
    expect(healDelay(2)).toBe(30000)
  })
  it('repeats the last wait for every later attempt', () => {
    expect(healDelay(3)).toBe(30000)
    expect(healDelay(50)).toBe(30000)
  })
  it('a negative attempt is the first', () => {
    expect(healDelay(-1)).toBe(4000)
  })
})

describe('wakePlan', () => {
  const long = 10 * 60 * 1000
  it('a live board that just loaded does nothing, shown or pressed', () => {
    expect(wakePlan(true, 1000, long, true)).toEqual({ reconnect: false, reload: false })
    expect(wakePlan(true, 1000, long, false)).toEqual({ reconnect: false, reload: false })
  })
  it('a press on a live board never reloads, however old the load', () => {
    expect(wakePlan(true, long, long, false)).toEqual({ reconnect: false, reload: false })
  })
  it('showing a live board reloads once the load is 30 seconds old', () => {
    expect(wakePlan(true, WAKE_STALE_MS - 1, long, true)).toEqual({ reconnect: false, reload: false })
    expect(wakePlan(true, WAKE_STALE_MS, long, true)).toEqual({ reconnect: false, reload: true })
  })
  it('a board that is not live reconnects and reloads, shown or pressed', () => {
    expect(wakePlan(false, long, long, true)).toEqual({ reconnect: true, reload: true })
    expect(wakePlan(false, long, long, false)).toEqual({ reconnect: true, reload: true })
  })
  it('a connect younger than 3 seconds is left to finish', () => {
    expect(wakePlan(false, long, WAKE_RETRY_MS - 1, false)).toEqual({ reconnect: false, reload: true })
    expect(wakePlan(false, long, WAKE_RETRY_MS, false)).toEqual({ reconnect: true, reload: true })
  })
  it('a board that is not live reloads at most every 3 seconds', () => {
    expect(wakePlan(false, WAKE_RETRY_MS - 1, long, false)).toEqual({ reconnect: true, reload: false })
    expect(wakePlan(false, WAKE_RETRY_MS, long, false)).toEqual({ reconnect: true, reload: true })
  })
})

describe('isPostgresReady', () => {
  it('knows the notice the server sends when postgres changes are streaming', () => {
    expect(
      isPostgresReady({ message: 'Subscribed to PostgreSQL', status: 'ok', extension: 'postgres_changes', channel: 'hg_x' }),
    ).toBe(true)
  })
  it('an error notice or another extension is not it', () => {
    expect(isPostgresReady({ status: 'error', extension: 'postgres_changes' })).toBe(false)
    expect(isPostgresReady({ status: 'ok', extension: 'system' })).toBe(false)
  })
  it('anything that is not an object is not it', () => {
    expect(isPostgresReady(null)).toBe(false)
    expect(isPostgresReady(undefined)).toBe(false)
    expect(isPostgresReady('ok')).toBe(false)
  })
})
