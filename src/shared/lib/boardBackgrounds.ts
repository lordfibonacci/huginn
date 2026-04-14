export interface BoardBackground {
  id: string
  name: string
  style: string // CSS background value
  textClass?: string // for light backgrounds where text needs to be dark
}

export const BOARD_BACKGROUNDS: BoardBackground[] = [
  {
    id: 'default',
    name: 'Default',
    style: 'linear-gradient(135deg, #1d2125 0%, #252b30 100%)',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    style: 'linear-gradient(135deg, #0c1445 0%, #1a3a5c 50%, #0d2137 100%)',
  },
  {
    id: 'sunset',
    name: 'Sunset',
    style: 'linear-gradient(135deg, #2d1b4e 0%, #4a1942 50%, #1a1a2e 100%)',
  },
  {
    id: 'forest',
    name: 'Forest',
    style: 'linear-gradient(135deg, #0a2e1a 0%, #1a3a2a 50%, #0d1f15 100%)',
  },
  {
    id: 'ember',
    name: 'Ember',
    style: 'linear-gradient(135deg, #2d1a0e 0%, #3d1f1f 50%, #1a1210 100%)',
  },
  {
    id: 'arctic',
    name: 'Arctic',
    style: 'linear-gradient(135deg, #0f1b2d 0%, #162a4a 50%, #0d1520 100%)',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    style: 'linear-gradient(135deg, #0a0a1a 0%, #15152d 50%, #0d0d20 100%)',
  },
  {
    id: 'aurora',
    name: 'Aurora',
    style: 'linear-gradient(135deg, #1a0a2e 0%, #0a2e2e 50%, #1a1a3e 100%)',
  },
  {
    id: 'storm',
    name: 'Storm',
    style: 'linear-gradient(135deg, #1a1a2e 0%, #2a2040 50%, #1a1530 100%)',
  },
]

export function getBackground(id: string): BoardBackground {
  return BOARD_BACKGROUNDS.find(b => b.id === id) ?? BOARD_BACKGROUNDS[0]
}
