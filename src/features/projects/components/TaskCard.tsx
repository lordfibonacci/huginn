import type { Task, TaskStatus } from '../../../shared/lib/types'
import { formatDueDate } from '../../../shared/lib/dateUtils'

const PRIORITY_LABELS: Record<string, { text: string; class: string }> = {
  high: { text: 'High', class: 'bg-huginn-danger/20 text-huginn-danger' },
  medium: { text: 'Med', class: 'bg-huginn-warning/20 text-huginn-warning' },
  low: { text: 'Low', class: 'bg-huginn-text-muted/20 text-huginn-text-muted' },
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
  selected?: boolean
  dragHandleProps?: Record<string, unknown>
}

export function TaskCard({ task, onClick, onStatusChange, selected, dragHandleProps }: TaskCardProps) {
  const dueInfo = task.due_date ? formatDueDate(task.due_date) : null
  const priority = task.priority ? PRIORITY_LABELS[task.priority] : null

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation()
    if (onStatusChange) {
      onStatusChange(task.id, NEXT_STATUS[task.status])
    }
  }

  return (
    <div
      className={`rounded-lg mb-2 cursor-pointer transition-all group ${
        selected
          ? 'bg-huginn-accent/10 ring-1 ring-huginn-accent shadow-md'
          : 'bg-huginn-card hover:bg-huginn-hover shadow-sm shadow-black/20 hover:shadow-md hover:shadow-black/30'
      }`}
      onClick={onClick}
      data-task-id={task.id}
    >
      {/* Priority color bar at top */}
      {task.priority === 'high' && <div className="h-0.5 bg-huginn-danger rounded-t-lg" />}
      {task.priority === 'medium' && <div className="h-0.5 bg-huginn-warning rounded-t-lg" />}

      <div className="p-3">
        {/* Title row */}
        <div className="flex items-start gap-2">
          {/* Drag handle — only visible on hover */}
          {dragHandleProps && (
            <div
              {...dragHandleProps}
              className="mt-1 shrink-0 cursor-grab active:cursor-grabbing text-huginn-text-muted opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                <path d="M4 4a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm0 5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm0 5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm4-10a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm0 5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm0 5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
              </svg>
            </div>
          )}
          <button
            onClick={handleToggle}
            className={`w-4 h-4 rounded border mt-0.5 shrink-0 flex items-center justify-center transition-colors ${
              task.status === 'done'
                ? 'bg-huginn-success border-huginn-success text-white'
                : task.status === 'doing'
                  ? 'border-huginn-accent bg-huginn-accent/20'
                  : 'border-huginn-text-muted'
            }`}
          >
            {task.status === 'done' && (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.58l7.3-7.3a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
              </svg>
            )}
          </button>
          <p className={`text-sm leading-snug flex-1 ${task.status === 'done' ? 'text-huginn-text-muted line-through' : 'text-huginn-text-primary'}`}>
            {task.title}
          </p>
        </div>

        {/* Metadata badges */}
        {(priority || dueInfo || task.notes) && (
          <div className="flex items-center gap-1.5 mt-2 ml-6 flex-wrap">
            {priority && (
              <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${priority.class}`}>
                {priority.text}
              </span>
            )}
            {dueInfo && (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                dueInfo.urgent ? 'bg-huginn-danger/20 text-huginn-danger' : 'bg-huginn-surface text-huginn-text-secondary'
              }`}>
                {dueInfo.text}
              </span>
            )}
            {task.notes && (
              <span className="text-huginn-text-muted" title="Has notes">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                  <path d="M2 4.5A2.5 2.5 0 0 1 4.5 2h7A2.5 2.5 0 0 1 14 4.5v7a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 2 11.5v-7ZM4 5.5a.5.5 0 0 0 0 1h8a.5.5 0 0 0 0-1H4ZM4 8a.5.5 0 0 0 0 1h8a.5.5 0 0 0 0-1H4Zm0 2.5a.5.5 0 0 0 0 1h4a.5.5 0 0 0 0-1H4Z" />
                </svg>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
