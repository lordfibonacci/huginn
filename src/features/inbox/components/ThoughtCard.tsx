import type { Thought } from '../../../shared/lib/types'

function timeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatDueDate(dateString: string): { text: string; urgent: boolean } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dateString + 'T00:00:00')
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return { text: `${Math.abs(diffDays)}d overdue`, urgent: true }
  if (diffDays === 0) return { text: 'due today', urgent: true }
  if (diffDays === 1) return { text: 'due tomorrow', urgent: false }
  if (diffDays <= 7) return { text: `due in ${diffDays}d`, urgent: false }

  const d = due
  const month = d.toLocaleString('en', { month: 'short' })
  return { text: `due ${month} ${d.getDate()}`, urgent: false }
}

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-[#e17055]',
  medium: 'bg-[#fdcb6e]',
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
      className="bg-[#2a2a4a] rounded-xl p-3 mb-2 cursor-pointer active:bg-[#3a3a5a] transition-colors"
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        {thought.source === 'voice' && (
          <span className="text-xs mt-0.5 shrink-0" title="Voice note">
            🎤
          </span>
        )}
        <p className="text-sm text-gray-100 whitespace-pre-wrap break-words flex-1">
          {thought.body}
        </p>
      </div>
      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 flex-wrap">
        <span>{timeAgo(thought.created_at)}</span>
        {thought.type && (
          <span className="bg-[#1a1a2e] px-2 py-0.5 rounded-full">
            {thought.type}
          </span>
        )}
        {thought.priority && PRIORITY_COLORS[thought.priority] && (
          <span className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[thought.priority]}`} title={thought.priority} />
        )}
        {dueInfo && (
          <span className={dueInfo.urgent ? 'text-[#e17055]' : 'text-gray-400'}>
            {dueInfo.text}
          </span>
        )}
        {projectName && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: projectColor }} />
            <span className="text-gray-400 truncate max-w-[100px]">{projectName}</span>
          </span>
        )}
      </div>
    </div>
  )
}
