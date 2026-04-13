import type { Task, TaskStatus } from '../../../shared/lib/types'
import { formatDueDate } from '../../../shared/lib/dateUtils'

const STATUS_COLORS: Record<string, string> = {
  todo: 'border-gray-500 text-gray-500',
  doing: 'border-huginn-accent bg-huginn-accent text-white',
  done: 'border-huginn-success bg-huginn-success text-white',
}

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-huginn-danger',
  medium: 'bg-huginn-warning',
}

const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  todo: 'doing',
  doing: 'done',
  done: 'todo',
}

interface TaskCardProps {
  task: Task
  onClick?: () => void
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void
}

export function TaskCard({ task, onClick, onStatusChange }: TaskCardProps) {
  const dueInfo = task.due_date ? formatDueDate(task.due_date) : null

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation()
    if (onStatusChange) {
      onStatusChange(task.id, NEXT_STATUS[task.status])
    }
  }

  return (
    <div
      className="bg-huginn-card rounded-lg p-3 mb-2 cursor-pointer hover:bg-huginn-hover transition-colors"
      onClick={onClick}
      data-task-id={task.id}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={handleToggle}
          className={`w-6 h-6 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center transition-colors ${STATUS_COLORS[task.status]}`}
          title={`Mark as ${NEXT_STATUS[task.status]}`}
        >
          {task.status === 'done' && (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.58l7.3-7.3a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <p className={`text-sm leading-relaxed ${task.status === 'done' ? 'text-gray-500 line-through' : 'text-huginn-text-primary'}`}>
            {task.title}
          </p>
          {(dueInfo || (task.priority && PRIORITY_COLORS[task.priority])) && (
            <div className="flex items-center gap-2.5 mt-1.5">
              {task.priority && PRIORITY_COLORS[task.priority] && (
                <span className={`w-2.5 h-2.5 rounded-sm ${PRIORITY_COLORS[task.priority]}`} title={task.priority} />
              )}
              {dueInfo && (
                <span className={`text-xs font-medium ${dueInfo.urgent ? 'text-huginn-danger' : 'text-huginn-text-secondary'}`}>
                  {dueInfo.text}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
