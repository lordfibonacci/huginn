import { describe, expect, it } from 'vitest'
import { LAST_PROJECT_KEY, startSlug } from './lastProject'

const projects = [{ slug: 'fastaust' }, { slug: 'metta' }]

describe('startSlug', () => {
  it('opens the project this browser was last in', () => {
    expect(startSlug(projects, 'metta')).toBe('metta')
  })

  it('falls back to the first project with nothing stored', () => {
    expect(startSlug(projects, null)).toBe('fastaust')
    expect(startSlug(projects, '')).toBe('fastaust')
  })

  it('falls back to the first project when the stored one is no longer the viewer\'s', () => {
    expect(startSlug(projects, 'gamalt')).toBe('fastaust')
  })

  it('gives null to a viewer with no project', () => {
    expect(startSlug([], 'metta')).toBeNull()
  })

  it('uses the documented key', () => {
    expect(LAST_PROJECT_KEY).toBe('hg.lastProject')
  })
})
