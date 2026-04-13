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
}

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: 'Todo' },
  { status: 'doing', label: 'Doing' },
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

function DroppableColumn({ status, label, children }: { status: string; label: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[200px] flex flex-col rounded-lg transition-colors ${isOver ? 'bg-[#2a2a4a]/30' : ''}`}
      data-status={status}
    >
      <div className="flex items-center gap-2 mb-2 px-1">
        <h3 className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{label}</h3>
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}

function DraggableCard({ task, onTaskTap, onStatusChange }: { task: Task; onTaskTap: (task: Task) => void; onStatusChange: (taskId: string, newStatus: TaskStatus) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id })
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={isDragging ? 'opacity-30' : ''}>
      <TaskCard task={task} onClick={() => onTaskTap(task)} onStatusChange={onStatusChange} />
    </div>
  )
}

function KanbanView({ tasks, onTaskTap, onStatusChange }: { tasks: Task[]; onTaskTap: (task: Task) => void; onStatusChange: (taskId: string, newStatus: TaskStatus) => void }) {
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
      <div className="flex-1 flex gap-3 px-3 py-2 overflow-x-auto">
        {COLUMNS.map(({ status, label }) => {
          const columnTasks = sortByPriority(tasks.filter((t) => t.status === status))
          return (
            <DroppableColumn key={status} status={status} label={`${label} (${columnTasks.length})`}>
              {columnTasks.length === 0 ? (
                <p className="text-xs text-gray-600 px-1">No tasks</p>
              ) : (
                columnTasks.map((task) => (
                  <DraggableCard key={task.id} task={task} onTaskTap={onTaskTap} onStatusChange={onStatusChange} />
                ))
              )}
            </DroppableColumn>
          )
        })}
      </div>
      <DragOverlay>
        {activeTask && (
          <div className="w-[200px]">
            <TaskCard task={activeTask} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

function GroupedView({ tasks, onTaskTap, onStatusChange }: { tasks: Task[]; onTaskTap: (task: Task) => void; onStatusChange: (taskId: string, newStatus: TaskStatus) => void }) {
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
                <TaskCard key={task.id} task={task} onClick={() => onTaskTap(task)} onStatusChange={onStatusChange} />
              ))}
          </div>
        )
      })}
    </div>
  )
}

export function TaskList({ tasks, loading, onTaskTap, onStatusChange }: TaskListProps) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500 text-sm">No tasks yet. Tap + to create one.</p>
      </div>
    )
  }

  return (
    <>
      <div className="hidden md:flex flex-1 min-h-0">
        <KanbanView tasks={tasks} onTaskTap={onTaskTap} onStatusChange={onStatusChange} />
      </div>
      <div className="md:hidden flex-1 min-h-0">
        <GroupedView tasks={tasks} onTaskTap={onTaskTap} onStatusChange={onStatusChange} />
      </div>
    </>
  )
}
