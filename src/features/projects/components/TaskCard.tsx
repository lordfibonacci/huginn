import { useTranslation } from 'react-i18next'
import type { Task, TaskStatus } from '../../../shared/lib/types'
import { formatDueDate } from '../../../shared/lib/dateUtils'
import { getContrastTextColor } from '../../../shared/lib/contrast'

const PRIORITY_CLASS: Record<string, string> = {
  high: 'bg-huginn-danger/20 text-huginn-danger',
  medium: 'bg-huginn-warning/20 text-huginn-warning',
  low: 'bg-huginn-text-muted/20 text-huginn-text-muted',
}

interface TaskCardProps {
  task: Task
  onClick?: () => void
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void
  selected?: boolean
  checklistProgress?: { checked: number; total: number } | null
  labels?: { id: string; name: string; color: string }[]
  coverImageUrl?: string | null
  dragHandleProps?: Record<string, unknown>
}

export function TaskCard({ task, onClick, onStatusChange, selected, checklistProgress, labels, coverImageUrl }: TaskCardProps) {
  const { t } = useTranslation()
  const dueInfo = task.due_date ? formatDueDate(task.due_date) : null
  const priority = task.priority
    ? { text: t(`task.priority.${task.priority}`), class: PRIORITY_CLASS[task.priority] }
    : null

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation()
    if (onStatusChange) {
      onStatusChange(task.id, task.status === 'done' ? 'todo' : 'done')
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
      {/* Cover image — edge-to-edge at the top, Trello-style */}
      {coverImageUrl && (
        <div className="overflow-hidden rounded-t-lg bg-black/30">
          <img
            src={coverImageUrl}
            alt=""
            className="w-full max-h-48 object-cover select-none"
            draggable={false}
            loading="lazy"
          />
        </div>
      )}

      {/* Priority color bar at top (below cover if any) */}
      {!coverImageUrl && task.priority === 'high' && <div className="h-0.5 bg-huginn-danger rounded-t-lg" />}
      {!coverImageUrl && task.priority === 'medium' && <div className="h-0.5 bg-huginn-warning rounded-t-lg" />}

      {/* Labels */}
      {labels && labels.length > 0 && (
        <div className="flex gap-1 flex-wrap px-3 pt-2">
          {labels.map((label) => (
            <span
              key={label.id}
              className="text-[10px] font-semibold px-2 py-0.5 rounded"
              style={{ backgroundColor: label.color, color: getContrastTextColor(label.color) }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}

      <div className="p-3">
        {/* Title row */}
        <div className="flex items-start gap-2">
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
        {(priority || dueInfo || task.notes || (checklistProgress && checklistProgress.total > 0)) && (
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
              <span className="text-huginn-text-muted" title={t('task.hasNotes')}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                  <path d="M2 4.5A2.5 2.5 0 0 1 4.5 2h7A2.5 2.5 0 0 1 14 4.5v7a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 2 11.5v-7ZM4 5.5a.5.5 0 0 0 0 1h8a.5.5 0 0 0 0-1H4ZM4 8a.5.5 0 0 0 0 1h8a.5.5 0 0 0 0-1H4Zm0 2.5a.5.5 0 0 0 0 1h4a.5.5 0 0 0 0-1H4Z" />
                </svg>
              </span>
            )}
            {checklistProgress && checklistProgress.total > 0 && (
              <span className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                checklistProgress.checked === checklistProgress.total
                  ? 'bg-huginn-success/20 text-huginn-success'
                  : 'bg-huginn-surface text-huginn-text-secondary'
              }`}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                  <path fillRule="evenodd" d="M12.4 4.7a.75.75 0 0 1 .1 1.06l-5.25 6a.75.75 0 0 1-1.1.02L3.6 9.1a.75.75 0 1 1 1.1-1.02l2.05 2.22 4.7-5.37a.75.75 0 0 1 1.06-.1l-.1-.13Z" clipRule="evenodd" />
                </svg>
                {checklistProgress.checked}/{checklistProgress.total}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
