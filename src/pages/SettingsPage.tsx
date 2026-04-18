import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../shared/hooks/useAuth'
import { useProfile } from '../shared/hooks/useProfile'
import { useAvatarUpload } from '../shared/hooks/useAvatarUpload'
import { Avatar } from '../shared/components/Avatar'
import { Mark, Wordmark } from '../shared/components/Logo'
import { supabase } from '../shared/lib/supabase'

type Status = { kind: 'idle' } | { kind: 'success'; message: string } | { kind: 'error'; message: string }

export function SettingsPage() {
  const { user, signOut } = useAuth()
  const { profile, updateProfile } = useProfile()
  const { upload, uploading, error: uploadError } = useAvatarUpload()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [displayName, setDisplayName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameStatus, setNameStatus] = useState<Status>({ kind: 'idle' })

  const [email, setEmail] = useState('')
  const [savingEmail, setSavingEmail] = useState(false)
  const [emailStatus, setEmailStatus] = useState<Status>({ kind: 'idle' })

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordStatus, setPasswordStatus] = useState<Status>({ kind: 'idle' })

  useEffect(() => {
    if (profile?.display_name) setDisplayName(profile.display_name)
  }, [profile?.display_name])

  useEffect(() => {
    if (user?.email) setEmail(user.email)
  }, [user?.email])

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    const url = await upload(user.id, file)
    if (url) await updateProfile({ avatar_url: url })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSaveName() {
    const trimmed = displayName.trim()
    if (!trimmed || savingName) return
    setSavingName(true)
    setNameStatus({ kind: 'idle' })
    const ok = await updateProfile({ display_name: trimmed })
    setNameStatus(ok
      ? { kind: 'success', message: 'Saved' }
      : { kind: 'error', message: 'Could not save name' })
    setSavingName(false)
  }

  async function handleSaveEmail() {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || savingEmail || trimmed === user?.email) return
    setSavingEmail(true)
    setEmailStatus({ kind: 'idle' })
    const { error } = await supabase.auth.updateUser({ email: trimmed })
    setEmailStatus(error
      ? { kind: 'error', message: error.message }
      : { kind: 'success', message: 'Check your old AND new inbox to confirm the change.' })
    setSavingEmail(false)
  }

  async function handleSavePassword() {
    if (savingPassword) return
    if (newPassword.length < 6) {
      setPasswordStatus({ kind: 'error', message: 'Password must be at least 6 characters.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ kind: 'error', message: 'Passwords do not match.' })
      return
    }
    setSavingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPasswordStatus(error
      ? { kind: 'error', message: error.message }
      : { kind: 'success', message: 'Password updated.' })
    if (!error) {
      setNewPassword('')
      setConfirmPassword('')
    }
    setSavingPassword(false)
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <>
      <header className="flex items-center justify-between px-4 py-3 border-b border-huginn-border md:px-6">
        <Link to="/projects" className="flex items-center gap-3 group">
          <Mark size={32} />
          <div className="flex flex-col">
            <Wordmark height={20} />
            <p className="text-[11px] text-huginn-text-secondary mt-0.5">Settings</p>
          </div>
        </Link>
        <Link
          to="/projects"
          className="text-xs text-huginn-text-muted hover:text-white transition-colors"
        >
          ← Back to projects
        </Link>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Avatar + identity */}
          <Section title="Profile">
            <div className="flex items-center gap-5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="relative group rounded-full"
                title="Change avatar"
              >
                <Avatar
                  url={profile?.avatar_url}
                  name={profile?.display_name}
                  email={user?.email}
                  size={88}
                />
                <span className="absolute inset-0 rounded-full bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] font-bold uppercase tracking-wider text-white">
                  {uploading ? 'Uploading…' : 'Change'}
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleAvatarChange}
                className="hidden"
              />
              <div className="text-xs text-huginn-text-muted leading-relaxed">
                <p>Click your avatar to upload a new image.</p>
                <p>PNG, JPEG, WEBP or GIF. Max 2 MB.</p>
                {uploadError && <p className="text-huginn-danger mt-1">{uploadError}</p>}
              </div>
            </div>
          </Section>

          {/* Display name */}
          <Section title="Display name" hint="Shown on your boards and assigned cards.">
            <div className="flex gap-2">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="flex-1 bg-huginn-surface text-white text-sm rounded-lg px-4 py-2.5 outline-none border border-huginn-border focus:border-huginn-accent"
              />
              <button
                onClick={handleSaveName}
                disabled={savingName || !displayName.trim() || displayName.trim() === profile?.display_name}
                className="bg-huginn-accent text-white text-sm font-semibold rounded-lg px-5 disabled:opacity-50"
              >
                {savingName ? '…' : 'Save'}
              </button>
            </div>
            <StatusLine status={nameStatus} />
          </Section>

          {/* Email */}
          <Section title="Email" hint="Used to sign in. Changing it requires confirming both your old and new address.">
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="flex-1 bg-huginn-surface text-white text-sm rounded-lg px-4 py-2.5 outline-none border border-huginn-border focus:border-huginn-accent"
              />
              <button
                onClick={handleSaveEmail}
                disabled={savingEmail || !email.trim() || email.trim().toLowerCase() === user?.email}
                className="bg-huginn-accent text-white text-sm font-semibold rounded-lg px-5 disabled:opacity-50"
              >
                {savingEmail ? '…' : 'Save'}
              </button>
            </div>
            <StatusLine status={emailStatus} />
          </Section>

          {/* Password */}
          <Section title="Password" hint="At least 6 characters.">
            <div className="space-y-2">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                className="w-full bg-huginn-surface text-white text-sm rounded-lg px-4 py-2.5 outline-none border border-huginn-border focus:border-huginn-accent"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full bg-huginn-surface text-white text-sm rounded-lg px-4 py-2.5 outline-none border border-huginn-border focus:border-huginn-accent"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleSavePassword}
                  disabled={savingPassword || !newPassword || !confirmPassword}
                  className="bg-huginn-accent text-white text-sm font-semibold rounded-lg px-5 py-2 disabled:opacity-50"
                >
                  {savingPassword ? '…' : 'Update password'}
                </button>
              </div>
            </div>
            <StatusLine status={passwordStatus} />
          </Section>

          {/* Account actions */}
          <Section title="Account">
            <button
              onClick={handleSignOut}
              className="text-sm text-huginn-text-secondary hover:text-white transition-colors py-2"
            >
              Sign out
            </button>
          </Section>
        </div>
      </div>
    </>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="bg-huginn-card rounded-xl p-5 border border-huginn-border/60">
      <h2 className="text-sm font-bold text-white mb-1">{title}</h2>
      {hint && <p className="text-xs text-huginn-text-muted mb-3">{hint}</p>}
      <div className={hint ? '' : 'mt-3'}>{children}</div>
    </section>
  )
}

function StatusLine({ status }: { status: Status }) {
  if (status.kind === 'idle') return null
  return (
    <p className={`text-xs mt-2 ${status.kind === 'success' ? 'text-huginn-success' : 'text-huginn-danger'}`}>
      {status.message}
    </p>
  )
}
