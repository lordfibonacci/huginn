import { useState } from 'react'
import type { Comment, Activity } from '../../../shared/lib/types'
import { timeAgo } from '../../../shared/lib/dateUtils'

interface CommentSectionProps {
  comments: Comment[]
  activities: Activity[]
  currentUserId: string
  onAddComment: (body: string) => Promise<unknown>
  onDeleteComment: (commentId: string) => void
}

type FeedItem =
  | { type: 'comment'; data: Comment }
  | { type: 'activity'; data: Activity }

export function CommentSection({ comments, activities, currentUserId, onAddComment, onDeleteComment }: CommentSectionProps) {
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

  // Merge comments and activities into a single feed, sorted by created_at descending (newest first)
  const feed: FeedItem[] = [
    ...comments.map(c => ({ type: 'comment' as const, data: c })),
    ...activities.map(a => ({ type: 'activity' as const, data: a })),
  ].sort((a, b) => new Date(b.data.created_at).getTime() - new Date(a.data.created_at).getTime())

  return (
    <div>
      {/* Header */}
      <p className="text-xs text-huginn-text-muted font-semibold mb-3 flex items-center gap-2">
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
          className="w-full bg-huginn-surface text-sm text-huginn-text-primary rounded-lg px-3 py-2.5 outline-none border border-huginn-border focus:border-huginn-accent resize-none placeholder-huginn-text-muted"
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
            const isOwn = comment.user_id === currentUserId
            return (
              <div key={`c-${comment.id}`} className="group">
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-huginn-accent/20 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-huginn-accent">
                      {isOwn ? 'You' : 'U'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-huginn-text-primary">
                        {isOwn ? 'You' : 'User'}
                      </span>
                      <span className="text-[10px] text-huginn-text-muted">{timeAgo(comment.created_at)}</span>
                    </div>
                    <p className="text-sm text-huginn-text-primary mt-0.5 bg-huginn-card rounded-lg px-3 py-2">
                      {comment.body}
                    </p>
                    {isOwn && (
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
          } else {
            const activity = item.data as Activity
            return (
              <div key={`a-${activity.id}`} className="flex items-center gap-2 text-xs text-huginn-text-muted py-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-huginn-text-muted shrink-0" />
                <span>{activity.action}</span>
                <span className="text-[10px]">{timeAgo(activity.created_at)}</span>
              </div>
            )
          }
        })}

        {feed.length === 0 && (
          <p className="text-xs text-huginn-text-muted py-2">No activity yet.</p>
        )}
      </div>
    </div>
  )
}
