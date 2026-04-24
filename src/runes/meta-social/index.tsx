import type { RuneDefinition } from '../types'
import { MetaIcon } from './MetaIcon'
import { MetaBoardSettings } from './MetaBoardSettings'

export const metaSocialRune: RuneDefinition = {
  id: 'meta-social',
  nameKey: 'runes.meta-social.name',
  taglineKey: 'runes.meta-social.tagline',
  icon: <MetaIcon />,
  surfaces: {
    boardSettings: MetaBoardSettings,
  },
}
