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

interface ThoughtCardProps {
  thought: Thought
  onClick?: () => void
}

export function ThoughtCard({ thought, onClick }: ThoughtCardProps) {
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
      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
        <span>{timeAgo(thought.created_at)}</span>
        {thought.type && (
          <span className="bg-[#1a1a2e] px-2 py-0.5 rounded-full">
            {thought.type}
          </span>
        )}
      </div>
    </div>
  )
}
