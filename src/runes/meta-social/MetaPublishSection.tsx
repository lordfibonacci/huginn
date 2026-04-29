import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SocialPostStatus, Task } from '../../shared/lib/types'
import { useSocialPost } from './hooks/useSocialPost'
import { useSocialAccount } from './hooks/useSocialAccount'
import { useAttachments } from '../../features/projects/hooks/useAttachments'
import { MediaPicker } from './MediaPicker'
import { validateForMeta } from './validation'

export function MetaPublishSection({ task }: { task: Task }) {
  const { t } = useTranslation()
  const projectId = task.project_id ?? undefined
  const { post, upsert, setStatus } = useSocialPost(task.id)
  const { account } = useSocialAccount(projectId)
  const { attachments } = useAttachments(task.id)

  const [showOverrides, setShowOverrides] = useState(false)

  if (!projectId) return null
  if (!account) {
    return (
      <div className="rounded-lg border border-huginn-border bg-huginn-card p-3 text-xs text-huginn-text-secondary">
        {t('runes.meta-social.connectFirst')}
      </div>
    )
  }
  if (!post) {
    return (
      <div className="rounded-lg border border-huginn-border bg-huginn-card p-3 flex items-center justify-between">
        <div className="text-xs text-huginn-text-secondary">{t('runes.meta-social.notAPost')}</div>
        <button
          type="button"
          onClick={() => upsert({ status: 'draft' })}
          className="px-3 py-1.5 text-xs rounded-md bg-huginn-accent text-white hover:bg-huginn-accent-hover"
        >
          {t('runes.meta-social.turnIntoPost')}
        </button>
      </div>
    )
  }

  const igDisabled = !account.ig_business_id
  const issues = validateForMeta(attachments, post.media_attachment_ids, post.platforms)
  const invalidIds = new Set(issues.map(i => i.attachmentId).filter(Boolean))
  const canSchedule =
    post.status === 'draft' &&
    issues.length === 0 &&
    (post.platforms.fb || post.platforms.ig) &&
    !!post.scheduled_at &&
    new Date(post.scheduled_at).getTime() > Date.now()

  return (
    <div className="rounded-lg border border-huginn-border bg-huginn-card p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-huginn-text-primary">
          {t('runes.meta-social.composerTitle')}
        </div>
        <StatusPill
          status={post.status}
          scheduledAt={post.scheduled_at}
          publishedAt={post.published_at}
        />
      </div>

      {/* Platforms */}
      <div className="flex items-center gap-4 text-xs">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={post.platforms.fb}
            onChange={e => upsert({ platforms: { ...post.platforms, fb: e.target.checked } })}
          />
          {t('runes.meta-social.facebook')}
        </label>
        <label
          className={`flex items-center gap-1.5 ${igDisabled ? 'opacity-50' : ''}`}
          title={igDisabled ? t('runes.meta-social.igNotLinked') : undefined}
        >
          <input
            type="checkbox"
            disabled={igDisabled}
            checked={post.platforms.ig}
            onChange={e => upsert({ platforms: { ...post.platforms, ig: e.target.checked } })}
          />
          {t('runes.meta-social.instagram')}
        </label>
      </div>

      {/* Scheduled at */}
      <label className="block text-xs">
        <span className="text-huginn-text-secondary">{t('runes.meta-social.scheduledAt')}</span>
        <input
          type="datetime-local"
          className="mt-1 w-full rounded-md bg-huginn-base border border-huginn-border px-2 py-1 text-huginn-text-primary"
          value={toLocalInput(post.scheduled_at)}
          onChange={e => upsert({ scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
        />
      </label>

      {/* Base caption */}
      <label className="block text-xs">
        <span className="text-huginn-text-secondary">{t('runes.meta-social.caption')}</span>
        <textarea
          rows={4}
          className="mt-1 w-full rounded-md bg-huginn-base border border-huginn-border px-2 py-1 text-huginn-text-primary text-sm"
          value={post.caption_base}
          onChange={e => upsert({ caption_base: e.target.value })}
        />
      </label>

      {/* Per-platform overrides */}
      <button
        type="button"
        onClick={() => setShowOverrides(v => !v)}
        className="text-xs text-huginn-accent hover:underline"
      >
        {showOverrides ? t('runes.meta-social.hideOverrides') : t('runes.meta-social.showOverrides')}
      </button>
      {showOverrides && (
        <div className="space-y-2">
          <textarea
            rows={3}
            placeholder={t('runes.meta-social.fbOverridePh')}
            className="w-full rounded-md bg-huginn-base border border-huginn-border px-2 py-1 text-xs text-huginn-text-primary"
            value={post.caption_fb ?? ''}
            onChange={e => upsert({ caption_fb: e.target.value || null })}
          />
          <textarea
            rows={3}
            placeholder={t('runes.meta-social.igOverridePh')}
            className="w-full rounded-md bg-huginn-base border border-huginn-border px-2 py-1 text-xs text-huginn-text-primary"
            value={post.caption_ig ?? ''}
            onChange={e => upsert({ caption_ig: e.target.value || null })}
          />
          <input
            type="text"
            placeholder={t('runes.meta-social.firstCommentPh')}
            className="w-full rounded-md bg-huginn-base border border-huginn-border px-2 py-1 text-xs text-huginn-text-primary"
            value={post.first_comment_ig ?? ''}
            onChange={e => upsert({ first_comment_ig: e.target.value || null })}
          />
        </div>
      )}

      {/* Media */}
      <div>
        <div className="text-xs text-huginn-text-secondary mb-1">{t('runes.meta-social.media')}</div>
        <MediaPicker
          attachments={attachments}
          selectedIds={post.media_attachment_ids}
          invalidIds={invalidIds}
          onChange={ids => upsert({ media_attachment_ids: ids })}
        />
      </div>

      {/* Issues */}
      {issues.length > 0 && (
        <ul className="text-xs text-huginn-danger space-y-0.5">
          {issues.map((i, idx) => (
            <li key={idx}>{`\u2022 ${t(`runes.meta-social.validation.${i.reason}`)}`}</li>
          ))}
        </ul>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {post.status === 'draft' && (
          <button
            type="button"
            disabled={!canSchedule}
            onClick={() => setStatus('scheduled')}
            className="px-3 py-1.5 text-xs rounded-md bg-huginn-accent text-white hover:bg-huginn-accent-hover disabled:opacity-50"
          >
            {t('runes.meta-social.schedule')}
          </button>
        )}
        {post.status === 'scheduled' && (
          <>
            <button
              type="button"
              onClick={() => setStatus('draft')}
              className="px-3 py-1.5 text-xs rounded-md bg-huginn-hover text-huginn-text-primary"
            >
              {t('runes.meta-social.unschedule')}
            </button>
            <button
              type="button"
              onClick={() => setStatus('scheduled', { scheduled_at: new Date().toISOString() })}
              className="px-3 py-1.5 text-xs rounded-md bg-huginn-accent text-white"
            >
              {t('runes.meta-social.publishNow')}
            </button>
          </>
        )}
        {post.status === 'published' && (
          <div className="text-xs text-huginn-text-secondary flex gap-2">
            {post.fb_post_id && (
              <a
                className="text-huginn-accent"
                target="_blank"
                rel="noreferrer"
                href={`https://facebook.com/${post.fb_post_id}`}
              >
                {t('runes.meta-social.openOnFb')}
              </a>
            )}
            {post.ig_post_id && (
              <a
                className="text-huginn-accent"
                target="_blank"
                rel="noreferrer"
                href={`https://www.instagram.com/p/${post.ig_post_id}`}
              >
                {t('runes.meta-social.openOnIg')}
              </a>
            )}
          </div>
        )}
        {post.status === 'failed' && (
          <>
            <div
              className="text-xs text-huginn-danger flex-1 truncate"
              title={post.error_message ?? ''}
            >
              {post.error_message ?? t('runes.meta-social.failed')}
            </div>
            <button
              type="button"
              onClick={() => setStatus('scheduled', { scheduled_at: new Date().toISOString(), error_message: null })}
              className="px-3 py-1.5 text-xs rounded-md bg-huginn-hover text-huginn-text-primary"
            >
              {t('runes.meta-social.retry')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function StatusPill({
  status,
  scheduledAt,
  publishedAt,
}: {
  status: SocialPostStatus
  scheduledAt: string | null
  publishedAt: string | null
}) {
  const { t } = useTranslation()
  const bg =
    status === 'published' ? 'bg-huginn-success/20 text-huginn-success' :
    status === 'failed' ? 'bg-huginn-danger/20 text-huginn-danger' :
    status === 'publishing' ? 'bg-huginn-warning/20 text-huginn-warning' :
    status === 'scheduled' ? 'bg-huginn-accent-soft text-huginn-accent' :
    'bg-huginn-hover text-huginn-text-secondary'

  let label: string
  if (status === 'scheduled' && scheduledAt) {
    label = new Date(scheduledAt).toLocaleString()
  } else if (status === 'published' && publishedAt) {
    label = t('runes.meta-social.postedAt', { when: new Date(publishedAt).toLocaleString() })
  } else {
    label = t(`runes.meta-social.status.${status}`)
  }

  return <span className={`text-[10px] px-2 py-0.5 rounded-full ${bg}`}>{label}</span>
}

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
