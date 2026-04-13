import { useState } from 'react'
import { ModalShell } from '../../../shared/components/ModalShell'

interface NewTaskDrawerProps {
  onSave: (title: string) => Promise<void>
  onDone: () => void
}

export function NewTaskDrawer({ onSave, onDone }: NewTaskDrawerProps) {
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const trimmed = title.trim()
    if (!trimmed || saving) return
    setSaving(true)
    await onSave(trimmed)
    setSaving(false)
    onDone()
  }

  return (
    <ModalShell onDismiss={onDone} title="New task">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title"
        autoFocus
        onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
        className="w-full bg-huginn-surface text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-huginn-accent placeholder-gray-500 mb-4 border border-huginn-border focus:border-huginn-accent"
      />
      <div className="flex gap-2">
        <button onClick={onDone} className="flex-1 text-sm text-gray-400 py-2">Cancel</button>
        <button
          onClick={handleSave}
          disabled={!title.trim() || saving}
          className="flex-1 bg-huginn-accent text-white text-sm font-semibold rounded-xl py-2 disabled:opacity-50 shadow-md shadow-huginn-accent/30"
        >
          {saving ? '...' : 'Save'}
        </button>
      </div>
    </ModalShell>
  )
}
