import { useState } from 'react'
import { Mark } from './Logo'
import { Avatar } from './Avatar'
import { AccountSettingsDrawer } from './AccountSettingsDrawer'
import { useAuth } from '../hooks/useAuth'
import { useProfile } from '../hooks/useProfile'

interface ToolBarProps {
  inboxOpen: boolean
  inboxCount: number
  onToggleInbox: () => void
  onSwitchProjects: () => void
}

export function ToolBar({ inboxOpen, inboxCount, onToggleInbox, onSwitchProjects }: ToolBarProps) {
  const { user } = useAuth()
  const { profile } = useProfile()
  const [showAccount, setShowAccount] = useState(false)

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
          Inbox
          {inboxCount > 0 && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
              inboxOpen ? 'bg-white/20' : 'bg-huginn-accent text-white'
            }`}>
              {inboxCount}
            </span>
          )}
        </button>

        {/* Board indicator */}
        <div className="flex items-center gap-2 text-sm font-medium px-3.5 py-1.5 text-huginn-text-muted">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M2 4.5A2.5 2.5 0 0 1 4.5 2h11A2.5 2.5 0 0 1 18 4.5v2a.5.5 0 0 1-.5.5h-15a.5.5 0 0 1-.5-.5v-2ZM2.5 8h15a.5.5 0 0 1 .5.5v7A2.5 2.5 0 0 1 15.5 18h-11A2.5 2.5 0 0 1 2 15.5v-7a.5.5 0 0 1 .5-.5Z" />
          </svg>
          Board
        </div>

        {/* Switch Projects */}
        <button
          onClick={onSwitchProjects}
          className="flex items-center gap-2 text-sm font-medium px-3.5 py-1.5 rounded-full text-huginn-text-secondary hover:text-white hover:bg-huginn-hover transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H4.28a.75.75 0 0 0-.75.75v3.955a.75.75 0 0 0 1.5 0v-2.174l.307.306a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.437-.354Zm-9.624-2.848a.75.75 0 0 0 1.437.354A5.5 5.5 0 0 1 16.2 11.39l.312.311h-2.433a.75.75 0 0 0 0 1.5H18.03a.75.75 0 0 0 .75-.75V8.495a.75.75 0 0 0-1.5 0v2.174l-.307-.306A7 7 0 0 0 5.261 13.5a.75.75 0 0 0 .427-1.424Z" />
          </svg>
          Switch boards
        </button>

        <div className="w-px h-5 bg-huginn-border mx-1" aria-hidden />

        <button
          onClick={() => setShowAccount(true)}
          className="rounded-full p-0.5 hover:bg-huginn-hover transition-colors"
          title="Account settings"
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
