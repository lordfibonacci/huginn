import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Avatar } from './Avatar'
import { useAuth } from '../hooks/useAuth'
import { useProfile } from '../hooks/useProfile'
import { useLanguagePreference } from '../hooks/useLanguagePreference'
import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES } from '../i18n'

interface AccountMenuProps {
  size?: number
  align?: 'left' | 'right'
  position?: 'top' | 'bottom'
}

export function AccountMenu({ size = 26, align = 'right', position = 'top' }: AccountMenuProps) {
  const { t } = useTranslation()
  const { user, signOut } = useAuth()
  const { profile } = useProfile()
  const { language, setLanguage } = useLanguagePreference()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    function handleOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [open])

  async function handleSignOut() {
    setOpen(false)
    await signOut()
    navigate('/login')
  }

  const popoverPosition = position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
  const popoverAlign = align === 'right' ? 'right-0' : 'left-0'

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-full p-0.5 hover:bg-huginn-hover transition-colors"
        title={t('account.menu.account')}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar
          url={profile?.avatar_url}
          name={profile?.display_name}
          email={user?.email}
          size={size}
        />
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute ${popoverPosition} ${popoverAlign} z-50 w-64 bg-huginn-card border border-huginn-border rounded-xl shadow-2xl shadow-black/50 overflow-hidden`}
        >
          <div className="flex items-center gap-3 p-3 border-b border-huginn-border/60">
            <Avatar
              url={profile?.avatar_url}
              name={profile?.display_name}
              email={user?.email}
              size={40}
            />
            <div className="min-w-0">
              {profile?.display_name && (
                <p className="text-sm font-bold text-white truncate">{profile.display_name}</p>
              )}
              <p className={`text-xs truncate ${profile?.display_name ? 'text-huginn-text-muted' : 'text-white font-semibold'}`}>
                {user?.email}
              </p>
            </div>
          </div>

          <div className="p-1">
            <Link
              to="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 w-full text-left text-sm text-huginn-text-primary hover:bg-huginn-hover rounded-md px-2.5 py-2 transition-colors"
              role="menuitem"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-huginn-text-secondary">
                <path fillRule="evenodd" d="M8.34 1.804A1 1 0 0 1 9.32 1h1.36a1 1 0 0 1 .98.804l.295 1.473c.497.144.971.342 1.416.587l1.25-.834a1 1 0 0 1 1.262.125l.962.962a1 1 0 0 1 .125 1.262l-.834 1.25c.245.445.443.919.587 1.416l1.473.294a1 1 0 0 1 .804.98v1.362a1 1 0 0 1-.804.98l-1.473.295a6.95 6.95 0 0 1-.587 1.416l.834 1.25a1 1 0 0 1-.125 1.262l-.962.962a1 1 0 0 1-1.262.125l-1.25-.834a6.953 6.953 0 0 1-1.416.587l-.294 1.473a1 1 0 0 1-.98.804H9.32a1 1 0 0 1-.98-.804l-.295-1.473a6.957 6.957 0 0 1-1.416-.587l-1.25.834a1 1 0 0 1-1.262-.125l-.962-.962a1 1 0 0 1-.125-1.262l.834-1.25a6.957 6.957 0 0 1-.587-1.416l-1.473-.294A1 1 0 0 1 1 11.36V9.998a1 1 0 0 1 .804-.98l1.473-.295c.144-.497.342-.971.587-1.416l-.834-1.25a1 1 0 0 1 .125-1.262l.962-.962A1 1 0 0 1 5.38 3.708l1.25.834a6.957 6.957 0 0 1 1.416-.587l.294-1.473ZM13 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" clipRule="evenodd" />
              </svg>
              {t('account.menu.settings')}
            </Link>

            <div className="my-1 h-px bg-huginn-border/60" />

            <div className="px-2.5 py-1.5 text-[10px] uppercase tracking-wider text-huginn-text-muted">
              {t('account.menu.language')}
            </div>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`flex items-center justify-between w-full text-left text-sm rounded-md px-2.5 py-1.5 transition-colors ${
                  language === lang
                    ? 'bg-huginn-accent-soft text-white'
                    : 'text-huginn-text-primary hover:bg-huginn-hover'
                }`}
                role="menuitemradio"
                aria-checked={language === lang}
              >
                {LANGUAGE_LABELS[lang]}
                {language === lang && (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-huginn-accent">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}

            <div className="my-1 h-px bg-huginn-border/60" />

            <button
              onClick={handleSignOut}
              className="flex items-center gap-2.5 w-full text-left text-sm text-huginn-text-primary hover:bg-huginn-hover rounded-md px-2.5 py-2 transition-colors"
              role="menuitem"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-huginn-text-secondary">
                <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z" clipRule="evenodd" />
                <path fillRule="evenodd" d="M19 10a.75.75 0 0 0-.22-.53l-2.75-2.75a.75.75 0 0 0-1.06 1.06l1.47 1.47H8.75a.75.75 0 0 0 0 1.5h7.69l-1.47 1.47a.75.75 0 1 0 1.06 1.06l2.75-2.75A.75.75 0 0 0 19 10Z" clipRule="evenodd" />
              </svg>
              {t('account.menu.signOut')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
