// Copies of helpers from src/vinnubord/lib/status.ts (ruling R3). Plain node
// cannot import the TypeScript source, so parity.test.mjs asserts these agree.

export const STATUS_NAMES = {
  new: 'Nýtt',
  waiting: 'Bíður',
  ready: 'Tilbúið til byggingar',
  building: 'Í byggingu',
  parked: 'Í bið',
  done: 'Lokið',
  dropped: 'Hætt við',
}

// Plan status names, shared by the write commands and the mirror.
export const PLAN_NAMES = { todo: 'Á eftir', building: 'Í byggingu', done: 'Lokið' }

// A closed item stays on the board CLOSED_LINGER_DAYS days after closed_at.
// Copies of the web rule, parity pinned.
export const CLOSED_LINGER_DAYS = 3

export function isOpen(item) {
  return item.status !== 'done' && item.status !== 'dropped'
}

// A closed item without closed_at, or with one that does not parse, is off.
export function isOnBoard(item, now = Date.now()) {
  if (isOpen(item)) return true
  if (!item.closed_at) return false
  const closed = Date.parse(item.closed_at)
  if (Number.isNaN(closed)) return false
  return now - closed <= CLOSED_LINGER_DAYS * 86_400_000
}

// Whether an item waits for a user: waiting_on is that user, or the user owns
// an open action on it. Callers filter to items on the board.
export function waitsFor(item, actions, userId) {
  if (item.waiting_on === userId) return true
  return actions.some((a) => a.item_id === item.id && a.owner === userId && a.done_at === null)
}

function isServiceUser(userId, participants) {
  if (!userId) return false
  return participants.some((p) => p.user_id === userId && p.is_service)
}

// itemTone from the web with no viewer: the CLI output and STATUS.md are
// shared, so nothing is coral ("waits for you").
export function toneOf(item, participants) {
  switch (item.status) {
    case 'new':
      return 'gold'
    case 'waiting':
      return isServiceUser(item.waiting_on, participants) ? 'gold' : 'lilac'
    case 'ready':
    case 'building':
      return 'teal'
    default:
      return 'stone'
  }
}
