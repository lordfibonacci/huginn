import { useState } from 'react'
import type { ChecklistItem } from '../../../shared/lib/types'

interface ChecklistData {
  id: string
  name: string
  items: ChecklistItem[]
}

interface MultiChecklistSectionProps {
  checklists: ChecklistData[]
  onAddChecklist?: (name: string) => Promise<unknown>
  onDeleteChecklist: (checklistId: string) => void
  onRenameChecklist: (checklistId: string, name: string) => void
  onAddItem: (checklistId: string, text: string) => Promise<unknown>
  onToggleItem: (itemId: string) => Promise<void>
  onUpdateItemText: (itemId: string, text: string) => Promise<void>
  onDeleteItem: (itemId: string) => Promise<void>
}

export function ChecklistSection({ checklists, onDeleteChecklist, onRenameChecklist, onAddItem, onToggleItem, onUpdateItemText, onDeleteItem }: MultiChecklistSectionProps) {
  return (
    <div className="space-y-4">
      {checklists.map((checklist) => (
        <SingleChecklist
          key={checklist.id}
          checklist={checklist}
          onDelete={() => onDeleteChecklist(checklist.id)}
          onRename={(name) => onRenameChecklist(checklist.id, name)}
          onAddItem={(text) => onAddItem(checklist.id, text)}
          onToggleItem={onToggleItem}
          onUpdateItemText={onUpdateItemText}
          onDeleteItem={onDeleteItem}
        />
      ))}
    </div>
  )
}

function SingleChecklist({ checklist, onDelete, onRename, onAddItem, onToggleItem, onUpdateItemText, onDeleteItem }: {
  checklist: ChecklistData
  onDelete: () => void
  onRename: (name: string) => void
  onAddItem: (text: string) => Promise<unknown>
  onToggleItem: (itemId: string) => Promise<void>
  onUpdateItemText: (itemId: string, text: string) => Promise<void>
  onDeleteItem: (itemId: string) => Promise<void>
}) {
  const [newText, setNewText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameText, setNameText] = useState(checklist.name)
  const [showMenu, setShowMenu] = useState(false)

  const checkedCount = checklist.items.filter(i => i.checked).length
  const totalCount = checklist.items.length
  const progress = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0

  async function handleAddItem() {
    const trimmed = newText.trim()
    if (!trimmed) return
    await onAddItem(trimmed)
    setNewText('')
  }

  function startEditItem(item: ChecklistItem) {
    setEditingId(item.id)
    setEditText(item.text)
  }

  function saveEditItem() {
    if (editingId && editText.trim()) {
      onUpdateItemText(editingId, editText.trim())
    }
    setEditingId(null)
  }

  function handleRenameDone() {
    const trimmed = nameText.trim()
    if (trimmed && trimmed !== checklist.name) {
      onRename(trimmed)
    } else {
      setNameText(checklist.name)
    }
    setEditingName(false)
  }

  return (
    <div>
      {/* Checklist header */}
      <div className="flex items-center gap-2 mb-2">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-huginn-text-secondary shrink-0">
          <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.58l7.3-7.3a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
        </svg>
        {editingName ? (
          <input
            value={nameText}
            onChange={(e) => setNameText(e.target.value)}
            onBlur={handleRenameDone}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRenameDone(); if (e.key === 'Escape') { setNameText(checklist.name); setEditingName(false) } }}
            autoFocus
            className="flex-1 bg-huginn-surface text-xs font-semibold text-huginn-text-primary rounded px-2 py-0.5 outline-none border border-huginn-accent"
          />
        ) : (
          <span
            onClick={() => setEditingName(true)}
            className="flex-1 text-sm text-huginn-text-primary font-semibold cursor-pointer hover:text-white"
          >
            {checklist.name}
            {totalCount > 0 && <span className="ml-1.5 text-huginn-text-secondary">{checkedCount}/{totalCount}</span>}
          </span>
        )}
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="text-huginn-text-muted hover:text-white p-0.5 rounded hover:bg-huginn-surface/50">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M8 2a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM8 6.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM9.5 12.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0Z" />
            </svg>
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 bg-huginn-card border border-huginn-border rounded-lg shadow-xl py-1 z-50 w-32">
              <button
                onClick={() => { onDelete(); setShowMenu(false) }}
                className="w-full text-left text-xs text-huginn-danger hover:bg-huginn-surface px-3 py-1.5"
              >
                Delete checklist
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="h-1.5 bg-huginn-surface rounded-full mb-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${progress === 100 ? 'bg-huginn-success' : 'bg-huginn-accent'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Items */}
      <div className="space-y-0.5">
        {checklist.items.map((item) => (
          <div key={item.id} className="flex items-start gap-2.5 group py-1 px-1 rounded hover:bg-huginn-surface/50 -mx-1">
            <button
              onClick={() => onToggleItem(item.id)}
              className={`w-4 h-4 rounded border mt-0.5 shrink-0 flex items-center justify-center transition-colors ${
                item.checked ? 'bg-huginn-success border-huginn-success text-white' : 'border-huginn-text-muted'
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
                onBlur={saveEditItem}
                onKeyDown={(e) => { if (e.key === 'Enter') saveEditItem(); if (e.key === 'Escape') setEditingId(null) }}
                autoFocus
                className="flex-1 bg-huginn-surface text-sm text-huginn-text-primary rounded px-2 py-0.5 outline-none border border-huginn-border focus:border-huginn-accent"
              />
            ) : (
              <span
                onClick={() => startEditItem(item)}
                className={`flex-1 text-sm cursor-text ${item.checked ? 'text-huginn-text-muted line-through' : 'text-huginn-text-primary'}`}
              >
                {item.text}
              </span>
            )}
            <button
              onClick={() => onDeleteItem(item.id)}
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
      <div className="flex items-center gap-2 mt-1.5">
        <input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAddItem() }}
          placeholder="Add an item..."
          className="flex-1 bg-transparent text-sm text-huginn-text-primary outline-none placeholder-huginn-text-muted border-b border-transparent focus:border-huginn-border py-1"
        />
        {newText.trim() && (
          <button onClick={handleAddItem} className="text-xs text-huginn-accent font-semibold hover:text-white">
            Add
          </button>
        )}
      </div>
    </div>
  )
}
