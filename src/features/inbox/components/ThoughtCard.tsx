import type { Thought } from '../../../shared/lib/types'
import { timeAgo, formatDueDate } from '../../../shared/lib/dateUtils'

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-huginn-danger',
  medium: 'bg-huginn-warning',
}

interface ThoughtCardProps {
  thought: Thought
  onClick?: () => void
  projectName?: string
  projectColor?: string
  selected?: boolean
}

export function ThoughtCard({ thought, onClick, projectName, projectColor, selected }: ThoughtCardProps) {
  const dueInfo = thought.due_date ? formatDueDate(thought.due_date) : null

  return (
    <div
      className={`rounded-lg p-4 mb-2 cursor-pointer transition-colors ${
        selected
          ? 'bg-huginn-accent/10 ring-1 ring-huginn-accent'
          : 'bg-huginn-card hover:bg-huginn-hover'
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        {thought.source === 'voice' && (
          <span className="text-xs mt-0.5 shrink-0" title="Voice note">
            🎤
          </span>
        )}
        <p className="text-sm text-huginn-text-primary whitespace-pre-wrap break-words flex-1 leading-relaxed">
          {thought.body}
        </p>
      </div>
      <div className="flex items-center gap-2 mt-2 text-xs text-huginn-text-secondary flex-wrap">
        <span>{timeAgo(thought.created_at)}</span>
        {thought.priority && PRIORITY_COLORS[thought.priority] && (
          <span className={`w-2 h-2 rounded-sm ${PRIORITY_COLORS[thought.priority]}`} title={thought.priority} />
        )}
        {dueInfo && (
          <span className={`font-medium ${dueInfo.urgent ? 'text-huginn-danger' : 'text-huginn-text-secondary'}`}>
            {dueInfo.text}
          </span>
        )}
        {projectName && (
          <span className="flex items-center gap-1 text-huginn-text-muted">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: projectColor }} />
            <span className="truncate max-w-[120px]">{projectName}</span>
          </span>
        )}
      </div>
    </div>
  )
}
