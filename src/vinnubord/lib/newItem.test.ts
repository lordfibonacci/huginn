import { describe, expect, it } from 'vitest'
import { fileEntry, formatBytes, uploadSummary } from './newItem'

const MB = 1024 * 1024

describe('fileEntry', () => {
  it('a valid file waits', () => {
    expect(fileEntry('k1', { name: 'skjal.md', size: 1200 })).toEqual({
      id: 'k1', name: 'skjal.md', size: 1200, state: 'waiting', reason: null,
    })
  })
  it('a 60 MB file is an error with the Icelandic reason from validateUpload', () => {
    const e = fileEntry('k2', { name: 'stort.mp4', size: 60 * MB })
    expect(e.state).toBe('error')
    expect(e.reason).toContain('50 MB')
  })
})

describe('uploadSummary', () => {
  it('counts done and failed', () => {
    const entries = [
      { id: 'a', name: 'a', size: 1, state: 'done' as const, reason: null },
      { id: 'b', name: 'b', size: 1, state: 'error' as const, reason: 'x' },
      { id: 'c', name: 'c', size: 1, state: 'done' as const, reason: null },
    ]
    expect(uploadSummary(entries)).toEqual({ done: 2, failed: 1, allOk: false })
  })
  it('no files is all ok', () => {
    expect(uploadSummary([])).toEqual({ done: 0, failed: 0, allOk: true })
  })
})

describe('formatBytes', () => {
  it('formats bytes, kB and MB with the locale decimal sign', () => {
    expect(formatBytes(512, 'is')).toBe('512 B')
    expect(formatBytes(1536, 'is')).toBe('2 kB')
    expect(formatBytes(1.5 * MB, 'is')).toBe('1,5 MB')
    expect(formatBytes(1.5 * MB, 'en')).toBe('1.5 MB')
    expect(formatBytes(60 * MB, 'is')).toBe('60 MB')
  })
})
