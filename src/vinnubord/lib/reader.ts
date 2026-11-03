import { fileKindLabel } from './upload'

export type ReaderMode = 'read' | 'md'

/** Index of the last heading whose top is at or above the scroll edge (with slack), 0 when none. */
export function activeHeading(tops: number[], scrollTop: number, slack = 8): number {
  let active = 0
  for (let i = 0; i < tops.length; i++) {
    if (tops[i] <= scrollTop + slack) active = i
  }
  return active
}

/** Which files open in the reader: Markdown and plain text only. */
export function readerKind(name: string): 'md' | 'txt' | null {
  const kind = fileKindLabel(name)
  if (kind === 'MD') return 'md'
  if (kind === 'TXT') return 'txt'
  return null
}

export function showToc(headings: { id: string }[]): boolean {
  return headings.length >= 2
}
