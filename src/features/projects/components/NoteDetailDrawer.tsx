import { useRef, useState } from 'react'
import type { Note } from '../../../shared/lib/types'
import { ModalShell } from '../../../shared/components/ModalShell'

interface NoteDetailDrawerProps {
  note: Note
  onUpdate: (id: string, updates: { title?: string | null; body?: string }) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
  onDone: () => void
}

export function NoteDetailDrawer({ note, onUpdate, onDelete, onDone }: NoteDetailDrawerProps) {
  const [title, setTitle] = useState(note.title ?? '')
  const [body, setBody] = useState(note.body)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function handleSave() {
    if (!body.trim() || saving) return
    setSaving(true)
    await onUpdate(note.id, { title: title.trim() || null, body: body.trim() })
    setSaving(false)
    onDone()
  }

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      confirmTimerRef.current = setTimeout(() => setConfirmDelete(false), 3000)
      return
    }
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
    onDelete(note.id)
    onDone()
  }

  return (
    <ModalShell onDismiss={onDone}>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (optional)"
        className="w-full bg-huginn-surface text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-huginn-accent placeholder-gray-500 mb-3 border border-huginn-border focus:border-huginn-accent"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your note..."
        rows={6}
        className="w-full bg-huginn-surface text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-huginn-accent placeholder-gray-500 resize-none mb-4 border border-huginn-border focus:border-huginn-accent"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={handleDelete}
          className={`text-sm py-2 px-3 rounded-xl transition-colors ${
            confirmDelete ? 'text-red-400 bg-huginn-danger/10 font-semibold' : 'text-red-400 hover:bg-huginn-danger/10'
          }`}
        >
          {confirmDelete ? 'Are you sure?' : 'Delete'}
        </button>
        <div className="flex-1" />
        <button
          onClick={handleSave}
          disabled={!body.trim() || saving}
          className="bg-huginn-accent text-white text-sm font-semibold rounded-xl py-2 px-6 disabled:opacity-50 shadow-md shadow-huginn-accent/30"
        >
          {saving ? '...' : 'Save'}
        </button>
      </div>
    </ModalShell>
  )
}
