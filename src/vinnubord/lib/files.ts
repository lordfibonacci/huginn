// One rule for the Skjöl tab, the file sort and the fresh mark:
// a replaced file is stamped by its last replace, a new one by its upload.
import type { FileRow } from './types'

export type FileStamp = { at: string | null; by: string; updated: boolean }

export function fileStamp(file: Pick<FileRow, 'created_at' | 'uploaded_by' | 'updated_at' | 'updated_by'>): FileStamp {
  if (file.updated_at) return { at: file.updated_at, by: file.updated_by ?? file.uploaded_by, updated: true }
  return { at: file.created_at, by: file.uploaded_by, updated: false }
}

function timeOf(at: string | null): number {
  if (!at) return Number.NEGATIVE_INFINITY
  const t = Date.parse(at)
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t
}

export function sortFiles(files: FileRow[]): FileRow[] {
  return [...files].sort((a, b) => {
    const ta = timeOf(fileStamp(a).at)
    const tb = timeOf(fileStamp(b).at)
    if (ta !== tb) return ta < tb ? -1 : 1
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}
