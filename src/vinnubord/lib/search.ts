import type { BoardData } from './types'

// The board search (spec 4.2): one folded text per item, built once from the
// board data, and the fold both sides use. Accents go, ð þ æ stay.

export function foldSearch(s: string): string {
  return s
    .toLocaleLowerCase('is')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

type Lines = Map<string, (string | null)[]>

function push(lines: Lines, itemId: string | null, ...parts: (string | null)[]): void {
  if (itemId === null) return
  const list = lines.get(itemId)
  if (list) list.push(...parts)
  else lines.set(itemId, parts)
}

// Folded text per item id: title, summary, body, tags and keywords, then the
// item's file names and notes, questions and answers, actions and chat.
export function searchIndex(
  data: Pick<BoardData, 'items' | 'files' | 'questions' | 'actions' | 'comments'>,
): Map<string, string> {
  const attached: Lines = new Map()
  for (const f of data.files) push(attached, f.item_id, f.name, f.note)
  for (const q of data.questions) push(attached, q.item_id, q.body, q.answer)
  for (const a of data.actions) push(attached, a.item_id, a.body)
  for (const c of data.comments) push(attached, c.item_id, c.body)
  const index = new Map<string, string>()
  for (const item of data.items) {
    const parts = [item.title, item.summary, item.body, ...item.tags, ...item.keywords, ...(attached.get(item.id) ?? [])]
    const text = parts.filter((p): p is string => typeof p === 'string' && p !== '').join('\n')
    index.set(item.id, foldSearch(text))
  }
  return index
}
