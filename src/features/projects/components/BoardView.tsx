import { useCallback, useRef, useState } from 'react'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task, List, Label } from '../../../shared/lib/types'
import { TaskCard } from './TaskCard'
import { ListColumn } from './ListColumn'
import { LoadingScreen } from '../../../shared/components/Logo'

interface BoardViewProps {
  lists: List[]
  tasks: Task[]
  onTaskTap: (task: Task) => void
  onAddCard: (listId: string, title: string) => Promise<void>
  onRenameList: (listId: string, name: string) => void
  onArchiveList: (listId: string) => void
  onAddList: (name: string) => void
  selectedTaskId?: string
  loading?: boolean
  taskLabelsMap?: Record<string, Label[]>
  coverImageMap?: Record<string, string>
}

function SortableCard({ task, onTaskTap, selectedTaskId, labels, coverImageUrl }: { task: Task; onTaskTap: (task: Task) => void; selectedTaskId?: string; labels?: Label[]; coverImageUrl?: string | null }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'card', listId: task.list_id },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
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
        selected={task.id === selectedTaskId}
        labels={labels}
        coverImageUrl={coverImageUrl}
      />
    </div>
  )
}

export function BoardView({ lists, tasks, onTaskTap, onAddCard, onRenameList, onArchiveList, onAddList, selectedTaskId, loading, taskLabelsMap, coverImageMap }: BoardViewProps) {
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
    return <LoadingScreen message="Loading project" />
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
      className="flex-1 flex gap-4 p-4 overflow-x-auto items-start cursor-grab active:cursor-grabbing"
      onMouseDown={handleBoardMouseDown}
      onMouseMove={handleBoardMouseMove}
      onMouseUp={handleBoardMouseUp}
      onMouseLeave={handleBoardMouseUp}
    >
      {lists.map((list) => {
        const listTasks = tasksByList[list.id] || []
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
              renderDraggableCard={(task) => (
                <SortableCard
                  key={task.id}
                  task={task}
                  onTaskTap={onTaskTap}
                  selectedTaskId={selectedTaskId}
                  labels={taskLabelsMap?.[task.id]}
                  coverImageUrl={coverImageMap?.[task.id]}
                />
              )}
            />
          </SortableContext>
        )
      })}

      {/* Add another list */}
      <div className="w-[272px] min-w-[272px] shrink-0">
        {addingList ? (
          <div className="bg-huginn-base/80 rounded-xl p-2">
            <input
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="Enter list title..."
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
                Add list
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
            Add another list
          </button>
        )}
      </div>
    </div>
  )
}
