import { useState } from 'react'
import { DndContext, DragOverlay, useDroppable, useDraggable, closestCenter } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import type { Task, TaskStatus } from '../../../shared/lib/types'
import { TaskCard } from './TaskCard'

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

interface TaskListProps {
  tasks: Task[]
  loading: boolean
  onTaskTap: (task: Task) => void
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void
  onAddTask?: (title: string) => Promise<void>
  selectedTaskId?: string
}

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: 'To Do' },
  { status: 'doing', label: 'In Progress' },
  { status: 'done', label: 'Done' },
]

function sortByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const pa = a.priority ? PRIORITY_ORDER[a.priority] : 3
    const pb = b.priority ? PRIORITY_ORDER[b.priority] : 3
    if (pa !== pb) return pa - pb
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

function AddCardInput({ onAdd }: { onAdd: (title: string) => void }) {
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')

  function handleSubmit() {
    const trimmed = title.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setTitle('')
    setAdding(false)
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
          Add
        </button>
        <button onClick={() => { setAdding(false); setTitle('') }} className="text-huginn-text-muted hover:text-white text-xs px-2 py-1.5">
          Cancel
        </button>
      </div>
    </div>
  )
}

function DroppableColumn({ status, label, count, children, onAdd }: {
  status: string; label: string; count: number; children: React.ReactNode; onAdd?: (title: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[250px] max-w-[350px] flex flex-col rounded-xl transition-colors ${
        isOver ? 'bg-huginn-accent/5 ring-1 ring-huginn-accent/20' : 'bg-huginn-base/80'
      }`}
      data-status={status}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-huginn-text-secondary">{label}</h3>
        <span className="text-[10px] font-semibold text-huginn-text-muted bg-huginn-surface rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
          {count}
        </span>
      </div>
      {/* Cards */}
      <div className="flex-1 overflow-y-auto px-2 pb-1">
        {children}
        {onAdd && <AddCardInput onAdd={onAdd} />}
      </div>
    </div>
  )
}

function DraggableCard({ task, onTaskTap, onStatusChange, selected }: {
  task: Task; onTaskTap: (task: Task) => void; onStatusChange: (taskId: string, newStatus: TaskStatus) => void; selected?: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id })
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={isDragging ? 'opacity-30' : ''}>
      <TaskCard task={task} onClick={() => onTaskTap(task)} onStatusChange={onStatusChange} selected={selected} />
    </div>
  )
}

function KanbanView({ tasks, onTaskTap, onStatusChange, onAddTask, selectedTaskId }: {
  tasks: Task[]; onTaskTap: (task: Task) => void; onStatusChange: (taskId: string, newStatus: TaskStatus) => void
  onAddTask?: (title: string) => Promise<void>; selectedTaskId?: string
}) {
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t.id === event.active.id)
    setActiveTask(task ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null)
    const { active, over } = event
    if (!over) return
    const taskId = active.id as string
    const newStatus = over.id as TaskStatus
    const task = tasks.find((t) => t.id === taskId)
    if (task && task.status !== newStatus) {
      onStatusChange(taskId, newStatus)
    }
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex-1 flex gap-4 p-4 overflow-x-auto">
        {COLUMNS.map(({ status, label }) => {
          const columnTasks = sortByPriority(tasks.filter((t) => t.status === status))
          return (
            <DroppableColumn
              key={status}
              status={status}
              label={label}
              count={columnTasks.length}
              onAdd={status === 'todo' ? onAddTask : undefined}
            >
              {columnTasks.length === 0 && (
                <p className="text-xs text-huginn-text-muted px-1 py-4 text-center">No cards</p>
              )}
              {columnTasks.map((task) => (
                <DraggableCard key={task.id} task={task} onTaskTap={onTaskTap} onStatusChange={onStatusChange} selected={task.id === selectedTaskId} />
              ))}
            </DroppableColumn>
          )
        })}
      </div>
      <DragOverlay>
        {activeTask && (
          <div className="w-[250px] rotate-2">
            <TaskCard task={activeTask} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

function GroupedView({ tasks, onTaskTap, onStatusChange, selectedTaskId }: {
  tasks: Task[]; onTaskTap: (task: Task) => void; onStatusChange: (taskId: string, newStatus: TaskStatus) => void; selectedTaskId?: string
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ done: true })

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2">
      {COLUMNS.map(({ status, label }) => {
        const columnTasks = sortByPriority(tasks.filter((t) => t.status === status))
        const isCollapsed = collapsed[status] ?? false

        return (
          <div key={status} className="mb-3">
            <button
              onClick={() => setCollapsed((c) => ({ ...c, [status]: !isCollapsed }))}
              className="flex items-center gap-2 mb-2 px-1 w-full"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className={`w-3 h-3 text-gray-500 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
              >
                <path d="M6.3 2.8a.75.75 0 0 1 1.05.15L12 8.96l4.65-6.01a.75.75 0 1 1 1.2.9l-5.25 6.78a.75.75 0 0 1-1.2 0L6.15 3.85a.75.75 0 0 1 .15-1.05Z" />
              </svg>
              <h3 className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{label}</h3>
              <span className="text-xs text-gray-600">{columnTasks.length}</span>
            </button>
            {!isCollapsed &&
              columnTasks.map((task) => (
                <TaskCard key={task.id} task={task} onClick={() => onTaskTap(task)} onStatusChange={onStatusChange} selected={task.id === selectedTaskId} />
              ))}
          </div>
        )
      })}
    </div>
  )
}

export function TaskList({ tasks, loading, onTaskTap, onStatusChange, onAddTask, selectedTaskId }: TaskListProps) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-huginn-text-muted text-sm">Loading...</p>
      </div>
    )
  }

  if (tasks.length === 0 && !onAddTask) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-huginn-text-muted text-sm">No tasks yet.</p>
      </div>
    )
  }

  return (
    <>
      <div className="hidden md:flex flex-1 min-h-0">
        <KanbanView tasks={tasks} onTaskTap={onTaskTap} onStatusChange={onStatusChange} onAddTask={onAddTask} selectedTaskId={selectedTaskId} />
      </div>
      <div className="md:hidden flex-1 min-h-0">
        <GroupedView tasks={tasks} onTaskTap={onTaskTap} onStatusChange={onStatusChange} selectedTaskId={selectedTaskId} />
      </div>
    </>
  )
}
