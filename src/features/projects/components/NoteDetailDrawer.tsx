import { useEffect, useRef, useState } from 'react'
import type { Note } from '../../../shared/lib/types'

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
  const [visible, setVisible] = useState(false)
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    return () => { if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current) }
  }, [])

  function dismiss() {
    setVisible(false)
    setTimeout(onDone, 200)
  }

  async function handleSave() {
    if (!body.trim() || saving) return
    setSaving(true)
    await onUpdate(note.id, { title: title.trim() || null, body: body.trim() })
    setSaving(false)
    dismiss()
  }

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      confirmTimerRef.current = setTimeout(() => setConfirmDelete(false), 3000)
      return
    }
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
    onDelete(note.id)
    dismiss()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={dismiss}>
      <div
        className={`w-full bg-[#2a2a4a] rounded-t-2xl p-4 pb-[env(safe-area-inset-bottom,16px)] transition-transform duration-200 max-h-[85vh] overflow-y-auto ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto mb-4" />
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          className="w-full bg-[#1a1a2e] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6c5ce7] placeholder-gray-500 mb-3"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your note..."
          rows={6}
          className="w-full bg-[#1a1a2e] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6c5ce7] placeholder-gray-500 resize-none mb-4"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={handleDelete}
            className={`text-sm py-2 px-3 rounded-xl transition-colors ${
              confirmDelete ? 'text-red-400 bg-red-400/10 font-semibold' : 'text-red-400'
            }`}
          >
            {confirmDelete ? 'Are you sure?' : 'Delete'}
          </button>
          <div className="flex-1" />
          <button
            onClick={handleSave}
            disabled={!body.trim() || saving}
            className="bg-[#6c5ce7] text-white text-sm font-semibold rounded-xl py-2 px-6 disabled:opacity-50"
          >
            {saving ? '...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
