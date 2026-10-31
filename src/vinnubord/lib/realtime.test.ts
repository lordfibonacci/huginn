import { describe, expect, it } from 'vitest'
import { channelStep } from './realtime'

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
