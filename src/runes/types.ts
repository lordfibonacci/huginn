import type { ComponentType, ReactNode } from 'react'
import type { Task } from '../shared/lib/types'

export interface RuneSurfaces {
  boardButton?: ComponentType<{ projectId: string }>
  boardSettings?: ComponentType<{ projectId: string }>
  boardView?: ComponentType<{ projectId: string }>
  cardBackSection?: ComponentType<{ task: Task }>
  cardBadges?: ComponentType<{ task: Task }>
  cardDetailBadges?: ComponentType<{ task: Task }>
}

export interface RuneDefinition {
  id: string
  nameKey: string     // i18n key, e.g. 'runes.meta-social.name'
  taglineKey: string  // i18n key
  icon: ReactNode
  surfaces: RuneSurfaces
  onEnable?: (projectId: string) => Promise<void>
  onDisable?: (projectId: string) => Promise<void>
}
