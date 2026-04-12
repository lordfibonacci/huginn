import type { Task } from '../../../shared/lib/types'
import { formatDueDate } from '../../../shared/lib/dateUtils'

const STATUS_COLORS: Record<string, string> = {
  todo: 'bg-gray-500',
  doing: 'bg-[#6c5ce7]',
  done: 'bg-[#00b894]',
}

interface TaskCardProps {
  task: Task
  onClick?: () => void
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const dueInfo = task.due_date ? formatDueDate(task.due_date) : null

  return (
    <div
      className="bg-[#2a2a4a] rounded-xl p-3 mb-2 cursor-pointer active:bg-[#3a3a5a] transition-colors"
      onClick={onClick}
      data-task-id={task.id}
    >
      <div className="flex items-start gap-2">
        <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${STATUS_COLORS[task.status]}`} />
        <p className={`text-sm flex-1 ${task.status === 'done' ? 'text-gray-500 line-through' : 'text-gray-100'}`}>
          {task.title}
        </p>
      </div>
      {dueInfo && (
        <div className="mt-1.5 ml-4">
          <span className={`text-xs ${dueInfo.urgent ? 'text-[#e17055]' : 'text-gray-500'}`}>
            {dueInfo.text}
          </span>
        </div>
      )}
    </div>
  )
}
