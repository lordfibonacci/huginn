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

export function isOnBoard(item) {
  return item.status !== 'done' && item.status !== 'dropped'
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
