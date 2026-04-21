import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { useProfile } from '../hooks/useProfile'
import { useAvatarUpload } from '../hooks/useAvatarUpload'
import { Avatar } from './Avatar'
import { LanguageToggle } from './LanguageToggle'
import { supabase } from '../lib/supabase'

type Status = { kind: 'idle' } | { kind: 'success'; message: string } | { kind: 'error'; message: string }

export function AccountSettings({ onSignOut }: { onSignOut?: () => void }) {
  const { t } = useTranslation()
  const { user, signOut } = useAuth()
  const { profile, updateProfile } = useProfile()
  const { upload, uploading, error: uploadError } = useAvatarUpload()
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

  useEffect(() => { if (profile?.display_name) setDisplayName(profile.display_name) }, [profile?.display_name])
  useEffect(() => { if (user?.email) setEmail(user.email) }, [user?.email])

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
    setNameStatus(ok ? { kind: 'success', message: t('settings.account.status.saved') } : { kind: 'error', message: t('settings.account.status.couldNotSaveName') })
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
      : { kind: 'success', message: t('settings.account.status.emailCheckInbox') })
    setSavingEmail(false)
  }

  async function handleSavePassword() {
    if (savingPassword) return
    if (newPassword.length < 6) {
      setPasswordStatus({ kind: 'error', message: t('auth.errors.passwordTooShort') })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ kind: 'error', message: t('auth.errors.passwordMismatch') })
      return
    }
    setSavingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPasswordStatus(error ? { kind: 'error', message: error.message } : { kind: 'success', message: t('settings.account.status.passwordUpdated') })
    if (!error) {
      setNewPassword('')
      setConfirmPassword('')
    }
    setSavingPassword(false)
  }

  async function handleSignOut() {
    await signOut()
    onSignOut?.()
  }

  return (
    <div className="space-y-4">
      {/* Avatar + identity */}
      <Section title={t('settings.account.sections.profile')}>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="relative group rounded-full"
            title={t('settings.account.avatar.changeTitle')}
          >
            <Avatar
              url={profile?.avatar_url}
              name={profile?.display_name}
              email={user?.email}
              size={72}
            />
            <span className="absolute inset-0 rounded-full bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] font-bold uppercase tracking-wider text-white">
              {uploading ? t('settings.account.avatar.uploading') : t('settings.account.avatar.change')}
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
            <p>{t('settings.account.avatar.instructionsLine1')}</p>
            <p>{t('settings.account.avatar.instructionsLine2')}</p>
            {uploadError && <p className="text-huginn-danger mt-1">{uploadError}</p>}
          </div>
        </div>
      </Section>

      {/* Display name */}
      <Section title={t('settings.account.sections.displayName')} hint={t('settings.account.sections.displayNameHint')}>
        <div className="flex gap-2">
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t('settings.account.fields.namePlaceholder')}
            className="flex-1 bg-huginn-surface text-white text-sm rounded-lg px-4 py-2.5 outline-none border border-huginn-border focus:border-huginn-accent"
          />
          <button
            onClick={handleSaveName}
            disabled={savingName || !displayName.trim() || displayName.trim() === profile?.display_name}
            className="bg-huginn-accent text-white text-sm font-semibold rounded-lg px-5 disabled:opacity-50"
          >
            {savingName ? t('settings.account.actions.saving') : t('settings.account.actions.save')}
          </button>
        </div>
        <StatusLine status={nameStatus} />
      </Section>

      {/* Email */}
      <Section title={t('settings.account.sections.email')} hint={t('settings.account.sections.emailHintDrawer')}>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('settings.account.fields.emailPlaceholder')}
            className="flex-1 bg-huginn-surface text-white text-sm rounded-lg px-4 py-2.5 outline-none border border-huginn-border focus:border-huginn-accent"
          />
          <button
            onClick={handleSaveEmail}
            disabled={savingEmail || !email.trim() || email.trim().toLowerCase() === user?.email}
            className="bg-huginn-accent text-white text-sm font-semibold rounded-lg px-5 disabled:opacity-50"
          >
            {savingEmail ? t('settings.account.actions.saving') : t('settings.account.actions.save')}
          </button>
        </div>
        <StatusLine status={emailStatus} />
      </Section>

      {/* Password */}
      <Section title={t('settings.account.sections.password')} hint={t('settings.account.sections.passwordHint')}>
        <div className="space-y-2">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={t('settings.account.fields.newPasswordPlaceholder')}
            className="w-full bg-huginn-surface text-white text-sm rounded-lg px-4 py-2.5 outline-none border border-huginn-border focus:border-huginn-accent"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t('settings.account.fields.confirmPasswordPlaceholder')}
            className="w-full bg-huginn-surface text-white text-sm rounded-lg px-4 py-2.5 outline-none border border-huginn-border focus:border-huginn-accent"
          />
          <div className="flex justify-end">
            <button
              onClick={handleSavePassword}
              disabled={savingPassword || !newPassword || !confirmPassword}
              className="bg-huginn-accent text-white text-sm font-semibold rounded-lg px-5 py-2 disabled:opacity-50"
            >
              {savingPassword ? t('settings.account.actions.saving') : t('settings.account.actions.updatePassword')}
            </button>
          </div>
        </div>
        <StatusLine status={passwordStatus} />
      </Section>

      {/* Language */}
      <Section title={t('settings.account.sections.language')} hint={t('settings.account.sections.languageHint')}>
        <LanguageToggle />
      </Section>

      {/* Account actions */}
      <Section title={t('settings.account.sections.account')}>
        <button
          onClick={handleSignOut}
          className="text-sm text-huginn-danger hover:text-white hover:bg-huginn-danger/15 transition-colors px-3 py-1.5 rounded-md"
        >
          {t('settings.account.actions.signOut')}
        </button>
      </Section>
    </div>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="bg-huginn-card rounded-xl p-4 border border-huginn-border/60">
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
