import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task, List } from '../../../shared/lib/types'

export const LIST_SORT_KEYS = [
  'manual',
  'due_asc',
  'due_desc',
  'priority',
  'title',
  'created_desc',
  'created_asc',
] as const
export type ListSortKey = typeof LIST_SORT_KEYS[number]

interface ListColumnProps {
  list: List
  tasks: Task[]
  onTaskTap: (task: Task) => void
  onAddCard: (listId: string, title: string) => Promise<void>
  onRenameList: (listId: string, name: string) => void
  onArchiveList: (listId: string) => void
  selectedTaskId?: string
  sortKey: ListSortKey
  onSortChange: (key: ListSortKey) => void
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

export function ListColumn({ list, tasks, onAddCard, onRenameList, onArchiveList, sortKey, onSortChange, renderDraggableCard }: ListColumnProps) {
  const { t } = useTranslation()
  // Sortable makes the list both a drag source (reorderable) and a droppable
  // target for cards. The drag listeners are applied ONLY to the header, so
  // clicking inside the cards area or on buttons doesn't start a list drag.
  const { attributes, listeners, setNodeRef, transform, isDragging, isOver } = useSortable({
    id: list.id,
    data: { type: 'list' },
    // No transition anywhere: drops must be instant (Trello-style). With a
    // transition, residual hover-time transforms finish animating to zero
    // AFTER the user releases, which reads as a drop lag.
    transition: null,
    animateLayoutChanges: () => false,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
  }

  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(list.name)
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close the menu on any pointerdown outside it.
  useEffect(() => {
    if (!showMenu) return
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [showMenu])

  function handleArchive() {
    const confirmed = window.confirm(t('list.menu.archiveConfirm', { name: list.name }))
    if (!confirmed) return
    onArchiveList(list.id)
    setShowMenu(false)
  }

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
      className={`w-[248px] min-w-[248px] flex flex-col rounded-xl max-h-full transition-colors backdrop-blur-sm ${
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
            className="flex-1 text-sm font-bold text-huginn-text-primary px-2 py-1 cursor-pointer rounded hover:bg-huginn-surface/50 flex items-center gap-1.5"
          >
            <span className="truncate">{list.name}</span>
            {sortKey !== 'manual' && (
              <span
                title={t(`list.sort.${sortKey}`)}
                className="text-[10px] font-semibold text-huginn-accent bg-huginn-accent-soft rounded px-1.5 py-0.5 uppercase tracking-wide"
              >
                {t(`list.sort.badge.${sortKey}`)}
              </span>
            )}
          </h3>
        )}
        <div className="relative" ref={menuRef}>
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
              className="absolute right-0 top-full mt-1 bg-huginn-card border border-huginn-border rounded-lg shadow-xl py-1 z-50 w-44"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="px-3 pt-1 pb-1 text-[10px] uppercase tracking-wide text-huginn-text-muted">
                {t('list.sort.label')}
              </div>
              {LIST_SORT_KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => { onSortChange(key); setShowMenu(false) }}
                  className={`w-full text-left text-xs px-3 py-1.5 flex items-center justify-between ${
                    sortKey === key ? 'text-huginn-accent' : 'text-huginn-text-secondary hover:text-white hover:bg-huginn-surface'
                  }`}
                >
                  <span>{t(`list.sort.${key}`)}</span>
                  {sortKey === key && (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                      <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 1 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
                    </svg>
                  )}
                </button>
              ))}
              <div className="border-t border-huginn-border my-1" />
              <button
                onClick={handleArchive}
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
