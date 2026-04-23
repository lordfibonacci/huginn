import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Mark, Wordmark } from './Logo'
import { Avatar } from './Avatar'
import { LanguageToggle } from './LanguageToggle'
import { useAuth } from '../hooks/useAuth'
import { useProfile } from '../hooks/useProfile'
import { useCommandPalette } from '../hooks/useCommandPalette'
import { useOverdueCount } from '../../features/agenda'

// Desktop-only app chrome: brand left, nav right. Mobile uses BottomNav.
// Lives at the top of Layout so every protected route shares it.
export function GlobalTopBar() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const { user } = useAuth()
  const { profile } = useProfile()
  const { open: openPalette } = useCommandPalette()
  const overdueCount = useOverdueCount()

  const links = [
    { to: '/today', label: t('nav.today'), badge: overdueCount > 0 ? overdueCount : undefined, active: pathname.startsWith('/today') },
    { to: '/inbox', label: t('nav.inbox'), active: pathname.startsWith('/inbox') },
    { to: '/projects', label: t('nav.projects'), active: pathname.startsWith('/projects') },
    { to: '/calendar', label: t('nav.calendar'), active: pathname.startsWith('/calendar') },
  ]

  return (
    <div className="hidden md:flex items-center justify-between gap-4 px-6 py-2 border-b border-huginn-border bg-huginn-base/60 backdrop-blur-sm shrink-0">
      <Link to="/projects" className="flex items-center gap-2.5 group shrink-0">
        <Mark size={24} />
        <Wordmark height={16} />
      </Link>

      <div className="flex items-center gap-1">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
              l.active
                ? 'bg-huginn-accent/15 text-huginn-accent'
                : 'text-huginn-text-muted hover:text-white hover:bg-huginn-hover'
            }`}
          >
            {l.label}
            {l.badge !== undefined && l.badge > 0 && (
              <span className="bg-huginn-danger text-white text-[9px] font-bold rounded-full min-w-[16px] h-[16px] px-1 flex items-center justify-center">
                {l.badge > 99 ? '99+' : l.badge}
              </span>
            )}
          </Link>
        ))}

        <div className="w-px h-5 bg-huginn-border mx-1.5" aria-hidden />

        <button
          onClick={openPalette}
          className="flex items-center gap-1.5 text-xs font-medium pl-2.5 pr-1.5 py-1.5 rounded-full text-huginn-text-muted hover:text-white hover:bg-huginn-hover transition-colors"
          title={t('toolbar.commandPalette')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 3.36 9.85l3.4 3.4a.75.75 0 0 0 1.06-1.06l-3.4-3.4A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z" clipRule="evenodd" />
          </svg>
          <kbd className="text-[10px] font-semibold bg-huginn-surface border border-huginn-border rounded px-1.5 py-0.5">⌘K</kbd>
        </button>

        <LanguageToggle className="scale-90 -mx-0.5" />

        <Link
          to="/settings"
          className="ml-1.5 flex items-center gap-2 rounded-full pl-2 pr-1 py-1 hover:bg-huginn-hover transition-colors group"
          title={t('projects.header.accountSettings')}
        >
          <span className="text-xs text-huginn-text-muted group-hover:text-white hidden lg:inline">
            {profile?.display_name || user?.email}
          </span>
          <Avatar
            url={profile?.avatar_url}
            name={profile?.display_name}
            email={user?.email}
            size={24}
          />
        </Link>
      </div>
    </div>
  )
}
