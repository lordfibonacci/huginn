import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../shared/hooks/useAuth'

// Shown to a signed in user who is not a participant in the requested project,
// or in any project at all.
export function NoAccessPage() {
  const { t } = useTranslation()
  const { signOut } = useAuth()
  const [busy, setBusy] = useState(false)

  async function handleSignOut() {
    setBusy(true)
    try {
      await signOut()
    } catch (e) {
      console.error(e)
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full w-full items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-huginn-border bg-huginn-card p-6 text-center">
        <h1 className="text-lg font-semibold text-huginn-text-primary">{t('vinnubord.noAccess.title')}</h1>
        <p className="text-sm text-huginn-text-secondary">{t('vinnubord.noAccess.body')}</p>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={busy}
          className="rounded-lg border border-huginn-border px-4 py-2 text-sm text-huginn-text-primary transition-colors hover:bg-huginn-hover disabled:opacity-50"
        >
          {t('vinnubord.noAccess.signOut')}
        </button>
      </div>
    </div>
  )
}
