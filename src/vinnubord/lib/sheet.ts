// The bottom sheet on narrow screens has three stops. A stop is stored as the
// fraction of the sheet's own height it is pushed down: full 0, half
// SHEET_HALF, closed 1 (out of view).

export type SheetStop = 'full' | 'half' | 'closed'

export const SHEET_HALF = 0.45
// Release speed in px per ms past which a release counts as a flick.
export const FLICK_SPEED = 0.5

export function sheetFraction(stop: SheetStop): number {
  return stop === 'full' ? 0 : stop === 'half' ? SHEET_HALF : 1
}

// Where a released sheet settles. offset is how far down it is in px, height
// its full height, velocity the release speed in px/ms (positive is down).
// A flick moves one stop on from where the sheet is, otherwise the nearest stop wins.
export function snapSheet(offset: number, height: number, velocity: number): SheetStop {
  if (height <= 0) return 'full'
  const half = SHEET_HALF * height
  if (velocity > FLICK_SPEED) return offset < half ? 'half' : 'closed'
  if (velocity < -FLICK_SPEED) return offset > half ? 'half' : 'full'
  const stops: SheetStop[] = ['full', 'half', 'closed']
  let best: SheetStop = 'full'
  let bestDist = Number.POSITIVE_INFINITY
  for (const stop of stops) {
    const d = Math.abs(offset - sheetFraction(stop) * height)
    if (d < bestDist) {
      best = stop
      bestDist = d
    }
  }
  return best
}
