import type { RuneDefinition } from './types'
import { metaSocialRune } from './meta-social'

export const RUNES: RuneDefinition[] = [metaSocialRune]

export function getRune(id: string): RuneDefinition | undefined {
  return RUNES.find(r => r.id === id)
}

export type { RuneDefinition, RuneSurfaces } from './types'
