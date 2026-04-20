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

  return (
    <div>
      <p className="text-sm text-huginn-text-muted font-semibold mb-3 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
          <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h11A1.5 1.5 0 0 1 15 3.5v6a1.5 1.5 0 0 1-1.5 1.5H10l-3.5 2.5V11H2.5A1.5 1.5 0 0 1 1 9.5v-6Z" />
        </svg>
        Activity
      </p>

      {/* Comment input */}
      <div className="mb-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a comment..."
          rows={2}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
          }}
          className="w-full bg-huginn-surface text-sm text-huginn-text-primary rounded-lg px-4 py-3 outline-none border border-huginn-border focus:border-huginn-accent resize-none placeholder-huginn-text-muted"
        />
        {body.trim() && (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="mt-1.5 bg-huginn-accent text-white text-xs font-semibold rounded-md px-3 py-1.5 disabled:opacity-50"
          >
            {submitting ? '...' : 'Save'}
          </button>
        )}
      </div>

      {/* Feed */}
      <div className="space-y-3">
        {feed.map((item) => {
          if (item.type === 'comment') {
            const comment = item.data as Comment
            const { profile, isSelf, displayName } = resolveAuthor(comment.user_id)
            return (
              <div key={`c-${comment.id}`} className="group">
                <div className="flex items-start gap-2">
                  <Avatar
                    url={profile?.avatar_url}
                    name={profile?.display_name}
                    email={profile?.email}
                    size={26}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-huginn-text-primary">
                        {displayName}
                      </span>
                      {isSelf && profile && (
                        <span className="text-[10px] text-huginn-text-muted">(you)</span>
                      )}
                      <span className="text-[10px] text-huginn-text-muted">{timeAgo(comment.created_at)}</span>
                    </div>
                    <p className="text-sm text-huginn-text-primary mt-0.5 bg-huginn-card rounded-lg px-3 py-2 whitespace-pre-wrap break-words">
                      {comment.body}
                    </p>
                    {isSelf && (
                      <button
                        onClick={() => onDeleteComment(comment.id)}
                        className="text-[10px] text-huginn-text-muted hover:text-huginn-danger opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
                      >
                        Delete
                      </button>
                    )}
                  </div>
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
            <div key={`a-${activity.id}`} className="text-xs text-huginn-text-muted">
              <div className="flex items-center gap-2 py-0.5">
                <Avatar
                  url={profile?.avatar_url}
                  name={profile?.display_name}
                  email={profile?.email}
                  size={16}
                />
                <span>
                  <span className="font-semibold text-huginn-text-secondary">{displayName}</span>
                  {' '}
                  {formatActivityAction(activity)}
                </span>
                <span className="text-[10px]">{timeAgo(activity.created_at)}</span>
              </div>
              {imageUrl && (
                <button
                  type="button"
                  onClick={() => onOpenImage?.(imageUrl, imageName)}
                  className="ml-6 mt-1.5 block rounded-lg overflow-hidden border border-huginn-border hover:border-huginn-accent/60 transition-colors"
                  title="Open"
                >
                  <img
                    src={imageUrl}
                    alt={imageName}
                    className="max-w-[320px] max-h-[200px] object-cover block"
                    draggable={false}
                    loading="lazy"
                  />
                </button>
              )}
            </div>
          )
        })}

        {feed.length === 0 && (
          <p className="text-xs text-huginn-text-muted py-2">No activity yet.</p>
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
