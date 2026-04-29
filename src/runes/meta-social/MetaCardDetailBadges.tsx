import { useTranslation } from 'react-i18next'
import type { Task } from '../../shared/lib/types'
import { useSocialPost } from './hooks/useSocialPost'

/**
 * Detail-pane status line mounted near the top of CardPopup. Suppressed for
 * draft posts (the publish section on the card back is enough context there).
 */
export function MetaCardDetailBadges({ task }: { task: Task }) {
  const { t } = useTranslation()
  const { post } = useSocialPost(task.id)
  if (!post || post.status === 'draft') return null

  if (post.status === 'scheduled' && post.scheduled_at) {
    const platforms = [post.platforms.fb && 'FB', post.platforms.ig && 'IG'].filter(Boolean).join(' + ')
    return (
      <div className="text-xs text-huginn-accent">
        {t('runes.meta-social.detail.scheduled', {
          when: new Date(post.scheduled_at).toLocaleString(),
          platforms,
        })}
      </div>
    )
  }
  if (post.status === 'published' && post.published_at) {
    return (
      <div className="text-xs text-huginn-success">
        {t('runes.meta-social.detail.published', { when: relativeTime(post.published_at, t) })}
      </div>
    )
  }
  if (post.status === 'failed') {
    return (
      <div className="text-xs text-huginn-danger">
        {post.error_message
          ? t('runes.meta-social.detail.failedWithMsg', { msg: post.error_message })
          : t('runes.meta-social.detail.failedNoMsg')}
      </div>
    )
  }
  if (post.status === 'publishing') {
    return (
      <div className="text-xs text-huginn-warning">
        {t('runes.meta-social.detail.publishing')}
      </div>
    )
  }
  return null
}

type TFn = (key: string, options?: Record<string, unknown>) => string

function relativeTime(iso: string, t: TFn): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return t('runes.meta-social.timeAgo.justNow')
  if (m < 60) return t('runes.meta-social.timeAgo.minutes', { count: m })
  const h = Math.floor(m / 60)
  if (h < 24) return t('runes.meta-social.timeAgo.hours', { count: h })
  const d = Math.floor(h / 24)
  return t('runes.meta-social.timeAgo.days', { count: d })
}
