import { describe, expect, it } from 'vitest'
import {
  MODULE_COLORS,
  moduleDeleteBlock,
  participantErrorMessage,
  validateProjectName,
  nextPosition,
  parseCoord,
  participantRemoveBlock,
  projectPatch,
  reorder,
  slugify,
  validateModuleName,
  validateShort,
  validateSlug,
} from './settings'

const row = (id: string, position: number, extra: Record<string, unknown> = {}) => ({ id, position, ...extra })

describe('slugify', () => {
  it('turns Icelandic names into ascii slugs', () => {
    expect(slugify('Gátlistar')).toBe('gatlistar')
    expect(slugify('Þvert á allt')).toBe('thvert-a-allt')
    expect(slugify('Stóreldhúsið 5. og 6. nóv')).toBe('storeldhusid-5-og-6-nov')
    expect(slugify('Æfingar og öryggi')).toBe('aefingar-og-oryggi')
    expect(slugify('Landing metta.is')).toBe('landing-metta-is')
    expect(slugify('Viðhald')).toBe('vidhald')
  })
  it('gives an empty slug for a name without letters or digits', () => {
    expect(slugify('  ...  ')).toBe('')
  })
})

describe('validateSlug', () => {
  const modules = [{ id: 'm1', slug: 'gatlistar' }, { id: 'm2', slug: 'efnaskra' }]
  it('accepts a new lowercase ascii slug', () => {
    expect(validateSlug('kiosk', modules)).toBeNull()
    expect(validateSlug('storeldhusid-5-6-nov', modules)).toBeNull()
  })
  it('rejects empty, wrong characters and stray separators', () => {
    expect(validateSlug('', modules)).toMatch(/vantar/i)
    expect(validateSlug('Gátlistar', modules)).toMatch(/litla/i)
    expect(validateSlug('-kiosk', modules)).toMatch(/litla/i)
    expect(validateSlug('kiosk--x', modules)).toMatch(/litla/i)
  })
  it('rejects a slug another module has, but not the module itself', () => {
    expect(validateSlug('gatlistar', modules)).toMatch(/þegar/i)
    expect(validateSlug('gatlistar', modules, 'm1')).toBeNull()
  })
})

describe('validateModuleName', () => {
  it('needs a name', () => {
    expect(validateModuleName('  ')).toMatch(/nafn/i)
    expect(validateModuleName('Kiosk')).toBeNull()
  })
})

describe('validateShort', () => {
  const participants = [
    { id: 'p1', short: 'H' },
    { id: 'p2', short: 'Á' },
  ]
  it('accepts one to three characters not in use', () => {
    expect(validateShort('C', participants)).toBeNull()
    expect(validateShort('Sig', participants)).toBeNull()
  })
  it('rejects empty and longer than three', () => {
    expect(validateShort(' ', participants)).toMatch(/vantar/i)
    expect(validateShort('Heim', participants)).toMatch(/þrír/i)
  })
  it('rejects a short in use, ignoring case and the participant itself', () => {
    expect(validateShort('h', participants)).toMatch(/þegar/i)
    expect(validateShort('á', participants)).toMatch(/þegar/i)
    expect(validateShort('H', participants, 'p1')).toBeNull()
  })
})

describe('parseCoord', () => {
  it('reads whole numbers, rounding decimals', () => {
    expect(parseCoord('1450')).toBe(1450)
    expect(parseCoord(' -20 ')).toBe(-20)
    expect(parseCoord('12.6')).toBe(13)
  })
  it('gives null for empty or not a number', () => {
    expect(parseCoord('')).toBeNull()
    expect(parseCoord('abc')).toBeNull()
  })
})

describe('nextPosition', () => {
  it('is one past the highest, 0 when empty', () => {
    expect(nextPosition([])).toBe(0)
    expect(nextPosition([row('a', 1), row('b', 6), row('c', 0)])).toBe(7)
  })
})

describe('reorder', () => {
  const rows = [row('a', 1), row('b', 6), row('c', 0)]
  it('moves a row up and renumbers 0..n, returning only the rows that changed', () => {
    // Sorted order is c, a, b. Moving b up gives c, b, a.
    expect(reorder(rows, 'b', -1)).toEqual([
      { id: 'b', position: 1 },
      { id: 'a', position: 2 },
    ])
  })
  it('moves a row down', () => {
    // c, a, b with c down gives a, c, b.
    expect(reorder(rows, 'c', 1)).toEqual([
      { id: 'a', position: 0 },
      { id: 'c', position: 1 },
      { id: 'b', position: 2 },
    ])
  })
  it('does nothing past either end or for an unknown id', () => {
    expect(reorder([row('a', 0), row('b', 1)], 'a', -1)).toEqual([])
    expect(reorder([row('a', 0), row('b', 1)], 'b', 1)).toEqual([])
    expect(reorder([row('a', 0)], 'x', 1)).toEqual([])
  })
  it('still renumbers gaps at the ends when a move is possible', () => {
    expect(reorder([row('a', 0), row('b', 5), row('c', 9)], 'a', 1)).toEqual([
      { id: 'b', position: 0 },
      { id: 'a', position: 1 },
      { id: 'c', position: 2 },
    ])
  })
})

