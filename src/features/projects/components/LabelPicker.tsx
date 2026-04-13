import { useState } from 'react'
import type { Label } from '../../../shared/lib/types'

const LABEL_COLORS = [
  '#6c5ce7', '#00b894', '#fdcb6e', '#e17055',
  '#0984e3', '#e84393', '#636e72', '#00cec9',
]

interface LabelPickerProps {
  labels: Label[]
  activeLabelIds: string[]
  onToggle: (labelId: string) => void
  onCreate: (name: string, color: string) => Promise<unknown>
  onClose: () => void
}

export function LabelPicker({ labels, activeLabelIds, onToggle, onCreate, onClose }: LabelPickerProps) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(LABEL_COLORS[0])

  async function handleCreate() {
    const trimmed = newName.trim()
    if (!trimmed) return
    await onCreate(trimmed, newColor)
    setNewName('')
    setCreating(false)
  }

  return (
    <div className="absolute top-full left-0 mt-1 z-50 w-64 bg-huginn-card border border-huginn-border rounded-lg shadow-xl p-3" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-huginn-text-secondary">Labels</p>
        <button onClick={onClose} className="text-huginn-text-muted hover:text-white">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L6.94 8l-1.72 1.72a.75.75 0 1 0 1.06 1.06L8 9.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L9.06 8l1.72-1.72a.75.75 0 0 0-1.06-1.06L8 6.94 6.28 5.22Z" />
          </svg>
        </button>
      </div>

      {/* Existing labels */}
      <div className="space-y-1 mb-2">
        {labels.map((label) => {
          const isActive = activeLabelIds.includes(label.id)
          return (
            <button
              key={label.id}
              onClick={() => onToggle(label.id)}
              className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs transition-colors ${
                isActive ? 'bg-huginn-surface ring-1 ring-huginn-accent' : 'hover:bg-huginn-surface'
              }`}
            >
              <div className="w-4 h-4 rounded" style={{ backgroundColor: label.color }} />
              <span className="flex-1 text-left text-huginn-text-primary">{label.name}</span>
              {isActive && (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 text-huginn-accent">
                  <path fillRule="evenodd" d="M12.4 4.7a.75.75 0 0 1 .1 1.06l-5.25 6a.75.75 0 0 1-1.1.02L3.6 9.1a.75.75 0 1 1 1.1-1.02l2.05 2.22 4.7-5.37a.75.75 0 0 1 1.06-.1l-.1-.13Z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          )
        })}
        {labels.length === 0 && !creating && (
          <p className="text-xs text-huginn-text-muted py-2 text-center">No labels yet</p>
        )}
      </div>

      {/* Create new */}
      {creating ? (
        <div className="border-t border-huginn-border pt-2 mt-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Label name"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false) }}
            className="w-full bg-huginn-surface text-sm text-huginn-text-primary rounded px-2 py-1.5 outline-none border border-huginn-border focus:border-huginn-accent mb-2 placeholder-huginn-text-muted"
          />
          <div className="flex gap-1.5 mb-2">
            {LABEL_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className={`w-5 h-5 rounded-full ${newColor === c ? 'ring-2 ring-white ring-offset-1 ring-offset-huginn-card' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setCreating(false)} className="text-xs text-huginn-text-muted">Cancel</button>
            <button onClick={handleCreate} disabled={!newName.trim()} className="text-xs text-huginn-accent font-semibold disabled:opacity-50">Create</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 text-xs text-huginn-text-muted hover:text-huginn-accent w-full px-2 py-1.5 border-t border-huginn-border mt-1 pt-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
            <path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2Z" />
          </svg>
          Create new label
        </button>
      )}
    </div>
  )
}
