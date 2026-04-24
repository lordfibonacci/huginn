import { useTranslation } from 'react-i18next'
import type { Task } from '../../shared/lib/types'
import { useSocialPost } from './hooks/useSocialPost'
import { useSocialAccount } from './hooks/useSocialAccount'

export function MetaPublishSection({ task }: { task: Task }) {
  const { t } = useTranslation()
  const { post, upsert } = useSocialPost(task.id)
  const { account } = useSocialAccount(task.project_id ?? undefined)

  if (!task.project_id) return null   // inbox cards cannot be posts

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

  return (
    <div className="rounded-lg border border-huginn-border bg-huginn-card p-3 text-xs text-huginn-text-secondary">
      {t('runes.meta-social.composerComingInTask10')}
      <div className="mt-1 text-huginn-text-primary">Status: {post.status}</div>
    </div>
  )
}
