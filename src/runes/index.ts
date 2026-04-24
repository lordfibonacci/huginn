import type { RuneDefinition } from './types'

export const RUNES: RuneDefinition[] = []

export function getRune(id: string): RuneDefinition | undefined {
  return RUNES.find(r => r.id === id)
}

export type { RuneDefinition, RuneSurfaces } from './types'
