import { useTranslation } from 'react-i18next'

// Placeholder for /p/:slug/stillingar. The real settings arrive in plan 2.
export function SettingsStubPage() {
  const { t } = useTranslation()
  return (
    <div className="flex h-full items-center justify-center p-4">
      <p className="text-sm text-huginn-text-secondary">{t('vinnubord.settings.comingSoon')}</p>
    </div>
  )
}
