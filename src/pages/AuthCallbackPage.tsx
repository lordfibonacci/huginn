import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../shared/lib/supabase'
import { LoadingScreen, Lockup } from '../shared/components/Logo'

type State =
  | { kind: 'processing' }
  | { kind: 'success'; redirectTo: string; message: string }
  | { kind: 'error'; message: string }

export function AuthCallbackPage() {
  const [state, setState] = useState<State>({ kind: 'processing' })
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    const hash = window.location.hash
    const hashError = readHashParam(hash, 'error_description') ?? readHashParam(hash, 'error')
    if (hashError) {
      setState({ kind: 'error', message: decodeURIComponent(hashError.replace(/\+/g, ' ')) })
      return
    }

    const flowType =
      searchParams.get('type') ??
      readHashParam(hash, 'type') ??
      'signup'

    let mounted = true

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      if (event === 'PASSWORD_RECOVERY') {
        setState({ kind: 'success', redirectTo: '/reset-password', message: 'Verified — choose a new password' })
        return
      }
      if (event === 'SIGNED_IN' && session) {
        setState({
          kind: 'success',
          redirectTo: '/projects',
          message: flowType === 'recovery' ? 'Verified — choose a new password' : 'Email confirmed',
        })
      }
    })

    // Fallback in case Supabase already processed the hash before we mounted.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted || !session) return
      if (flowType === 'recovery') {
        setState({ kind: 'success', redirectTo: '/reset-password', message: 'Verified — choose a new password' })
      } else {
        setState({ kind: 'success', redirectTo: '/projects', message: 'Email confirmed' })
      }
    })

    const timeout = setTimeout(() => {
      if (!mounted) return
      setState((s) => s.kind === 'processing'
        ? { kind: 'error', message: 'Confirmation link expired or already used. Try signing in again.' }
        : s)
    }, 8000)

    return () => {
      mounted = false
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [searchParams])

  useEffect(() => {
    if (state.kind !== 'success') return
    const t = setTimeout(() => navigate(state.redirectTo, { replace: true }), 800)
    return () => clearTimeout(t)
  }, [state, navigate])

  if (state.kind === 'processing') {
    return (
      <div className="min-h-screen bg-huginn-surface flex items-center justify-center p-4">
        <LoadingScreen message="Confirming your account" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-huginn-surface flex items-center justify-center p-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-5 text-center">
        <Lockup markSize={72} wordmarkHeight={28} gap={4} />
        {state.kind === 'success' ? (
          <>
            <p className="text-huginn-success text-sm font-semibold">{state.message}</p>
            <p className="text-xs text-huginn-text-muted">Taking you in…</p>
          </>
        ) : (
          <>
            <p className="text-huginn-danger text-sm font-semibold">{state.message}</p>
            <Link to="/login" className="text-xs text-huginn-accent hover:underline">
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

function readHashParam(hash: string, key: string): string | null {
  if (!hash || hash.length < 2) return null
  const params = new URLSearchParams(hash.slice(1))
  return params.get(key)
}
