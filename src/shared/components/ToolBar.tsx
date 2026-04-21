import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Mark } from './Logo'
import { Avatar } from './Avatar'
import { AccountSettingsDrawer } from './AccountSettingsDrawer'
import { useAuth } from '../hooks/useAuth'
import { useProfile } from '../hooks/useProfile'
import { useProjects } from '../../features/projects/hooks/useProjects'
import { ProjectGlyph } from '../../features/projects/components/ProjectGlyph'

interface ToolBarProps {
  inboxOpen: boolean
  inboxCount: number
  onToggleInbox: () => void
  currentProjectId?: string
}

export function ToolBar({ inboxOpen, inboxCount, onToggleInbox, currentProjectId }: ToolBarProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { profile } = useProfile()
  const { projects } = useProjects()
  const [showAccount, setShowAccount] = useState(false)
  const [showSwitcher, setShowSwitcher] = useState(false)
  const switcherRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // Close switcher on outside click / Escape
  useEffect(() => {
    if (!showSwitcher) return
    function handleClick(e: MouseEvent) {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setShowSwitcher(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowSwitcher(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [showSwitcher])

  function handlePick(projectId: string) {
    setShowSwitcher(false)
    navigate(`/projects/${projectId}`)
  }

  function handleViewAll() {
    setShowSwitcher(false)
    navigate('/projects')
  }

  return (
    <>
      <div className="hidden md:flex fixed bottom-4 left-1/2 -translate-x-1/2 z-30 items-center gap-1 py-1.5 pl-2 pr-2 bg-huginn-base/95 backdrop-blur-md border border-huginn-border rounded-full shadow-xl shadow-black/40">
        <div className="flex items-center pl-1 pr-2">
          <Mark size={22} />
        </div>

        <div className="w-px h-5 bg-huginn-border mr-1" aria-hidden />

        {/* Inbox toggle */}
        <button
          onClick={onToggleInbox}
          className={`flex items-center gap-2 text-sm font-medium px-3.5 py-1.5 rounded-full transition-colors ${
            inboxOpen
              ? 'bg-huginn-accent text-white'
              : 'text-huginn-text-secondary hover:text-white hover:bg-huginn-hover'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M3.5 9.5a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v6a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-6Zm1 2v4a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-4h-3.09a3 3 0 0 1-5.82 0H4.5Z" />
          </svg>
          {t('toolbar.inbox')}
          {inboxCount > 0 && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
              inboxOpen ? 'bg-white/20' : 'bg-huginn-accent text-white'
            }`}>
              {inboxCount}
            </span>
          )}
        </button>

        {/* Switch Projects */}
        <div className="relative" ref={switcherRef}>
          <button
            onClick={() => setShowSwitcher(o => !o)}
            className={`flex items-center gap-2 text-sm font-medium px-3.5 py-1.5 rounded-full transition-colors ${
              showSwitcher ? 'bg-huginn-hover text-white' : 'text-huginn-text-secondary hover:text-white hover:bg-huginn-hover'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H4.28a.75.75 0 0 0-.75.75v3.955a.75.75 0 0 0 1.5 0v-2.174l.307.306a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.437-.354Zm-9.624-2.848a.75.75 0 0 0 1.437.354A5.5 5.5 0 0 1 16.2 11.39l.312.311h-2.433a.75.75 0 0 0 0 1.5H18.03a.75.75 0 0 0 .75-.75V8.495a.75.75 0 0 0-1.5 0v2.174l-.307-.306A7 7 0 0 0 5.261 13.5a.75.75 0 0 0 .427-1.424Z" />
            </svg>
            {t('toolbar.switchProjects')}
          </button>

          {showSwitcher && (
            <div className="absolute bottom-full right-0 mb-2 w-72 bg-huginn-card border border-huginn-border rounded-xl shadow-2xl overflow-hidden">
              <div className="px-4 pt-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-huginn-text-secondary">
                {t('toolbar.yourProjects')}
              </div>
              <div className="max-h-80 overflow-y-auto px-2 pb-2">
                {projects.length === 0 && (
                  <p className="text-xs text-huginn-text-muted px-2 py-3 text-center">{t('toolbar.noProjects')}</p>
                )}
                {projects.map((p) => {
                  const isCurrent = p.id === currentProjectId
                  return (
                    <button
                      key={p.id}
                      onClick={() => handlePick(p.id)}
                      className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left transition-colors ${
                        isCurrent
                          ? 'bg-huginn-accent/15 text-huginn-text-primary'
                          : 'text-huginn-text-primary hover:bg-huginn-hover'
                      }`}
                    >
                      <ProjectGlyph color={p.color} size={24} />
                      <span className="flex-1 text-sm truncate">{p.name}</span>
                      {isCurrent && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-huginn-accent">{t('toolbar.current')}</span>
                      )}
                    </button>
                  )
                })}
              </div>
              <button
                onClick={handleViewAll}
                className="w-full border-t border-huginn-border text-sm font-semibold text-huginn-accent hover:bg-huginn-hover py-2.5 transition-colors"
              >
                {t('toolbar.viewAllProjects')}
              </button>
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-huginn-border mx-1" aria-hidden />

        <button
          onClick={() => setShowAccount(true)}
          className="rounded-full p-0.5 hover:bg-huginn-hover transition-colors"
          title={t('toolbar.accountSettings')}
        >
          <Avatar
            url={profile?.avatar_url}
            name={profile?.display_name}
            email={user?.email}
            size={26}
          />
        </button>
      </div>

      {showAccount && <AccountSettingsDrawer onDone={() => setShowAccount(false)} />}
    </>
  )
}
