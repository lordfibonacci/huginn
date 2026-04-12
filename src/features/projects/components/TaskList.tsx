import { useState } from 'react'
import type { Task, TaskStatus } from '../../../shared/lib/types'
import { TaskCard } from './TaskCard'

interface TaskListProps {
  tasks: Task[]
  loading: boolean
  onTaskTap: (task: Task) => void
}

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: 'Todo' },
  { status: 'doing', label: 'Doing' },
  { status: 'done', label: 'Done' },
]

function KanbanView({ tasks, onTaskTap }: { tasks: Task[]; onTaskTap: (task: Task) => void }) {
  return (
    <div className="flex-1 flex gap-3 px-3 py-2 overflow-x-auto">
      {COLUMNS.map(({ status, label }) => {
        const columnTasks = tasks.filter((t) => t.status === status)
        return (
          <div
            key={status}
            className="flex-1 min-w-[200px] flex flex-col"
            data-status={status}
          >
            <div className="flex items-center gap-2 mb-2 px-1">
              <h3 className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{label}</h3>
              <span className="text-xs text-gray-600">{columnTasks.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {columnTasks.length === 0 ? (
                <p className="text-xs text-gray-600 px-1">No tasks</p>
              ) : (
                columnTasks.map((task) => (
                  <TaskCard key={task.id} task={task} onClick={() => onTaskTap(task)} />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function GroupedView({ tasks, onTaskTap }: { tasks: Task[]; onTaskTap: (task: Task) => void }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ done: true })

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2">
      {COLUMNS.map(({ status, label }) => {
        const columnTasks = tasks.filter((t) => t.status === status)
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
                <TaskCard key={task.id} task={task} onClick={() => onTaskTap(task)} />
              ))}
          </div>
        )
      })}
    </div>
  )
}

export function TaskList({ tasks, loading, onTaskTap }: TaskListProps) {
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
        <KanbanView tasks={tasks} onTaskTap={onTaskTap} />
      </div>
      <div className="md:hidden flex-1 min-h-0">
        <GroupedView tasks={tasks} onTaskTap={onTaskTap} />
      </div>
    </>
  )
}
