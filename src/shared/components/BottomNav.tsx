import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Avatar } from './Avatar'
import { useAuth } from '../hooks/useAuth'
import { useProfile } from '../hooks/useProfile'
import { useInbox } from '../../features/inbox/hooks/useInbox'
import { useOverdueCount } from '../../features/agenda'

export function BottomNav() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const { user } = useAuth()
  const { profile } = useProfile()
  const { count: inboxCount } = useInbox()
  const overdueCount = useOverdueCount()

  const isToday = pathname.startsWith('/today')
  const isInbox = pathname.startsWith('/inbox')
  const isProjects = pathname.startsWith('/projects')
  const isSettings = pathname.startsWith('/settings')

  return (
    <nav className="flex items-stretch border-t border-huginn-border bg-huginn-base pb-[env(safe-area-inset-bottom,0px)]">
      <NavTab
        to="/today"
        active={isToday}
        label={t('bottomNav.today')}
        badge={overdueCount > 0 ? overdueCount : undefined}
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M6.75 2a.75.75 0 0 1 .75.75V4h9V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 21 6.75v12.5A2.75 2.75 0 0 1 18.25 22H5.75A2.75 2.75 0 0 1 3 19.25V6.75A2.75 2.75 0 0 1 5.75 4H6V2.75A.75.75 0 0 1 6.75 2ZM4.5 9.5v9.75c0 .69.56 1.25 1.25 1.25h12.5c.69 0 1.25-.56 1.25-1.25V9.5h-15Zm3.75 3a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5h-1.5Zm4.5 0a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5h-1.5Z" clipRule="evenodd" />
          </svg>
        }
      />
      <NavTab
        to="/inbox"
        active={isInbox}
        label={t('bottomNav.inbox')}
        badge={inboxCount > 0 ? inboxCount : undefined}
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M3.5 9.5a1 1 0 0 1 1-1h15a1 1 0 0 1 1 1v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-8Zm1.5 2v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6h-3.59a4 4 0 0 1-7.82 0H5Z" />
          </svg>
        }
      />
      <NavTab
        to="/projects"
        active={isProjects}
        label={t('bottomNav.projects')}
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M4 4a2 2 0 0 0-2 2v1h20V6a2 2 0 0 0-2-2h-6.18a2 2 0 0 1-1.41-.59l-.83-.82A2 2 0 0 0 10.18 2H4Zm-2 5v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9H2Z" />
          </svg>
        }
      />
      <Link
        to="/settings"
        className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 relative ${
          isSettings ? 'text-huginn-accent' : 'text-gray-500'
        }`}
        aria-label={t('bottomNav.settings')}
      >
        {isSettings && <span className="w-1 h-1 rounded-full bg-huginn-accent absolute top-1.5" />}
        <Avatar
          url={profile?.avatar_url}
          name={profile?.display_name}
          email={user?.email}
          size={22}
        />
        <span className="text-[10px] font-semibold">{t('bottomNav.you')}</span>
      </Link>
    </nav>
  )
}

function NavTab({ to, active, label, icon, badge }: {
  to: string
  active: boolean
  label: string
  icon: React.ReactNode
  badge?: number
}) {
  return (
    <Link
      to={to}
      className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 relative ${
        active ? 'text-huginn-accent' : 'text-gray-500'
      }`}
    >
      {active && <span className="w-1 h-1 rounded-full bg-huginn-accent absolute top-1.5" />}
      <div className="relative">
        {icon}
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1.5 -right-2.5 bg-huginn-accent text-white text-[9px] font-bold rounded-full min-w-[16px] h-[16px] px-1 flex items-center justify-center">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </div>
      <span className="text-[10px] font-semibold">{label}</span>
    </Link>
  )
}
