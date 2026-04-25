import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SortableContext, useSortable, verticalListSortingStrategy, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task, TaskStatus, List, Label } from '../../../shared/lib/types'
import type { RuneDefinition } from '../../../runes/types'
import { TaskCard } from './TaskCard'
import { ListColumn, type ListSortKey } from './ListColumn'
import { LoadingScreen } from '../../../shared/components/Logo'

const PRIORITY_WEIGHT: Record<string, number> = { high: 0, medium: 1, low: 2 }

function sortTasks(tasks: Task[], key: ListSortKey): Task[] {
  if (key === 'manual') return tasks
  const sorted = [...tasks]
  switch (key) {
    case 'due_asc':
      // Soonest first; no-date cards sink to the bottom.
      sorted.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return a.due_date.localeCompare(b.due_date)
      })
      break
    case 'due_desc':
      // Latest first; no-date cards still sink to the bottom (same rationale:
      // they're the least date-informative, not the most).
      sorted.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return b.due_date.localeCompare(a.due_date)
      })
      break
    case 'priority':
      sorted.sort((a, b) => {
        const wa = a.priority ? PRIORITY_WEIGHT[a.priority] ?? 3 : 3
        const wb = b.priority ? PRIORITY_WEIGHT[b.priority] ?? 3 : 3
        return wa - wb
      })
      break
    case 'title':
      sorted.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
      break
    case 'created_desc':
      sorted.sort((a, b) => b.created_at.localeCompare(a.created_at))
      break
    case 'created_asc':
      sorted.sort((a, b) => a.created_at.localeCompare(b.created_at))
      break
  }
  return sorted
}

interface BoardViewProps {
  lists: List[]
  tasks: Task[]
  onTaskTap: (task: Task) => void
  onAddCard: (listId: string, title: string) => Promise<void>
  onRenameList: (listId: string, name: string) => void
  onArchiveList: (listId: string) => void
  onAddList: (name: string) => void
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void
  selectedTaskId?: string
  loading?: boolean
  taskLabelsMap?: Record<string, Label[]>
  coverImageMap?: Record<string, string>
  unreadMentionsByTask?: Record<string, number>
  sortByList: Record<string, ListSortKey>
  onSortChange: (listId: string, key: ListSortKey) => void
  // When a card is being dragged from a list, that list's sort is visually
  // suspended (treated as 'manual') so dnd-kit's arrayMove reordering works
  // without the sort re-applying on every render.
  dragSourceListId: string | null
  /** Enabled runes — passed through to TaskCard for card-front surfaces (e.g. Meta status chip). */
  enabledRunes?: RuneDefinition[]
}

function SortableCard({ task, onTaskTap, onStatusChange, selectedTaskId, labels, coverImageUrl, unreadMentions, enabledRunes }: { task: Task; onTaskTap: (task: Task) => void; onStatusChange?: (taskId: string, newStatus: TaskStatus) => void; selectedTaskId?: string; labels?: Label[]; coverImageUrl?: string | null; unreadMentions?: number; enabledRunes?: RuneDefinition[] }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
    id: task.id,
    data: { type: 'card', listId: task.list_id },
    // No transition / no layout animation: drop should be instant (Trello-style).
    // A transition causes hover-time transforms to finish animating back to zero
    // AFTER the user releases, which reads as 200–400 ms of drop lag.
    transition: null,
    animateLayoutChanges: () => false,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={isDragging ? 'opacity-30' : ''}
    >
      <TaskCard
        task={task}
        onClick={() => onTaskTap(task)}
        onStatusChange={onStatusChange}
        selected={task.id === selectedTaskId}
        labels={labels}
        coverImageUrl={coverImageUrl}
        unreadMentions={unreadMentions}
        enabledRunes={enabledRunes}
      />
    </div>
  )
}

