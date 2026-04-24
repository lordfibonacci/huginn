import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Comment, Activity, Profile } from '../../../shared/lib/types'
import { timeAgo } from '../../../shared/lib/dateUtils'
import { Avatar } from '../../../shared/components/Avatar'
import { MentionSuggestionList, type MentionItem, type MentionSuggestionListHandle } from './MentionSuggestionList'
import { insertCommentMentions } from '../lib/mentions'

interface CommentSectionProps {
  taskId: string
  comments: Comment[]
  activities: Activity[]
  currentUserId: string
  /** Map of user_id -> profile. Built by the caller from board members + self. */
  profileById?: Record<string, Profile>
  /** Active board members (excluding self) for the @-mention picker. */
  mentionMembers?: MentionItem[]
  /** Open an image in the parent's lightbox (single lightbox per card). */
  onOpenImage?: (url: string, name: string) => void
  onAddComment: (body: string) => Promise<{ id: string } | null | unknown>
  onDeleteComment: (commentId: string) => void
}

type FeedItem =
  | { type: 'comment'; data: Comment }
  | { type: 'activity'; data: Activity }

const AVATAR_SIZE = 32
const AVATAR_COLUMN = 'w-10 shrink-0' // 40px column for the avatar (avatar + breathing room)

export function CommentSection({ taskId, comments, activities, currentUserId, profileById, mentionMembers, onOpenImage, onAddComment, onDeleteComment }: CommentSectionProps) {
  const { t } = useTranslation()
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // user_ids of members the user has @-picked from the suggestion list. Kept
  // in parallel with the textarea text — used to insert huginn_mentions rows
  // on send. Not derived from the text, so renaming a member doesn't lose
  // the mention link.
  const [mentionedIds, setMentionedIds] = useState<string[]>([])
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const mentionListRef = useRef<MentionSuggestionListHandle | null>(null)
  const [mentionState, setMentionState] = useState<{ query: string; start: number } | null>(null)

  const filteredMembers = (mentionMembers ?? []).filter(m =>
    !mentionState ? true : m.label.toLowerCase().includes(mentionState.query.toLowerCase()),
  ).slice(0, 6)

  function handleBodyChange(value: string) {
    setBody(value)
    const ta = textareaRef.current
    if (!ta) { setMentionState(null); return }
    const caret = ta.selectionStart ?? value.length
    // Find the most recent '@' before the caret with no whitespace between it
    // and the caret. That's an active mention query.
    const slice = value.slice(0, caret)
    const atIdx = slice.lastIndexOf('@')
    if (atIdx === -1) { setMentionState(null); return }
    // Must be at start or preceded by whitespace.
    if (atIdx > 0 && !/\s/.test(slice[atIdx - 1])) { setMentionState(null); return }
    const query = slice.slice(atIdx + 1)
    if (/\s/.test(query)) { setMentionState(null); return }
    setMentionState({ query, start: atIdx })
  }

  function selectMention(item: { id: string; label: string }) {
    if (!mentionState) return
    const before = body.slice(0, mentionState.start)
    const after = body.slice((textareaRef.current?.selectionStart) ?? body.length)
    const inserted = `@${item.label} `
    const next = `${before}${inserted}${after}`
    setBody(next)
    setMentionedIds(prev => prev.includes(item.id) ? prev : [...prev, item.id])
    setMentionState(null)
    // Restore caret right after the inserted token on next tick.
    requestAnimationFrame(() => {
      const ta = textareaRef.current
      if (!ta) return
      const pos = before.length + inserted.length
      ta.focus()
      ta.setSelectionRange(pos, pos)
    })
  }

  async function handleSubmit() {
    const trimmed = body.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    const created = await onAddComment(trimmed)
    if (created && typeof created === 'object' && 'id' in created && typeof (created as { id: unknown }).id === 'string') {
      const commentId = (created as { id: string }).id
      // Filter mentionedIds to those that actually still appear in the final
      // comment body — user may have backspaced over the @token.
      const stillMentioned = mentionedIds.filter(id => {
        const member = mentionMembers?.find(m => m.id === id)
        return member ? trimmed.includes(`@${member.label}`) : false
      })
      if (stillMentioned.length > 0) {
        await insertCommentMentions(taskId, commentId, currentUserId, stillMentioned)
      }
    }
    setBody('')
    setMentionedIds([])
    setMentionState(null)
    setSubmitting(false)
  }

  function resolveAuthor(userId: string) {
    const profile = profileById?.[userId]
    const isSelf = userId === currentUserId
    const displayName =
      profile?.display_name?.trim() ||
      profile?.email ||
      (isSelf ? t('comments.selfLabel') : t('comments.unknownUser'))
    return { profile, isSelf, displayName }
  }

  const feed: FeedItem[] = [
    ...comments.map(c => ({ type: 'comment' as const, data: c })),
    ...activities.map(a => ({ type: 'activity' as const, data: a })),
  ].sort((a, b) => new Date(b.data.created_at).getTime() - new Date(a.data.created_at).getTime())

  const selfProfile = profileById?.[currentUserId]

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-2 mb-4 px-0.5">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-huginn-text-secondary">
          <path d="M2 4.5A2.5 2.5 0 0 1 4.5 2h11A2.5 2.5 0 0 1 18 4.5v7a2.5 2.5 0 0 1-2.5 2.5h-4.793l-3.853 3.854A.5.5 0 0 1 6 17.5V14H4.5A2.5 2.5 0 0 1 2 11.5v-7Z" />
        </svg>
        <h3 className="text-sm font-bold text-huginn-text-primary">{t('comments.heading')}</h3>
      </div>

      {/* Comment composer */}
      <div className="flex items-start gap-3 mb-5">
        <div className={AVATAR_COLUMN}>
          <Avatar
            url={selfProfile?.avatar_url}
            name={selfProfile?.display_name}
            email={selfProfile?.email}
            size={AVATAR_SIZE}
          />
        </div>
        <div className="flex-1 min-w-0 relative">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => handleBodyChange(e.target.value)}
            onKeyUp={(e) => {
              // Caret may have moved without value change (arrow keys); refresh.
              if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
                handleBodyChange((e.target as HTMLTextAreaElement).value)
              }
            }}
            placeholder={t('comments.placeholder')}
            rows={body.trim() ? 3 : 1}
            onKeyDown={(e) => {
              if (mentionState && filteredMembers.length > 0) {
                if (mentionListRef.current?.onKeyDown(e.nativeEvent)) {
                  e.preventDefault()
                  return
                }
                if (e.key === 'Escape') { e.preventDefault(); setMentionState(null); return }
              }
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
            }}
            className="w-full bg-huginn-card text-sm text-huginn-text-primary rounded-lg px-3 py-2 outline-none border border-huginn-border focus:border-huginn-accent resize-none placeholder-huginn-text-muted transition-colors"
          />
          {mentionState && filteredMembers.length > 0 && (
            <div className="absolute left-0 top-full mt-1 z-50">
              <MentionSuggestionList
                ref={mentionListRef}
                items={filteredMembers}
                command={selectMention}
              />
            </div>
          )}
          {body.trim() && (
            <div className="flex gap-2 mt-1.5">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-huginn-accent hover:bg-huginn-accent-hover text-white text-xs font-semibold rounded-md px-4 py-1.5 disabled:opacity-50"
              >
                {submitting ? t('comments.saving') : t('common.save')}
              </button>
              <button
                type="button"
                onClick={() => setBody('')}
                className="text-xs text-huginn-text-muted hover:text-white px-2 py-1.5"
              >
                {t('common.cancel')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Feed */}
      <div className="space-y-5">
        {feed.map((item) => {
          if (item.type === 'comment') {
            const comment = item.data as Comment
            const { profile, isSelf, displayName } = resolveAuthor(comment.user_id)
            return (
              <div key={`c-${comment.id}`} className="group flex items-start gap-3">
                <div className={AVATAR_COLUMN}>
                  <Avatar
                    url={profile?.avatar_url}
                    name={profile?.display_name}
                    email={profile?.email}
                    size={AVATAR_SIZE}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap mb-1">
                    <span className="text-sm font-bold text-huginn-text-primary">
                      {displayName}
                    </span>
                    {isSelf && profile && (
                      <span className="text-[10px] text-huginn-text-muted">{t('comments.you')}</span>
                    )}
                    <span className="text-[11px] text-huginn-text-muted">{timeAgo(comment.created_at)}</span>
                  </div>
                  <div className="text-sm text-huginn-text-primary bg-huginn-card border border-huginn-border rounded-lg px-3 py-2 whitespace-pre-wrap break-words shadow-sm shadow-black/10">
                    {renderMentionedText(comment.body, mentionMembers)}
                  </div>
                  {isSelf && (
                    <button
                      onClick={() => onDeleteComment(comment.id)}
                      className="text-[11px] text-huginn-text-muted hover:text-huginn-danger opacity-0 group-hover:opacity-100 transition-opacity mt-1"
                    >
                      {t('common.delete')}
                    </button>
                  )}
                </div>
              </div>
            )
          }
          const activity = item.data as Activity
          const { profile, displayName } = resolveAuthor(activity.user_id)
          const details = (activity.details ?? {}) as Record<string, unknown>
          const isImageAttach = activity.action === 'attached' && details.type === 'image' && typeof details.url === 'string'
          const imageUrl = isImageAttach ? (details.url as string) : null
          const imageName = typeof details.name === 'string' ? details.name : 'image'
          return (
            <div key={`a-${activity.id}`} className="flex items-start gap-3">
              <div className={AVATAR_COLUMN}>
                <Avatar
                  url={profile?.avatar_url}
                  name={profile?.display_name}
                  email={profile?.email}
                  size={AVATAR_SIZE}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-huginn-text-secondary leading-relaxed">
                  <span className="font-bold text-huginn-text-primary">{displayName}</span>
                  {' '}
                  {formatActivityAction(activity, t)}
                </p>
                <p className="text-[11px] text-huginn-text-muted mt-0.5">{timeAgo(activity.created_at)}</p>
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => onOpenImage?.(imageUrl, imageName)}
                    className="mt-2 block w-full rounded-lg overflow-hidden border border-huginn-border hover:border-huginn-accent/60 bg-huginn-card transition-colors group/thumb"
                    title={t('card.attachments.open')}
                  >
                    <img
                      src={imageUrl}
                      alt={imageName}
                      className="w-full max-h-72 object-cover block group-hover/thumb:opacity-90 transition-opacity"
                      draggable={false}
                      loading="lazy"
                    />
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {feed.length === 0 && (
          <div className="flex items-start gap-3 opacity-60">
            <div className={AVATAR_COLUMN} />
            <p className="text-xs text-huginn-text-muted py-2">{t('comments.empty')}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// Highlight `@displayname` substrings that match a known board member.
// Falls back to plain text if mentionMembers isn't provided or no match.
function renderMentionedText(body: string, members?: MentionItem[]) {
  if (!members || members.length === 0) return body
  // Sort labels longest-first so "Heimir Arnfinnsson" wins over "Heimir".
  const labels = [...members].map(m => m.label).sort((a, b) => b.length - a.length)
  const pattern = new RegExp(`@(${labels.map(escapeRegex).join('|')})`, 'g')
  const parts: (string | React.ReactNode)[] = []
  let lastIndex = 0
  let key = 0
  for (const match of body.matchAll(pattern)) {
    const idx = match.index ?? 0
    if (idx > lastIndex) parts.push(body.slice(lastIndex, idx))
    parts.push(
      <span key={`m-${key++}`} className="rounded px-1 bg-huginn-accent-soft text-huginn-accent font-medium">
        {match[0]}
      </span>,
    )
    lastIndex = idx + match[0].length
  }
  if (lastIndex < body.length) parts.push(body.slice(lastIndex))
  return parts
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function formatActivityAction(activity: Activity, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const details = activity.details ?? {}
  switch (activity.action) {
    case 'attached': {
      const name = typeof details.name === 'string' ? details.name : t('activity.attachedFallback')
      return t('activity.attached', { name })
    }
    default:
      return activity.action
  }
}
