import { describe, expect, it } from 'vitest'
import { fileStamp, sortFiles } from './files'
import type { FileRow } from './types'

const row = (p: Partial<FileRow>): FileRow => ({
  id: 'f', created_at: '2026-11-03T06:07:00Z', project_id: 'p', item_id: 'i', name: 'a.md', storage_path: 'p/i/x_a.md',
  size: 1, mime: null, repo_path: null, uploaded_by: 'arni', updated_at: null, updated_by: null, ...p,
})

describe('fileStamp', () => {
  it('a never replaced file is stamped by its upload', () => {
    expect(fileStamp(row({}))).toEqual({ at: '2026-11-03T06:07:00Z', by: 'arni', updated: false })
  })
  it('a replaced file is stamped by its last replace, by the replacer', () => {
    expect(fileStamp(row({ updated_at: '2026-11-03T07:55:00Z', updated_by: 'claude' }))).toEqual({
      at: '2026-11-03T07:55:00Z', by: 'claude', updated: true,
    })
  })
  it('updated_at without updated_by keeps the uploader as author', () => {
    expect(fileStamp(row({ updated_at: '2026-11-03T07:55:00Z' })).by).toBe('arni')
  })
})

describe('sortFiles', () => {
  it('orders by the stamp, so a replaced file moves to where a new one would', () => {
    const a = row({ id: 'a', created_at: '2026-11-01T10:00:00Z', updated_at: '2026-11-03T09:00:00Z', updated_by: 'claude' })
    const b = row({ id: 'b', created_at: '2026-11-02T10:00:00Z' })
    const c = row({ id: 'c', created_at: null })
    expect(sortFiles([a, b, c]).map((f) => f.id)).toEqual(['c', 'b', 'a'])
  })
  it('an unparsable time sorts first like a null time', () => {
    const a = row({ id: 'a', created_at: 'not a date' })
    const b = row({ id: 'b', created_at: '2026-11-02T10:00:00Z' })
    expect(sortFiles([b, a]).map((f) => f.id)).toEqual(['a', 'b'])
  })
  it('the same stamp time sorts by id', () => {
    const b = row({ id: 'b', created_at: '2026-11-02T10:00:00Z' })
    const a = row({ id: 'a', created_at: '2026-11-02T10:00:00Z' })
    expect(sortFiles([b, a]).map((f) => f.id)).toEqual(['a', 'b'])
  })
  it('does not change the input', () => {
    const list = [row({ id: 'b', created_at: '2026-11-02T10:00:00Z' }), row({ id: 'a', created_at: '2026-11-01T10:00:00Z' })]
    sortFiles(list)
    expect(list.map((f) => f.id)).toEqual(['b', 'a'])
  })
})