export function BoardView({ lists, tasks, onTaskTap, onAddCard, onRenameList, onArchiveList, onAddList, onStatusChange, selectedTaskId, loading, taskLabelsMap, coverImageMap, unreadMentionsByTask, sortByList, onSortChange, dragSourceListId, enabledRunes }: BoardViewProps) {
  const { t } = useTranslation()
  const [addingList, setAddingList] = useState(false)
  const [newListName, setNewListName] = useState('')

  // Click-and-drag to scroll the board horizontally
  const boardRef = useRef<HTMLDivElement>(null)
  const isDraggingBoard = useRef(false)
  const dragStartX = useRef(0)
  const scrollStartX = useRef(0)

  const handleBoardMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).closest('[data-board-bg]')) return
    isDraggingBoard.current = true
    dragStartX.current = e.clientX
    scrollStartX.current = boardRef.current?.scrollLeft ?? 0
    document.body.style.cursor = 'grabbing'
    e.preventDefault()
  }, [])

  const handleBoardMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingBoard.current || !boardRef.current) return
    const dx = e.clientX - dragStartX.current
    boardRef.current.scrollLeft = scrollStartX.current - dx
  }, [])

  const handleBoardMouseUp = useCallback(() => {
    isDraggingBoard.current = false
    document.body.style.cursor = ''
  }, [])

  function handleAddList() {
    const trimmed = newListName.trim()
    if (!trimmed) return
    onAddList(trimmed)
    setNewListName('')
    setAddingList(false)
  }

  if (loading) {
    return <LoadingScreen message={t('board.loading')} />
  }

  // Group tasks by list_id, preserving the order they arrive in (parent owns order)
  const tasksByList: Record<string, Task[]> = {}
  for (const list of lists) tasksByList[list.id] = []
  for (const task of tasks) {
    if (task.list_id && tasksByList[task.list_id]) {
      tasksByList[task.list_id].push(task)
    }
  }

  return (
    <div
      ref={boardRef}
      data-board-bg
      className="flex-1 flex gap-2 px-2 py-3 overflow-x-auto items-start cursor-grab active:cursor-grabbing"
      onMouseDown={handleBoardMouseDown}
      onMouseMove={handleBoardMouseMove}
      onMouseUp={handleBoardMouseUp}
      onMouseLeave={handleBoardMouseUp}
    >
      <SortableContext items={lists.map(l => l.id)} strategy={horizontalListSortingStrategy}>
        {lists.map((list) => {
          const persistedSort = sortByList[list.id] ?? 'manual'
          // A card being dragged FROM this list suspends the sort visually
          // (treated as 'manual' for rendering) so dnd-kit's arrayMove during
          // hover actually shifts the cards around. If the user drops same-list,
          // handleDragEnd persists the flip to manual; cross-list drops restore.
          const sortKey: ListSortKey = list.id === dragSourceListId ? 'manual' : persistedSort
          const rawTasks = tasksByList[list.id] || []
          const listTasks = sortKey === 'manual' ? rawTasks : sortTasks(rawTasks, sortKey)
          const itemIds = listTasks.map(t => t.id)
          return (
            <SortableContext key={list.id} id={list.id} items={itemIds} strategy={verticalListSortingStrategy}>
              <ListColumn
                list={list}
                tasks={listTasks}
                onTaskTap={onTaskTap}
                onAddCard={onAddCard}
                onRenameList={onRenameList}
                onArchiveList={onArchiveList}
                selectedTaskId={selectedTaskId}
                sortKey={persistedSort}
                onSortChange={(key) => onSortChange(list.id, key)}
                renderDraggableCard={(task) => (
                  <SortableCard
                    key={task.id}
                    task={task}
                    onTaskTap={onTaskTap}
                    onStatusChange={onStatusChange}
                    selectedTaskId={selectedTaskId}
                    labels={taskLabelsMap?.[task.id]}
                    coverImageUrl={coverImageMap?.[task.id]}
                    unreadMentions={unreadMentionsByTask?.[task.id]}
                    enabledRunes={enabledRunes}
                  />
                )}
              />
            </SortableContext>
          )
        })}
      </SortableContext>

      {/* Add another list */}
      <div className="w-[248px] min-w-[248px] shrink-0">
        {addingList ? (
          <div className="bg-huginn-base/80 rounded-xl p-2">
            <input
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder={t('board.addList.placeholder')}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddList()
                if (e.key === 'Escape') { setAddingList(false); setNewListName('') }
              }}
              className="w-full bg-huginn-surface text-sm text-huginn-text-primary rounded-lg px-3 py-2 outline-none border border-huginn-border focus:border-huginn-accent placeholder-huginn-text-muted"
            />
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={handleAddList}
                disabled={!newListName.trim()}
                className="bg-huginn-accent text-white text-xs font-semibold rounded-md px-3 py-1.5 disabled:opacity-50"
              >
                {t('board.addList.submit')}
              </button>
              <button onClick={() => { setAddingList(false); setNewListName('') }} className="text-huginn-text-muted hover:text-white text-xs">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L6.94 8l-1.72 1.72a.75.75 0 1 0 1.06 1.06L8 9.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L9.06 8l1.72-1.72a.75.75 0 0 0-1.06-1.06L8 6.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingList(true)}
            className="flex items-center gap-2 text-sm text-huginn-text-muted hover:text-huginn-text-secondary w-full px-3 py-2 rounded-xl hover:bg-huginn-base/50 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2Z" />
            </svg>
            {t('board.addList.trigger')}
          </button>
        )}
      </div>
    </div>
  )
}
