import { useEffect, useRef, useState } from 'react'

interface CardThreeDotMenuProps {
  onMove: () => void
  onCopy: () => void
  onArchive: () => void
  onDelete: () => void
  /** Hide Move / Archive for inbox cards — those belong to a different flow. */
  inboxMode?: boolean
}

export function CardThreeDotMenu({ onMove, onCopy, onArchive, onDelete, inboxMode }: CardThreeDotMenuProps) {
  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) }
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleEsc, { capture: true })
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleEsc, { capture: true } as EventListenerOptions)
    }
  }, [open])

  function handleDeleteClick() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      confirmTimerRef.current = setTimeout(() => setConfirmDelete(false), 3000)
      return
    }
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
    onDelete()
    setOpen(false)
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-9 h-9 flex items-center justify-center rounded-lg text-huginn-text-muted hover:text-white bg-huginn-surface/80 hover:bg-huginn-hover transition-colors"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
          <path d="M10 3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM10 8.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM11.5 15.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0Z" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1.5 z-50 w-48 bg-huginn-card border border-huginn-border rounded-lg shadow-2xl shadow-black/50 overflow-hidden py-1"
        >
          {!inboxMode && (
            <MenuItem
              onClick={() => { onMove(); setOpen(false) }}
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                  <path d="M10.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 1 1-1.06-1.06l2.97-2.97H1.75a.75.75 0 0 1 0-1.5h11.44l-2.97-2.97a.75.75 0 0 1 0-1.06Z" />
                </svg>
              }
              label="Move"
            />
          )}
          <MenuItem
            onClick={() => { onCopy(); setOpen(false) }}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                <path d="M5.5 3.5A1.5 1.5 0 0 1 7 2h5.5A1.5 1.5 0 0 1 14 3.5V10a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 10V3.5Z" />
                <path d="M3.5 5A.5.5 0 0 0 3 5.5v7a1.5 1.5 0 0 0 1.5 1.5h5a.5.5 0 0 0 0-1h-5a.5.5 0 0 1-.5-.5V5.5a.5.5 0 0 0-.5-.5Z" />
              </svg>
            }
            label="Copy card"
          />
          {!inboxMode && (
            <MenuItem
              onClick={() => { onArchive(); setOpen(false) }}
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                  <path d="M1.5 3A1.5 1.5 0 0 1 3 1.5h10A1.5 1.5 0 0 1 14.5 3v1A1.5 1.5 0 0 1 13 5.5H3A1.5 1.5 0 0 1 1.5 4V3Z" />
                  <path d="M2.5 7h11v5.5A1.5 1.5 0 0 1 12 14H4a1.5 1.5 0 0 1-1.5-1.5V7Zm3 2a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5Z" />
                </svg>
              }
              label="Archive"
            />
          )}
          <div className="my-1 border-t border-huginn-border/60" />
          <button
            type="button"
            role="menuitem"
            onClick={handleDeleteClick}
            className={`w-full flex items-center gap-2.5 text-left text-sm px-3 py-2 transition-colors ${
              confirmDelete
                ? 'text-huginn-danger bg-huginn-danger/10 font-semibold'
                : 'text-huginn-text-primary hover:bg-huginn-hover'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-huginn-danger">
              <path d="M6 2a1 1 0 0 0-.894.553L4.382 4H2a.5.5 0 0 0 0 1h.522l.615 7.379A2 2 0 0 0 5.124 14h5.752a2 2 0 0 0 1.988-1.621L13.478 5H14a.5.5 0 0 0 0-1h-2.382l-.724-1.447A1 1 0 0 0 10 2H6Z" />
            </svg>
            {confirmDelete ? 'Click again to delete' : 'Delete card'}
          </button>
        </div>
      )}
    </div>
  )
}

function MenuItem({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 text-left text-sm text-huginn-text-primary hover:bg-huginn-hover px-3 py-2 transition-colors"
    >
      <span className="text-huginn-text-secondary">{icon}</span>
      {label}
    </button>
  )
}
