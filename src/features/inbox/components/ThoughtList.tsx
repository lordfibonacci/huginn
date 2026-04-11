import type { Thought } from '../../../shared/lib/types'
import { ThoughtCard } from './ThoughtCard'

interface ThoughtListProps {
  thoughts: Thought[]
  loading: boolean
}

export function ThoughtList({ thoughts, loading }: ThoughtListProps) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    )
  }

  if (thoughts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500 text-sm">
          No thoughts yet. Type one below.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2">
      {thoughts.map((thought) => (
        <ThoughtCard key={thought.id} thought={thought} />
      ))}
    </div>
  )
}
