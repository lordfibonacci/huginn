import type { Thought, ThoughtType } from '../../../shared/lib/types'
import { timeAgo, formatDueDate } from '../../../shared/lib/dateUtils'

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-huginn-danger',
  medium: 'bg-huginn-warning',
}

const TYPE_BADGE: Record<ThoughtType, string> = {
  task: 'bg-huginn-accent text-white',
  idea: 'bg-huginn-warning text-black',
  note: 'bg-huginn-success text-white',
}

interface ThoughtCardProps {
  thought: Thought
  onClick?: () => void
  projectName?: string
  projectColor?: string
}

export function ThoughtCard({ thought, onClick, projectName, projectColor }: ThoughtCardProps) {
  const dueInfo = thought.due_date ? formatDueDate(thought.due_date) : null

  return (
    <div
      className="bg-huginn-card rounded-xl p-4 mb-2.5 cursor-pointer active:bg-huginn-hover hover:bg-huginn-hover border-l-[3px] border-transparent hover:border-huginn-accent transition-all"
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
      <div className="flex items-center gap-2.5 mt-2.5 text-xs text-huginn-text-secondary flex-wrap">
        <span>{timeAgo(thought.created_at)}</span>
        {thought.type && (
          <span className={`text-[11px] font-bold uppercase tracking-wide rounded-md px-2.5 py-0.5 ${TYPE_BADGE[thought.type]}`}>
            {thought.type}
          </span>
        )}
        {thought.priority && PRIORITY_COLORS[thought.priority] && (
          <span className={`w-2.5 h-2.5 rounded-sm ${PRIORITY_COLORS[thought.priority]}`} title={thought.priority} />
        )}
        {dueInfo && (
          <span className={`font-medium ${dueInfo.urgent ? 'text-huginn-danger' : 'text-huginn-text-secondary'}`}>
            {dueInfo.text}
          </span>
        )}
        {projectName && (
          <span className="flex items-center gap-1 bg-huginn-surface/80 rounded-full px-2 py-0.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: projectColor }} />
            <span className="text-huginn-text-secondary truncate max-w-[120px]">{projectName}</span>
          </span>
        )}
      </div>
    </div>
  )
}
