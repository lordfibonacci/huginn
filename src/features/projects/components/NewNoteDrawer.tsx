import { useRef, useState } from 'react'
import { ModalShell } from '../../../shared/components/ModalShell'

interface NewNoteDrawerProps {
  onSave: (title: string | null, body: string) => Promise<void>
  onDone: () => void
}

export function NewNoteDrawer({ onSave, onDone }: NewNoteDrawerProps) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  async function handleSave() {
    const trimmedBody = body.trim()
    if (!trimmedBody || saving) return
    setSaving(true)
    await onSave(title.trim() || null, trimmedBody)
    setSaving(false)
    onDone()
  }

  return (
    <ModalShell onDismiss={onDone} title="New note">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (optional)"
        autoFocus
        className="w-full bg-huginn-surface text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-huginn-accent placeholder-gray-500 mb-3 border border-huginn-border focus:border-huginn-accent"
      />
      <textarea
        ref={bodyRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your note..."
        rows={4}
        className="w-full bg-huginn-surface text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-huginn-accent placeholder-gray-500 resize-none mb-4 border border-huginn-border focus:border-huginn-accent"
      />
      <div className="flex gap-2">
        <button onClick={onDone} className="flex-1 text-sm text-gray-400 py-2">Cancel</button>
        <button
          onClick={handleSave}
          disabled={!body.trim() || saving}
          className="flex-1 bg-huginn-accent text-white text-sm font-semibold rounded-xl py-2 disabled:opacity-50 shadow-md shadow-huginn-accent/30"
        >
          {saving ? '...' : 'Save'}
        </button>
      </div>
    </ModalShell>
  )
}
