import type { Thought, Project } from '../../../shared/lib/types'
import { ThoughtCard } from './ThoughtCard'

interface ThoughtListProps {
  thoughts: Thought[]
  loading: boolean
  onThoughtTap: (thought: Thought) => void
  projectsById?: Record<string, Project>
  selectedId?: string
}

export function ThoughtList({ thoughts, loading, onThoughtTap, projectsById, selectedId }: ThoughtListProps) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-huginn-text-muted text-sm">Loading...</p>
      </div>
    )
  }

  if (thoughts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-huginn-text-muted text-sm">
          No thoughts yet. Type one below.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 md:p-4">
      {thoughts.map((thought) => {
        const project = thought.project_id && projectsById ? projectsById[thought.project_id] : undefined
        return (
          <ThoughtCard
            key={thought.id}
            thought={thought}
            onClick={() => onThoughtTap(thought)}
            projectName={project?.name}
            projectColor={project?.color}
            selected={thought.id === selectedId}
          />
        )
      })}
    </div>
  )
}
