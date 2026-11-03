import { describe, expect, it } from 'vitest'
import { NOTE_MAX, fileKindLabel, isTextLike, normalizeNote, validateUpload } from './upload'

const MB = 1024 * 1024

describe('validateUpload', () => {
  it('accepts a normal file', () => {
    expect(validateUpload({ name: 'skjal.md', size: 1200 })).toEqual({ ok: true })
  })

  it('accepts exactly 50 MB', () => {
    expect(validateUpload({ name: 'a.zip', size: 52428800 })).toEqual({ ok: true })
  })

  it('rejects 60 MB with a reason mentioning 50 MB', () => {
    const r = validateUpload({ name: 'stort.mp4', size: 60 * MB })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('50 MB')
  })

  it('rejects an empty file', () => {
    const r = validateUpload({ name: 'tom.txt', size: 0 })
    expect(r.ok).toBe(false)
  })

  it('rejects a name longer than 180 characters', () => {
    const r = validateUpload({ name: 'a'.repeat(181) + '.md', size: 10 })
    expect(r.ok).toBe(false)
  })

  it('accepts a name of exactly 180 characters', () => {
    expect(validateUpload({ name: 'a'.repeat(180), size: 10 })).toEqual({ ok: true })
  })
})

describe('isTextLike', () => {
  it('recognises text extensions case insensitively', () => {
    for (const n of ['a.md', 'a.TXT', 'a.html', 'a.json', 'a.sql', 'a.csv', 'a.yaml', 'a.ts', 'a.tsx', 'a.js', 'a.css']) {
      expect(isTextLike(n)).toBe(true)
    }
  })

  it('rejects binary files and names without extension', () => {
    expect(isTextLike('a.zip')).toBe(false)
    expect(isTextLike('a.png')).toBe(false)
    expect(isTextLike('README')).toBe(false)
  })
})

describe('fileKindLabel', () => {
  it('maps all video extensions to MP4', () => {
    for (const e of ['mp4', 'mov', 'webm', 'm4v', 'avi', 'mkv']) {
      expect(fileKindLabel(`x.${e}`)).toBe('MP4')
    }
    expect(fileKindLabel('x.MOV')).toBe('MP4')
  })

  it('maps images to MYND', () => {
    for (const e of ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic']) {
      expect(fileKindLabel(`x.${e}`)).toBe('MYND')
    }
  })

  it('maps documents', () => {
    expect(fileKindLabel('skjal.md')).toBe('MD')
    expect(fileKindLabel('a.zip')).toBe('ZIP')
    expect(fileKindLabel('a.PDF')).toBe('PDF')
    expect(fileKindLabel('a.html')).toBe('HTML')
    expect(fileKindLabel('a.htm')).toBe('HTML')
    expect(fileKindLabel('a.txt')).toBe('TXT')
  })

  it('falls back to SKRÁ', () => {
    expect(fileKindLabel('a.xyz')).toBe('SKRÁ')
    expect(fileKindLabel('README')).toBe('SKRÁ')
  })
})

describe('normalizeNote', () => {
  it('trims and collapses whitespace, line endings included', () => {
    expect(normalizeNote('  Hönnunarskjal\r\n  fyrir Heimi\t ')).toEqual({ ok: true, note: 'Hönnunarskjal fyrir Heimi' })
  })
  it('gives null for empty, whitespace, null and undefined', () => {
    for (const v of ['', '   ', '\n\n', null, undefined]) expect(normalizeNote(v)).toEqual({ ok: true, note: null })
  })
  it('accepts exactly NOTE_MAX characters and refuses one more, in Icelandic', () => {
    expect(normalizeNote('a'.repeat(NOTE_MAX))).toEqual({ ok: true, note: 'a'.repeat(NOTE_MAX) })
    expect(normalizeNote('a'.repeat(NOTE_MAX + 1))).toEqual({ ok: false, reason: 'Lýsing má mest vera 200 stafir.' })
  })
  it('measures after collapsing, so padding never counts', () => {
    expect(normalizeNote(' '.repeat(50) + 'a'.repeat(NOTE_MAX))).toEqual({ ok: true, note: 'a'.repeat(NOTE_MAX) })
  })
})
