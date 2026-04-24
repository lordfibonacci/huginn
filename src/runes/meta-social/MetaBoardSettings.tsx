import { useTranslation } from 'react-i18next'
import { useSocialAccount } from './hooks/useSocialAccount'

export function MetaBoardSettings({ projectId }: { projectId: string }) {
  const { t } = useTranslation()
  const { account, loading } = useSocialAccount(projectId)

  if (loading) return <div className="text-xs text-huginn-text-secondary py-2">{t('common.loading')}</div>

  if (!account) {
    return (
      <div className="flex items-center justify-between gap-3 py-2">
        <div className="text-xs text-huginn-text-secondary">{t('runes.meta-social.notConnected')}</div>
        <button
          type="button"
          disabled
          className="px-3 py-1.5 text-xs rounded-md bg-huginn-accent text-white opacity-60 cursor-not-allowed"
          title="OAuth flow wires up in Task 9"
        >
          {t('runes.meta-social.connect')}
        </button>
      </div>
    )
  }

  return (
    <div className="text-xs space-y-1 py-2">
      <div><span className="text-huginn-text-secondary">{t('runes.meta-social.page')}:</span> <span className="text-huginn-text-primary">{account.fb_page_name}</span></div>
      <div><span className="text-huginn-text-secondary">{t('runes.meta-social.instagram')}:</span> <span className="text-huginn-text-primary">{account.ig_username ?? t('runes.meta-social.igNotLinked')}</span></div>
    </div>
  )
}
