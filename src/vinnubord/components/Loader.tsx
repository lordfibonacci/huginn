import { useTranslation } from 'react-i18next'

// Calm centered spinner, used while auth, memberships or the board load.
export function Loader() {
  const { t } = useTranslation()
  return (
    <div className="flex h-full min-h-[50dvh] w-full items-center justify-center" role="status" aria-label={t('vinnubord.loading')}>
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-huginn-border border-t-huginn-accent" />
    </div>
  )
}