describe('moduleDeleteBlock', () => {
  it('allows deleting a module with no items', () => {
    expect(moduleDeleteBlock(0)).toBeNull()
  })
  it('blocks a module that has items, open or closed', () => {
    expect(moduleDeleteBlock(1)).toMatch(/verk/i)
    expect(moduleDeleteBlock(12)).toMatch(/12/)
  })
})

describe('participantRemoveBlock', () => {
  it('blocks removing yourself', () => {
    expect(participantRemoveBlock({ user_id: 'u1', is_service: false }, 'u1')).toMatch(/sjálf/i)
  })
  it('blocks removing the service user', () => {
    expect(participantRemoveBlock({ user_id: 'c', is_service: true }, 'u1')).toMatch(/þjónustu/i)
  })
  it('allows removing someone else', () => {
    expect(participantRemoveBlock({ user_id: 'u2', is_service: false }, 'u1')).toBeNull()
  })
})

describe('projectPatch', () => {
  const project = { name: 'Metta', repo_path: 'D:\\metta2', context_bundle: 'gamalt' }
  const now = '2026-10-31T12:00:00.000Z'
  it('is empty when nothing changed, ignoring outer whitespace', () => {
    expect(projectPatch(project, { name: ' Metta ', repo_path: 'D:\\metta2', context_bundle: 'gamalt' }, now)).toEqual({})
  })
  it('stamps context_bundle_at only when the bundle changed', () => {
    expect(projectPatch(project, { name: 'Metta', repo_path: 'D:\\metta2', context_bundle: 'nýtt' }, now)).toEqual({
      context_bundle: 'nýtt',
      context_bundle_at: now,
    })
    expect(projectPatch(project, { name: 'Metta 2', repo_path: 'D:\\metta2', context_bundle: 'gamalt' }, now)).toEqual({
      name: 'Metta 2',
    })
  })
  it('stores an emptied repo path or bundle as null', () => {
    expect(projectPatch(project, { name: 'Metta', repo_path: '  ', context_bundle: '' }, now)).toEqual({
      repo_path: null,
      context_bundle: null,
      context_bundle_at: now,
    })
  })
  it('never sends an empty name', () => {
    expect(projectPatch(project, { name: '  ', repo_path: 'D:\\metta2', context_bundle: 'gamalt' }, now)).toEqual({})
  })
})

describe('MODULE_COLORS', () => {
  it('are the five board tones', () => {
    expect(MODULE_COLORS).toEqual(['gold', 'lilac', 'coral', 'teal', 'stone'])
  })
})

describe('moduleDeleteBlock with comments', () => {
  it('blocks a module with comments even when it has no items', () => {
    expect(moduleDeleteBlock(0, 1)).toMatch(/athugasemd/i)
    expect(moduleDeleteBlock(0, 3)).toMatch(/3/)
  })
  it('names items first when it has both', () => {
    expect(moduleDeleteBlock(2, 5)).toMatch(/verk/i)
  })
  it('allows a module with neither', () => {
    expect(moduleDeleteBlock(0, 0)).toBeNull()
  })
})

describe('validateProjectName', () => {
  it('needs a name', () => {
    expect(validateProjectName('   ')).toMatch(/nafn/i)
    expect(validateProjectName('Metta')).toBeNull()
  })
})

describe('participantErrorMessage', () => {
  it('maps a unique violation to the fixed Icelandic message', () => {
    expect(participantErrorMessage('23505', 'duplicate key value violates unique constraint "hg_participants_project_id_user_id_key"')).toBe(
      'Notandinn er þegar þátttakandi í verkefninu.',
    )
  })
  it('passes the function messages through for its other codes', () => {
    expect(participantErrorMessage('P0002', 'Notandi fannst ekki')).toBe('Notandi fannst ekki')
    expect(participantErrorMessage('42501', 'Þú ert ekki þátttakandi í þessu verkefni.')).toBe('Þú ert ekki þátttakandi í þessu verkefni.')
  })
  it('gives null for other errors', () => {
    expect(participantErrorMessage('08006', 'connection failure')).toBeNull()
    expect(participantErrorMessage(undefined, 'x')).toBeNull()
  })
})
