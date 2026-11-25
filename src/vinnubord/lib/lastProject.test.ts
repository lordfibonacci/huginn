import { afterEach, describe, expect, it, vi } from 'vitest'
import { LAST_PROJECT_KEY, readLastProject, startSlug, writeLastProject } from './lastProject'

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

describe('with storage off', () => {
  const off = () => {
    throw new Error('storage is off')
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reads null when getItem throws', () => {
    vi.stubGlobal('localStorage', { getItem: off })
    expect(readLastProject()).toBeNull()
  })

  it('does not throw when setItem throws', () => {
    const setItem = vi.fn(off)
    vi.stubGlobal('localStorage', { setItem })
    expect(() => writeLastProject('metta')).not.toThrow()
    expect(setItem).toHaveBeenCalledWith(LAST_PROJECT_KEY, 'metta')
  })

  it('still opens the first project when getItem throws', () => {
    vi.stubGlobal('localStorage', { getItem: off })
    expect(startSlug(projects, readLastProject())).toBe('fastaust')
  })
})
