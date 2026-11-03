import type { Comment, Participant } from './types'

export type ChatWho = 'me' | 'them' | 'claude'

export type ChatRow =
  | { type: 'day'; key: string; at: string }
  | { type: 'new'; key: 'new' }
  | { type: 'message'; key: string; id: string; who: ChatWho; short: string; name: string; body: string; at: string | null; fresh: boolean }

// Comments on one item in time order, with a day row whenever the local day
// changes and one "new" row before the first fresh message. A comment without
// a stamp sorts first and gets no day row. The day row carries the first
// message's stamp; the component formats it, so this file stays free of i18n.
export function chatRows(
  comments: Comment[],
  participants: Participant[],
  itemId: string,
  viewerId: string,
  fresh: (at: string | null, by: string | null) => boolean,
): ChatRow[] {
  const byUser = new Map(participants.map((p) => [p.user_id, p]))
  const mine = comments
    .filter((c) => c.item_id === itemId)
    .sort((a, b) => {
      if (a.created_at === b.created_at) return 0
      if (a.created_at === null) return -1
      if (b.created_at === null) return 1
      return a.created_at < b.created_at ? -1 : 1
    })

  const rows: ChatRow[] = []
  let lastDay: string | null = null
  let newPlaced = false
  for (const c of mine) {
    if (c.created_at !== null) {
      const day = new Date(c.created_at).toDateString()
      if (day !== lastDay) {
        rows.push({ type: 'day', key: `day:${day}`, at: c.created_at })
        lastDay = day
      }
    }
    const isFresh = fresh(c.created_at, c.user_id)
    if (isFresh && !newPlaced) {
      rows.push({ type: 'new', key: 'new' })
      newPlaced = true
    }
    const p = byUser.get(c.user_id)
    const who: ChatWho = c.user_id === viewerId ? 'me' : p?.is_service ? 'claude' : 'them'
    rows.push({
      type: 'message',
      key: `m:${c.id}`,
      id: c.id,
      who,
      short: p?.short ?? '?',
      name: p?.display_name ?? '?',
      body: c.body,
      at: c.created_at,
      fresh: isFresh,
    })
  }
  return rows
}

// Newest stamp of a comment on the item written by someone other than the viewer.
export function latestForeignCommentAt(comments: Comment[], itemId: string, viewerId: string): string | null {
  let latest: string | null = null
  for (const c of comments) {
    if (c.item_id !== itemId || c.user_id === viewerId || c.created_at === null) continue
    if (latest === null || c.created_at > latest) latest = c.created_at
  }
  return latest
}

export type BodyPart = { text: string; href?: string }

// Punctuation that ends a sentence or closes a bracket after an address is
// text, not part of the link.
const LINK_TAIL = /[.,;:!?)\]]+$/

// A message body split into plain text and http or https links. Nothing else
// is read as markup; the component lets React escape the text.
export function linkParts(body: string): BodyPart[] {
  const parts: BodyPart[] = []
  const push = (text: string, href?: string) => {
    if (!text) return
    const last = parts[parts.length - 1]
    if (!href && last && !last.href) last.text += text
    else parts.push(href ? { text, href } : { text })
  }
  body.split(/(https?:\/\/[^\s<>"']+)/g).forEach((part, i) => {
    if (i % 2 === 0) return push(part)
    const tail = LINK_TAIL.exec(part)?.[0] ?? ''
    const link = part.slice(0, part.length - tail.length)
    if (/^https?:\/\/./.test(link)) push(link, link)
    else push(link)
    push(tail)
  })
  return parts
}
