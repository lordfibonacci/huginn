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
      className="bg-[#2a2a4a] rounded-xl p-3 mb-2 cursor-pointer active:bg-[#3a3a5a] transition-colors"
      onClick={onClick}
    >
      <p className="text-sm text-gray-100">{displayTitle}</p>
      <p className="text-xs text-gray-500 mt-1.5">{timeAgo(note.created_at)}</p>
    </div>
  )
}
