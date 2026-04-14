interface ToolBarProps {
  inboxOpen: boolean
  inboxCount: number
  onToggleInbox: () => void
  onSwitchProjects: () => void
  projectName?: string
}

export function ToolBar({ inboxOpen, inboxCount, onToggleInbox, onSwitchProjects, projectName }: ToolBarProps) {
  return (
    <div className="hidden md:flex items-center justify-center gap-1 py-2 px-4 border-t border-huginn-border bg-huginn-base">
      {/* Inbox toggle */}
      <button
        onClick={onToggleInbox}
        className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
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
      <div className="flex items-center gap-2 text-sm font-medium px-4 py-2 text-huginn-text-muted">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path d="M2 4.5A2.5 2.5 0 0 1 4.5 2h11A2.5 2.5 0 0 1 18 4.5v2a.5.5 0 0 1-.5.5h-15a.5.5 0 0 1-.5-.5v-2ZM2.5 8h15a.5.5 0 0 1 .5.5v7A2.5 2.5 0 0 1 15.5 18h-11A2.5 2.5 0 0 1 2 15.5v-7a.5.5 0 0 1 .5-.5Z" />
        </svg>
        Board
      </div>

      {/* Switch Projects */}
      <button
        onClick={onSwitchProjects}
        className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg text-huginn-text-secondary hover:text-white hover:bg-huginn-hover transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H4.28a.75.75 0 0 0-.75.75v3.955a.75.75 0 0 0 1.5 0v-2.174l.307.306a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.437-.354Zm-9.624-2.848a.75.75 0 0 0 1.437.354A5.5 5.5 0 0 1 16.2 11.39l.312.311h-2.433a.75.75 0 0 0 0 1.5H18.03a.75.75 0 0 0 .75-.75V8.495a.75.75 0 0 0-1.5 0v2.174l-.307-.306A7 7 0 0 0 5.261 13.5a.75.75 0 0 0 .427-1.424Z" />
        </svg>
        Switch boards
      </button>
    </div>
  )
}
