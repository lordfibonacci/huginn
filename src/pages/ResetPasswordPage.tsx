import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../shared/lib/supabase'
import { useAuth } from '../shared/hooks/useAuth'
import { Lockup, LoadingScreen } from '../shared/components/Logo'

export function ResetPasswordPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => navigate('/projects', { replace: true }), 1200)
    return () => clearTimeout(t)
  }, [done, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setDone(true)
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-huginn-surface flex items-center justify-center p-4">
        <LoadingScreen message="Loading" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-huginn-surface flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="flex justify-center pb-2">
          <Lockup markSize={88} wordmarkHeight={32} gap={4} />
        </div>

        {!user ? (
          <div className="bg-huginn-card border border-huginn-border rounded-xl p-5 text-center space-y-3">
            <h2 className="text-base font-bold text-white">Reset link expired</h2>
            <p className="text-sm text-huginn-text-secondary">
              Your reset link is no longer valid. Request a new one to continue.
            </p>
            <Link to="/login" className="inline-block text-xs text-huginn-accent hover:underline pt-1">
              ← Back to sign in
            </Link>
          </div>
        ) : done ? (
          <div className="bg-huginn-card border border-huginn-border rounded-xl p-5 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-huginn-success/20 text-huginn-success flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-white">Password updated</h2>
            <p className="text-sm text-huginn-text-secondary">Taking you to your boards…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-center">
              <h2 className="text-base font-bold text-white">Choose a new password</h2>
              <p className="text-xs text-huginn-text-secondary mt-1">At least 6 characters.</p>
            </div>

            {error && (
              <p className="text-huginn-danger text-sm text-center bg-huginn-danger/10 border border-huginn-danger/30 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoFocus
              autoComplete="new-password"
              className="w-full bg-huginn-card text-white rounded-xl px-4 py-3 outline-none border border-huginn-border focus:border-huginn-accent focus:ring-2 focus:ring-huginn-accent placeholder-gray-500"
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full bg-huginn-card text-white rounded-xl px-4 py-3 outline-none border border-huginn-border focus:border-huginn-accent focus:ring-2 focus:ring-huginn-accent placeholder-gray-500"
            />
            <button
              type="submit"
              disabled={saving || !password || !confirm}
              className="w-full bg-huginn-accent text-white font-semibold rounded-xl py-3 disabled:opacity-50 shadow-md shadow-huginn-accent/30"
            >
              {saving ? '…' : 'Update password'}
            </button>
            <Link to="/login" className="block text-center text-xs text-huginn-text-muted hover:text-white transition-colors">
              ← Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  )
}
