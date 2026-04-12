import type { Note } from '../../../shared/lib/types'
import { NoteCard } from './NoteCard'

interface NoteListProps {
  notes: Note[]
  loading: boolean
  onNoteTap: (note: Note) => void
}

export function NoteList({ notes, loading, onNoteTap }: NoteListProps) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    )
  }

  if (notes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500 text-sm">No notes yet. Tap + to create one.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2">
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} onClick={() => onNoteTap(note)} />
      ))}
    </div>
  )
}
