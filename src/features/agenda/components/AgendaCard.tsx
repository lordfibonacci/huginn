import { useTranslation } from 'react-i18next'
import type { Task, Project } from '../../../shared/lib/types'
import { ProjectGlyph } from '../../projects/components/ProjectGlyph'
import { formatDueDate } from '../../../shared/lib/dateUtils'

interface AgendaCardProps {
  task: Task
  project?: Project
  onClick: () => void
  showDue?: boolean
}

export function AgendaCard({ task, project, onClick, showDue = true }: AgendaCardProps) {
  const { t } = useTranslation()
  const dueInfo = showDue && task.due_date ? formatDueDate(task.due_date) : null

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-huginn-card hover:bg-huginn-hover border border-huginn-border/60 hover:border-huginn-accent/40 rounded-xl px-3 py-2.5 flex items-center gap-3 transition-colors"
    >
      {project && (
        <span className="flex items-center gap-1.5 shrink-0 min-w-0 max-w-[120px]">
          <ProjectGlyph color={project.color} size={12} glow={false} />
          <span className="text-[11px] text-huginn-text-muted truncate">{project.name}</span>
        </span>
      )}
      <span className={`flex-1 text-sm leading-snug truncate ${task.status === 'done' ? 'text-huginn-text-muted line-through' : 'text-huginn-text-primary'}`}>
        {task.title}
      </span>
      {task.starred && (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 shrink-0 text-huginn-warning" aria-label={t('task.starred')}>
          <path d="M10 2.5l2.47 5.01 5.53.8-4 3.9.94 5.49L10 15.1l-4.94 2.6.94-5.49-4-3.9 5.53-.8L10 2.5Z" />
        </svg>
      )}
      {dueInfo && (
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded shrink-0 ${
          dueInfo.urgent ? 'bg-huginn-danger/20 text-huginn-danger' : 'bg-huginn-surface text-huginn-text-secondary'
        }`}>
          {dueInfo.text}
        </span>
      )}
    </button>
  )
}
