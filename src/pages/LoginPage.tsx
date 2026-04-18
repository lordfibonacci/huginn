import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../shared/hooks/useAuth'
import { Lockup } from '../shared/components/Logo'

type Mode = 'signin' | 'signup' | 'forgot' | 'check-inbox' | 'reset-sent'

const EXPECTED_INVITE_CODE = import.meta.env.VITE_INVITE_CODE ?? 'Huginn_app2026!'

export function LoginPage() {
  const { signIn, signUp, requestPasswordReset, resendConfirmation } = useAuth()
  const [searchParams] = useSearchParams()
  const initialMode: Mode = searchParams.get('mode') === 'signup' ? 'signup' : 'signin'
  const [mode, setMode] = useState<Mode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
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
      } else if (mode === 'signup') {
        if (inviteCode.trim() !== EXPECTED_INVITE_CODE) {
          setError('Invalid invite code.')
          setLoading(false)
          return
        }
        const { needsEmailConfirmation } = await signUp(email, password)
        if (needsEmailConfirmation) {
          setPendingEmail(email)
          setMode('check-inbox')
          setPassword('')
          setInviteCode('')
        }
      } else if (mode === 'forgot') {
        await requestPasswordReset(email)
        setPendingEmail(email)
        setMode('reset-sent')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An error occurred'
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
      setInfo('Confirmation email sent.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend')
    }
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setInfo(null)
  }

  return (
    <div className="min-h-screen bg-huginn-surface flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="flex justify-center pb-2">
          <Lockup markSize={104} wordmarkHeight={40} gap={6} />
        </div>

        {mode === 'check-inbox' ? (
          <CheckInboxPanel
            email={pendingEmail}
            error={error}
            info={info}
            onResend={handleResend}
            onBack={() => switchMode('signin')}
          />
        ) : mode === 'reset-sent' ? (
          <ResetSentPanel
            email={pendingEmail}
            onBack={() => switchMode('signin')}
          />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-huginn-text-secondary text-center">
              {mode === 'signin' && 'Sign in to continue'}
              {mode === 'signup' && 'Create your account'}
              {mode === 'forgot' && "Enter your email and we'll send a reset link."}
            </p>

            {error && (
              <div className="text-huginn-danger text-sm text-center bg-huginn-danger/10 border border-huginn-danger/30 rounded-lg px-3 py-2">
                {error}
                {mode === 'signin' && /confirm/i.test(error) && (
                  <button type="button" onClick={handleResend} className="block w-full text-xs text-huginn-accent hover:underline mt-1">
                    Resend confirmation email
                  </button>
                )}
              </div>
            )}
            {info && (
              <p className="text-huginn-success text-sm text-center">{info}</p>
            )}

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-huginn-card text-white rounded-xl px-4 py-3 outline-none border border-huginn-border focus:border-huginn-accent focus:ring-2 focus:ring-huginn-accent placeholder-gray-500"
            />
            {mode !== 'forgot' && (
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                className="w-full bg-huginn-card text-white rounded-xl px-4 py-3 outline-none border border-huginn-border focus:border-huginn-accent focus:ring-2 focus:ring-huginn-accent placeholder-gray-500"
              />
            )}
            {mode === 'signup' && (
              <div>
                <input
                  type="text"
                  placeholder="Invite code"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  required
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full bg-huginn-card text-white rounded-xl px-4 py-3 outline-none border border-huginn-border focus:border-huginn-accent focus:ring-2 focus:ring-huginn-accent placeholder-gray-500 font-mono text-sm"
                />
                <p className="text-[11px] text-huginn-text-muted mt-1.5 px-1">
                  Huginn is invite-only during early access.
                </p>
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-huginn-accent text-white font-semibold rounded-xl py-3 disabled:opacity-50 shadow-md shadow-huginn-accent/30"
            >
              {loading ? '…'
                : mode === 'signin' ? 'Sign In'
                : mode === 'signup' ? 'Create Account'
                : 'Send reset link'}
            </button>

            <div className="flex items-center justify-between text-sm">
              {mode === 'signin' && (
                <>
                  <button type="button" onClick={() => switchMode('forgot')} className="text-huginn-text-muted hover:text-white transition-colors">
                    Forgot password?
                  </button>
                  <button type="button" onClick={() => switchMode('signup')} className="text-huginn-text-muted hover:text-white transition-colors">
                    Create account
                  </button>
                </>
              )}
              {mode === 'signup' && (
                <button type="button" onClick={() => switchMode('signin')} className="w-full text-huginn-text-muted hover:text-white transition-colors text-center">
                  Already have an account? Sign in
                </button>
              )}
              {mode === 'forgot' && (
                <button type="button" onClick={() => switchMode('signin')} className="w-full text-huginn-text-muted hover:text-white transition-colors text-center">
                  ← Back to sign in
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function CheckInboxPanel({ email, error, info, onResend, onBack }: { email: string; error: string | null; info: string | null; onResend: () => void; onBack: () => void }) {
  return (
    <div className="bg-huginn-card border border-huginn-border rounded-xl p-5 text-center space-y-3">
      <div className="w-12 h-12 mx-auto rounded-full bg-huginn-accent/20 text-huginn-accent flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
          <path d="M2.25 6.75A2.25 2.25 0 0 1 4.5 4.5h15a2.25 2.25 0 0 1 2.25 2.25v.347l-9.75 5.687L2.25 7.097V6.75Zm0 2.91v7.59A2.25 2.25 0 0 0 4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V9.66l-9.181 5.357a1.5 1.5 0 0 1-1.638 0L2.25 9.66Z" />
        </svg>
      </div>
      <h2 className="text-base font-bold text-white">Check your inbox</h2>
      <p className="text-sm text-huginn-text-secondary">
        We've sent a confirmation link to<br />
        <span className="text-white font-semibold">{email}</span>
      </p>
      <p className="text-xs text-huginn-text-muted">Click the link in the email to finish signing up.</p>
      {error && <p className="text-huginn-danger text-xs">{error}</p>}
      {info && <p className="text-huginn-success text-xs">{info}</p>}
      <div className="flex flex-col gap-1.5 pt-2">
        <button onClick={onResend} className="text-xs text-huginn-accent hover:underline">
          Didn't get it? Resend
        </button>
        <button onClick={onBack} className="text-xs text-huginn-text-muted hover:text-white transition-colors">
          ← Back to sign in
        </button>
      </div>
    </div>
  )
}

function ResetSentPanel({ email, onBack }: { email: string; onBack: () => void }) {
  return (
    <div className="bg-huginn-card border border-huginn-border rounded-xl p-5 text-center space-y-3">
      <div className="w-12 h-12 mx-auto rounded-full bg-huginn-accent/20 text-huginn-accent flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
          <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clipRule="evenodd" />
        </svg>
      </div>
      <h2 className="text-base font-bold text-white">Reset link sent</h2>
      <p className="text-sm text-huginn-text-secondary">
        If <span className="text-white font-semibold">{email}</span> has an account,<br />
        you'll get an email with a reset link shortly.
      </p>
      <button onClick={onBack} className="text-xs text-huginn-text-muted hover:text-white transition-colors pt-2">
        ← Back to sign in
      </button>
    </div>
  )
}
