import { validateUpload } from './upload'

// Pure parts of the new item sheet: the tag field and the per file upload
// state (ruling R18: a state per file, no percentage).

export type UploadState = 'waiting' | 'uploading' | 'done' | 'error'
export type FileEntry = { id: string; name: string; size: number; state: UploadState; reason: string | null }

// Comma separated tags, trimmed, without empties or repeats, in typed order.
export function parseTags(text: string): string[] {
  const out: string[] = []
  for (const part of text.split(',')) {
    const tag = part.trim()
    if (tag !== '' && !out.includes(tag)) out.push(tag)
  }
  return out
}

// The tag field with one tag added or, when it is there, removed.
export function toggleTagText(text: string, tag: string): string {
  const tags = parseTags(text)
  const next = tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]
  return next.join(', ')
}

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
