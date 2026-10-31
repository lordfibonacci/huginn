// One step of the realtime channel status (ruling R17). lost marks a gap:
// the channel errored, timed out or closed, so changes may have been missed.
// Subscribing again after a gap asks for a reload, so "Lifandi" is truthful.
// live null means the status says nothing about it.
export function channelStep(lost: boolean, status: string): { live: boolean | null; lost: boolean; reload: boolean } {
  if (status === 'SUBSCRIBED') return { live: true, lost: false, reload: lost }
  if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
    return { live: false, lost: true, reload: false }
  }
  return { live: null, lost, reload: false }
}
