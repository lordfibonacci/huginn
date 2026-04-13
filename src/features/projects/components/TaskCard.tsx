import type { Task, TaskStatus } from '../../../shared/lib/types'
import { formatDueDate } from '../../../shared/lib/dateUtils'

const STATUS_COLORS: Record<string, string> = {
  todo: 'border-gray-500 text-gray-500',
  doing: 'border-[#6c5ce7] bg-[#6c5ce7] text-white',
  done: 'border-[#00b894] bg-[#00b894] text-white',
}

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-[#e17055]',
  medium: 'bg-[#fdcb6e]',
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
      className="bg-[#2a2a4a] rounded-xl p-3 mb-2 cursor-pointer active:bg-[#3a3a5a] transition-colors"
      onClick={onClick}
      data-task-id={task.id}
    >
      <div className="flex items-start gap-2.5">
        {/* Status toggle */}
        <button
          onClick={handleToggle}
          className={`w-5 h-5 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center transition-colors ${STATUS_COLORS[task.status]}`}
          title={`Mark as ${NEXT_STATUS[task.status]}`}
        >
          {task.status === 'done' && (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
              <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.58l7.3-7.3a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <p className={`text-sm ${task.status === 'done' ? 'text-gray-500 line-through' : 'text-gray-100'}`}>
            {task.title}
          </p>
          {(dueInfo || (task.priority && PRIORITY_COLORS[task.priority])) && (
            <div className="flex items-center gap-2 mt-1">
              {task.priority && PRIORITY_COLORS[task.priority] && (
                <span className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[task.priority]}`} title={task.priority} />
              )}
              {dueInfo && (
                <span className={`text-xs ${dueInfo.urgent ? 'text-[#e17055]' : 'text-gray-500'}`}>
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
