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

// The wait before a channel that is not live is rebuilt, by attempt. The first
// leaves room for the client's own rejoin after a dropped socket (measured
// 1.4 s); the last repeats. A channel the server closed never rejoins on its own.
export const HEAL_DELAYS_MS: readonly number[] = [4000, 10000, 30000]

export function healDelay(attempt: number): number {
  return HEAL_DELAYS_MS[Math.min(Math.max(attempt, 0), HEAL_DELAYS_MS.length - 1)]
}

// A wake on a board that is not live acts at most this often.
export const WAKE_RETRY_MS = 3000
// A live board that is shown again reloads when its last load is this old.
export const WAKE_STALE_MS = 30000

// What a wake does. show: the tab became visible, the window got focus or the
// network came back. A press (show false) only acts on a board that is not
// live. The times are since the last load began (a failed load counts as
// none) and since the last connect began.
export function wakePlan(
  live: boolean,
  sinceLoadMs: number,
  sinceConnectMs: number,
  show: boolean,
): { reconnect: boolean; reload: boolean } {
  return {
    reconnect: !live && sinceConnectMs >= WAKE_RETRY_MS,
    reload: (!live && sinceLoadMs >= WAKE_RETRY_MS) || (show && sinceLoadMs >= WAKE_STALE_MS),
  }
}

// The server's notice on the system event that postgres changes are streaming.
// It comes a moment after SUBSCRIBED (measured 0.3 s) and a change in between is not sent.
export function isPostgresReady(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false
  const p = payload as { status?: unknown; extension?: unknown }
  return p.status === 'ok' && p.extension === 'postgres_changes'
}
