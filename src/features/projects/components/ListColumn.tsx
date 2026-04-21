import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
  const { t } = useTranslation()
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
        {t('list.addCard.trigger')}
      </button>
    )
  }

  return (
    <div className="mt-1">
      <textarea
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('list.addCard.placeholder')}
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
          {t('list.addCard.submit')}
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

export function ListColumn({ list, tasks, onAddCard, onRenameList, onArchiveList, renderDraggableCard }: ListColumnProps) {
  const { t } = useTranslation()
  // Sortable makes the list both a drag source (reorderable) and a droppable
  // target for cards. The drag listeners are applied ONLY to the header, so
  // clicking inside the cards area or on buttons doesn't start a list drag.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
    id: list.id,
    data: { type: 'list' },
    transition: { duration: 260, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

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
      style={style}
      className={`w-[272px] min-w-[272px] flex flex-col rounded-xl max-h-full transition-colors backdrop-blur-sm ${
        isDragging ? 'opacity-30' : ''
      } ${
        isOver && !isDragging ? 'bg-huginn-accent/8 ring-1 ring-huginn-accent/30' : 'bg-black/20'
      }`}
      data-list-id={list.id}
    >
      {/* List header — drag handle for reordering lists */}
      <div
        {...attributes}
        {...listeners}
        className={`flex items-center gap-1 px-2 pt-2 pb-1 ${editingName ? '' : 'cursor-grab active:cursor-grabbing'} touch-none`}
      >
        {editingName ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleRename}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') { setName(list.name); setEditingName(false) } }}
            autoFocus
            onPointerDown={(e) => e.stopPropagation()}
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
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={t('list.menu.open')}
            className="text-huginn-text-muted hover:text-white p-1 rounded hover:bg-huginn-surface/50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <path d="M8 2a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM8 6.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM9.5 12.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0Z" />
            </svg>
          </button>
          {showMenu && (
            <div
              className="absolute right-0 top-full mt-1 bg-huginn-card border border-huginn-border rounded-lg shadow-xl py-1 z-50 w-36"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => { onArchiveList(list.id); setShowMenu(false) }}
                className="w-full text-left text-xs text-huginn-text-secondary hover:text-white hover:bg-huginn-surface px-3 py-1.5"
              >
                {t('list.menu.archive')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto px-2 pb-1 min-h-[40px]">
        {tasks.map((task) => renderDraggableCard(task))}
      </div>

      {/* Add card */}
      <div className="px-2 pb-2">
        <AddCardInput onAdd={(title) => onAddCard(list.id, title)} />
      </div>
    </div>
  )
}
