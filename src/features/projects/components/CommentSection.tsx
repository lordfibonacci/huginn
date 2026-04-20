import { useState } from 'react'
import type { Comment, Activity, Profile } from '../../../shared/lib/types'
import { timeAgo } from '../../../shared/lib/dateUtils'
import { Avatar } from '../../../shared/components/Avatar'

interface CommentSectionProps {
  comments: Comment[]
  activities: Activity[]
  currentUserId: string
  /** Map of user_id -> profile. Built by the caller from board members + self. */
  profileById?: Record<string, Profile>
  /** Open an image in the parent's lightbox (single lightbox per card). */
  onOpenImage?: (url: string, name: string) => void
  onAddComment: (body: string) => Promise<unknown>
  onDeleteComment: (commentId: string) => void
}

type FeedItem =
  | { type: 'comment'; data: Comment }
  | { type: 'activity'; data: Activity }

const AVATAR_SIZE = 32
const AVATAR_COLUMN = 'w-10 shrink-0' // 40px column for the avatar (avatar + breathing room)

export function CommentSection({ comments, activities, currentUserId, profileById, onOpenImage, onAddComment, onDeleteComment }: CommentSectionProps) {
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    const trimmed = body.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    await onAddComment(trimmed)
    setBody('')
    setSubmitting(false)
  }

  function resolveAuthor(userId: string) {
    const profile = profileById?.[userId]
    const isSelf = userId === currentUserId
    const displayName =
      profile?.display_name?.trim() ||
      profile?.email ||
      (isSelf ? 'You' : 'Unknown user')
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
        <h3 className="text-sm font-bold text-huginn-text-primary">Comments and activity</h3>
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
        <div className="flex-1 min-w-0">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a comment…"
            rows={body.trim() ? 3 : 1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
            }}
            className="w-full bg-huginn-card text-sm text-huginn-text-primary rounded-lg px-3 py-2 outline-none border border-huginn-border focus:border-huginn-accent resize-none placeholder-huginn-text-muted transition-colors"
          />
          {body.trim() && (
            <div className="flex gap-2 mt-1.5">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-huginn-accent hover:bg-huginn-accent-hover text-white text-xs font-semibold rounded-md px-4 py-1.5 disabled:opacity-50"
              >
                {submitting ? '…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setBody('')}
                className="text-xs text-huginn-text-muted hover:text-white px-2 py-1.5"
              >
                Cancel
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
                      <span className="text-[10px] text-huginn-text-muted">(you)</span>
                    )}
                    <span className="text-[11px] text-huginn-text-muted">{timeAgo(comment.created_at)}</span>
                  </div>
                  <div className="text-sm text-huginn-text-primary bg-huginn-card border border-huginn-border rounded-lg px-3 py-2 whitespace-pre-wrap break-words shadow-sm shadow-black/10">
                    {comment.body}
                  </div>
                  {isSelf && (
                    <button
                      onClick={() => onDeleteComment(comment.id)}
                      className="text-[11px] text-huginn-text-muted hover:text-huginn-danger opacity-0 group-hover:opacity-100 transition-opacity mt-1"
                    >
                      Delete
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
                  {formatActivityAction(activity)}
                </p>
                <p className="text-[11px] text-huginn-text-muted mt-0.5">{timeAgo(activity.created_at)}</p>
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => onOpenImage?.(imageUrl, imageName)}
                    className="mt-2 block w-full rounded-lg overflow-hidden border border-huginn-border hover:border-huginn-accent/60 bg-huginn-card transition-colors group/thumb"
                    title="Open"
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
            <p className="text-xs text-huginn-text-muted py-2">No activity yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function formatActivityAction(activity: Activity): string {
  const details = activity.details ?? {}
  switch (activity.action) {
    case 'attached': {
      const name = typeof details.name === 'string' ? details.name : 'a file'
      return `attached ${name}`
    }
    default:
      return activity.action
  }
}
