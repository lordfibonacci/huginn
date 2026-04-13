import type { Note } from '../../../shared/lib/types'
import { timeAgo } from '../../../shared/lib/dateUtils'

interface NoteCardProps {
  note: Note
  onClick?: () => void
}

export function NoteCard({ note, onClick }: NoteCardProps) {
  const displayTitle = note.title || note.body.slice(0, 50) + (note.body.length > 50 ? '...' : '')

  return (
    <div
      className="bg-huginn-card rounded-xl p-4 mb-2.5 cursor-pointer active:bg-huginn-hover hover:bg-huginn-hover border-l-[3px] border-transparent hover:border-huginn-accent transition-all"
      onClick={onClick}
    >
      <p className="text-sm text-huginn-text-primary font-medium">{displayTitle}</p>
      <p className="text-xs text-huginn-text-secondary mt-1.5">{timeAgo(note.created_at)}</p>
    </div>
  )
}
