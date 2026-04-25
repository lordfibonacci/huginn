import { useTranslation } from 'react-i18next'
import type { Task } from '../../shared/lib/types'
import { useSocialPost } from './hooks/useSocialPost'

/**
 * Card-front badge mounted under the labels row in TaskCard.
 * Shows the post's status (draft / scheduled / posted / failed) plus the
 * targeted Meta platforms. Returns null when the card isn't a post yet.
 */
export function MetaCardBadges({ task }: { task: Task }) {
  const { t } = useTranslation()
  const { post } = useSocialPost(task.id)
  if (!post) return null

  const color =
    post.status === 'published' ? 'bg-huginn-success/20 text-huginn-success' :
    post.status === 'failed' ? 'bg-huginn-danger/20 text-huginn-danger' :
    post.status === 'scheduled' ? 'bg-huginn-accent-soft text-huginn-accent' :
    'bg-huginn-hover text-huginn-text-secondary'

  const label =
    post.status === 'scheduled' && post.scheduled_at
      ? shortTime(post.scheduled_at)
      : post.status === 'published'
        ? t('runes.meta-social.status.published')
        : post.status === 'failed'
          ? t('runes.meta-social.status.failed')
          : post.status === 'publishing'
            ? t('runes.meta-social.status.publishing')
            : t('runes.meta-social.status.draft')

  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${color} inline-flex items-center gap-1`}>
      {post.platforms.fb && <span aria-label="Facebook">ⓕ</span>}
      {post.platforms.ig && <span aria-label="Instagram">ⓘ</span>}
      <span>{label}</span>
    </span>
  )
}

function shortTime(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  )
}
