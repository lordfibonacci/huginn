import { useState } from 'react'

interface ChecklistSectionProps {
  items: { id: string; text: string; checked: boolean }[]
  checkedCount: number
  totalCount: number
  onAdd: (text: string) => Promise<unknown>
  onToggle: (itemId: string) => Promise<void>
  onUpdateText: (itemId: string, text: string) => Promise<void>
  onDelete: (itemId: string) => Promise<void>
}

export function ChecklistSection({ items, checkedCount, totalCount, onAdd, onToggle, onUpdateText, onDelete }: ChecklistSectionProps) {
  const [newText, setNewText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const progress = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0

  async function handleAdd() {
    const trimmed = newText.trim()
    if (!trimmed) return
    await onAdd(trimmed)
    setNewText('')
  }

  function startEdit(item: { id: string; text: string }) {
    setEditingId(item.id)
    setEditText(item.text)
  }

  function saveEdit() {
    if (editingId && editText.trim()) {
      onUpdateText(editingId, editText.trim())
    }
    setEditingId(null)
    setEditText('')
  }

  return (
    <div>
      {/* Header + progress */}
      <div className="flex items-center gap-3 mb-3">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-huginn-text-muted shrink-0">
          <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.58l7.3-7.3a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
        </svg>
        <p className="text-xs text-huginn-text-muted font-semibold flex-1">
          Checklist
          {totalCount > 0 && <span className="ml-1.5 text-huginn-text-secondary">{checkedCount}/{totalCount}</span>}
        </p>
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="h-1.5 bg-huginn-surface rounded-full mb-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${progress === 100 ? 'bg-huginn-success' : 'bg-huginn-accent'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Items */}
      <div className="space-y-1">
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-2.5 group py-1 px-1 rounded hover:bg-huginn-surface/50 -mx-1">
            <button
              onClick={() => onToggle(item.id)}
              className={`w-4 h-4 rounded border mt-0.5 shrink-0 flex items-center justify-center transition-colors ${
                item.checked
                  ? 'bg-huginn-success border-huginn-success text-white'
                  : 'border-huginn-text-muted'
              }`}
            >
              {item.checked && (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                  <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.58l7.3-7.3a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
                </svg>
              )}
            </button>
            {editingId === item.id ? (
              <input
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={saveEdit}
                onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null) }}
                autoFocus
                className="flex-1 bg-huginn-surface text-sm text-huginn-text-primary rounded px-2 py-0.5 outline-none border border-huginn-border focus:border-huginn-accent"
              />
            ) : (
              <span
                onClick={() => startEdit(item)}
                className={`flex-1 text-sm cursor-text ${item.checked ? 'text-huginn-text-muted line-through' : 'text-huginn-text-primary'}`}
              >
                {item.text}
              </span>
            )}
            <button
              onClick={() => onDelete(item.id)}
              className="text-huginn-text-muted hover:text-huginn-danger opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L6.94 8l-1.72 1.72a.75.75 0 1 0 1.06 1.06L8 9.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L9.06 8l1.72-1.72a.75.75 0 0 0-1.06-1.06L8 6.94 6.28 5.22Z" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Add item */}
      <div className="flex items-center gap-2 mt-2">
        <input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
          placeholder="Add an item..."
          className="flex-1 bg-transparent text-sm text-huginn-text-primary outline-none placeholder-huginn-text-muted border-b border-transparent focus:border-huginn-border py-1"
        />
        {newText.trim() && (
          <button
            onClick={handleAdd}
            className="text-xs text-huginn-accent font-semibold hover:text-white transition-colors"
          >
            Add
          </button>
        )}
      </div>
    </div>
  )
}
