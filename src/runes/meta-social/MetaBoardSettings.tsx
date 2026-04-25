import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSocialAccount } from './hooks/useSocialAccount'

function buildMetaAuthUrl(projectId: string, csrfToken: string): string {
  const appId = import.meta.env.VITE_META_APP_ID as string
  const redirectUri = import.meta.env.VITE_META_OAUTH_REDIRECT_URI as string
  const state = btoa(JSON.stringify({ project_id: projectId, csrf: csrfToken }))
  // Legacy instagram_* scopes (not instagram_business_*) — those only work
  // with the Instagram Login dialog. We use Facebook Login + Page tokens.
  // instagram_content_publish is required for IG publishing (Task 13).
  const scopes = [
    'pages_show_list', 'pages_manage_posts', 'pages_read_engagement',
    'instagram_basic', 'instagram_content_publish', 'business_management',
  ].join(',')
  const u = new URL('https://www.facebook.com/v21.0/dialog/oauth')
  u.searchParams.set('client_id', appId)
  u.searchParams.set('redirect_uri', redirectUri)
  u.searchParams.set('state', state)
  u.searchParams.set('scope', scopes)
  return u.toString()
}

export function MetaBoardSettings({ projectId }: { projectId: string }) {
  const { t } = useTranslation()
  const { account, loading } = useSocialAccount(projectId)

  const onConnect = useCallback(() => {
    const csrf = crypto.randomUUID()
    sessionStorage.setItem('huginn.meta.oauth.csrf', csrf)
    sessionStorage.setItem('huginn.meta.oauth.project_id', projectId)
    window.location.href = buildMetaAuthUrl(projectId, csrf)
  }, [projectId])

  if (loading) return <div className="text-xs text-huginn-text-secondary py-2">{t('common.loading')}</div>

  if (!account) {
    return (
      <div className="flex items-center justify-between gap-3 py-2">
        <div className="text-xs text-huginn-text-secondary">{t('runes.meta-social.notConnected')}</div>
        <button
          type="button"
          onClick={onConnect}
          className="px-3 py-1.5 text-xs rounded-md bg-huginn-accent hover:bg-huginn-accent-hover text-white transition-colors"
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
