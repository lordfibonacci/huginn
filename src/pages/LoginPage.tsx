import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../shared/hooks/useAuth'
import { Lockup } from '../shared/components/Logo'
import { LanguageToggle } from '../shared/components/LanguageToggle'

// Sign in and forgot password only. Accounts are created by Heimir, there is no signup.
type Mode = 'signin' | 'forgot' | 'reset-sent'

export function LoginPage() {
  const { t } = useTranslation()
  const { signIn, requestPasswordReset, resendConfirmation } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [pendingEmail, setPendingEmail] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      if (mode === 'signin') {
        await signIn(email, password)
      } else if (mode === 'forgot') {
        await requestPasswordReset(email)
        setPendingEmail(email)
        setMode('reset-sent')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('auth.errors.generic')
      setError(msg)
      if (mode === 'signin' && /confirm/i.test(msg)) {
        setPendingEmail(email)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setError(null)
    setInfo(null)
    try {
      await resendConfirmation(pendingEmail || email)
      setInfo(t('auth.login.confirmationResent'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.errors.resendFailed'))
    }
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setInfo(null)
  }

  return (
    <div className="min-h-screen bg-huginn-surface flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>
      <div className="w-full max-w-sm space-y-4">
        <div className="flex justify-center pb-2">
          <Lockup markSize={104} wordmarkHeight={40} gap={6} />
        </div>

        {mode === 'reset-sent' ? (
          <ResetSentPanel
            email={pendingEmail}
            onBack={() => switchMode('signin')}
          />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-huginn-text-secondary text-center">
              {mode === 'signin' && t('auth.login.subtitle')}
              {mode === 'forgot' && t('auth.forgot.subtitle')}
            </p>

            {error && (
              <div className="text-huginn-danger text-sm text-center bg-huginn-danger/10 border border-huginn-danger/30 rounded-lg px-3 py-2">
                {error}
                {mode === 'signin' && /confirm/i.test(error) && (
                  <button type="button" onClick={handleResend} className="block w-full text-xs text-huginn-accent hover:underline mt-1">
                    {t('auth.login.resendConfirmation')}
                  </button>
                )}
              </div>
            )}
            {info && (
              <p className="text-huginn-success text-sm text-center">{info}</p>
            )}

            <input
              type="email"
              placeholder={t('auth.fields.email')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-huginn-card text-white rounded-xl px-4 py-3 outline-none border border-huginn-border focus:border-huginn-accent focus:ring-2 focus:ring-huginn-accent placeholder-gray-500"
            />
            {mode !== 'forgot' && (
              <input
                type="password"
                placeholder={t('auth.fields.password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="current-password"
                className="w-full bg-huginn-card text-white rounded-xl px-4 py-3 outline-none border border-huginn-border focus:border-huginn-accent focus:ring-2 focus:ring-huginn-accent placeholder-gray-500"
              />
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-huginn-accent text-white font-semibold rounded-xl py-3 disabled:opacity-50 shadow-md shadow-huginn-accent/30"
            >
              {loading ? '…'
                : mode === 'signin' ? t('auth.login.submit')
                : t('auth.forgot.submit')}
            </button>

            <div className="flex items-center justify-between text-sm">
              {mode === 'signin' && (
                <button type="button" onClick={() => switchMode('forgot')} className="w-full text-huginn-text-muted hover:text-white transition-colors text-center">
                  {t('auth.login.forgotLink')}
                </button>
              )}
              {mode === 'forgot' && (
                <button type="button" onClick={() => switchMode('signin')} className="w-full text-huginn-text-muted hover:text-white transition-colors text-center">
                  {t('auth.forgot.backLink')}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function ResetSentPanel({ email, onBack }: { email: string; onBack: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="bg-huginn-card border border-huginn-border rounded-xl p-5 text-center space-y-3">
      <div className="w-12 h-12 mx-auto rounded-full bg-huginn-accent/20 text-huginn-accent flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
          <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clipRule="evenodd" />
        </svg>
      </div>
      <h2 className="text-base font-bold text-white">{t('auth.resetSent.title')}</h2>
      <p className="text-sm text-huginn-text-secondary">
        {t('auth.resetSent.bodyLead')} <span className="text-white font-semibold">{email}</span> {t('auth.resetSent.bodyTail')}
      </p>
      <button onClick={onBack} className="text-xs text-huginn-text-muted hover:text-white transition-colors pt-2">
        {t('auth.forgot.backLink')}
      </button>
    </div>
  )
}
