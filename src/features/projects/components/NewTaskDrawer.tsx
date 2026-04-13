import { useEffect, useState } from 'react'

interface NewTaskDrawerProps {
  onSave: (title: string) => Promise<void>
  onDone: () => void
}

export function NewTaskDrawer({ onSave, onDone }: NewTaskDrawerProps) {
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  function dismiss() {
    setVisible(false)
    setTimeout(onDone, 200)
  }

  async function handleSave() {
    const trimmed = title.trim()
    if (!trimmed || saving) return
    setSaving(true)
    await onSave(trimmed)
    setSaving(false)
    dismiss()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={dismiss}>
      <div
        className={`w-full bg-huginn-card rounded-t-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.3)] p-4 pb-[env(safe-area-inset-bottom,16px)] transition-transform duration-200 ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto mb-4" />
        <p className="text-sm text-gray-400 mb-3">New task</p>
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
          <button onClick={dismiss} className="flex-1 text-sm text-gray-400 py-2">Cancel</button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || saving}
            className="flex-1 bg-huginn-accent text-white text-sm font-semibold rounded-xl py-2 disabled:opacity-50 shadow-md shadow-huginn-accent/30"
          >
            {saving ? '...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
