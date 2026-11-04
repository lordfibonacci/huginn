import { validateUpload } from './upload'

// Pure parts of the new item sheet: the per file upload
// state (ruling R18: a state per file, no percentage).

export type UploadState = 'waiting' | 'uploading' | 'done' | 'error'
export type FileEntry = { id: string; name: string; size: number; state: UploadState; reason: string | null }

// A picked file: waiting, or an error with the Icelandic reason when
// validateUpload rejects it. Rejected files are never uploaded.
export function fileEntry(id: string, file: { name: string; size: number }): FileEntry {
  const check = validateUpload(file)
  return {
    id,
    name: file.name,
    size: file.size,
    state: check.ok ? 'waiting' : 'error',
    reason: check.ok ? null : check.reason,
  }
}

export function uploadSummary(entries: FileEntry[]): { done: number; failed: number; allOk: boolean } {
  const done = entries.filter((e) => e.state === 'done').length
  const failed = entries.filter((e) => e.state === 'error').length
  return { done, failed, allOk: failed === 0 }
}

export function formatBytes(bytes: number, locale: string): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`
  const mb = bytes / (1024 * 1024)
  const fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: mb < 10 ? 1 : 0 })
  return `${fmt.format(mb)} MB`
}
