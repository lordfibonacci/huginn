import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import type { Task, List } from '../../../shared/lib/types'

interface ListColumnProps {
  list: List
  tasks: Task[]
  onTaskTap: (task: Task) => void
  onAddCard: (listId: string, title: string) => Promise<void>
  onRenameList: (listId: string, name: string) => void
  onArchiveList: (listId: string) => void
  selectedTaskId?: string
  renderDraggableCard: (task: Task) => React.ReactNode
}

function AddCardInput({ onAdd }: { onAdd: (title: string) => void }) {
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')

  function handleSubmit() {
    const trimmed = title.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setTitle('')
  }

  if (!adding) {
    return (
      <button
        onClick={() => setAdding(true)}
        className="flex items-center gap-1.5 text-xs text-huginn-text-muted hover:text-huginn-text-secondary w-full px-2 py-1.5 rounded-md hover:bg-huginn-card/50 transition-colors mt-1"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
          <path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2Z" />
        </svg>
        Add a card
      </button>
    )
  }

  return (
    <div className="mt-1">
      <textarea
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Enter a title..."
        autoFocus
        rows={2}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
          if (e.key === 'Escape') { setAdding(false); setTitle('') }
        }}
        className="w-full bg-huginn-card text-white rounded-lg px-3 py-2 text-sm outline-none border border-huginn-border focus:border-huginn-accent resize-none placeholder-huginn-text-muted"
      />
      <div className="flex items-center gap-2 mt-1.5">
        <button
          onClick={handleSubmit}
          disabled={!title.trim()}
          className="bg-huginn-accent text-white text-xs font-semibold rounded-md px-3 py-1.5 disabled:opacity-50"
        >
          Add card
        </button>
        <button onClick={() => { setAdding(false); setTitle('') }} className="text-huginn-text-muted hover:text-white text-xs px-2 py-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L6.94 8l-1.72 1.72a.75.75 0 1 0 1.06 1.06L8 9.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L9.06 8l1.72-1.72a.75.75 0 0 0-1.06-1.06L8 6.94 6.28 5.22Z" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export function ListColumn({ list, tasks, onTaskTap, onAddCard, onRenameList, onArchiveList, selectedTaskId, renderDraggableCard }: ListColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: list.id })
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(list.name)
  const [showMenu, setShowMenu] = useState(false)

  function handleRename() {
    const trimmed = name.trim()
    if (trimmed && trimmed !== list.name) {
      onRenameList(list.id, trimmed)
    } else {
      setName(list.name)
    }
    setEditingName(false)
  }

  return (
    <div
      ref={setNodeRef}
      className={`w-[272px] min-w-[272px] flex flex-col rounded-xl max-h-full transition-colors backdrop-blur-sm ${
        isOver ? 'bg-black/30 ring-1 ring-huginn-accent/30' : 'bg-black/20'
      }`}
      data-list-id={list.id}
    >
      {/* List header */}
      <div className="flex items-center gap-1 px-2 pt-2 pb-1">
        {editingName ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') { setName(list.name); setEditingName(false) } }}
            autoFocus
            className="flex-1 bg-huginn-surface text-sm font-bold text-huginn-text-primary rounded px-2 py-1 outline-none border border-huginn-accent"
          />
        ) : (
          <h3
            onClick={() => setEditingName(true)}
            className="flex-1 text-sm font-bold text-huginn-text-primary px-2 py-1 cursor-pointer rounded hover:bg-huginn-surface/50"
          >
            {list.name}
          </h3>
        )}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="text-huginn-text-muted hover:text-white p-1 rounded hover:bg-huginn-surface/50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <path d="M8 2a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM8 6.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM9.5 12.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0Z" />
            </svg>
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 bg-huginn-card border border-huginn-border rounded-lg shadow-xl py-1 z-50 w-36">
              <button
                onClick={() => { onArchiveList(list.id); setShowMenu(false) }}
                className="w-full text-left text-xs text-huginn-text-secondary hover:text-white hover:bg-huginn-surface px-3 py-1.5"
              >
                Archive list
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto px-2 pb-1 min-h-[20px]">
        {tasks.map((task) => renderDraggableCard(task))}
      </div>

      {/* Add card */}
      <div className="px-2 pb-2">
        <AddCardInput onAdd={(title) => onAddCard(list.id, title)} />
      </div>
    </div>
  )
}
