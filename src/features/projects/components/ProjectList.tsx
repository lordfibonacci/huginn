import type { Project, ProjectStatus } from '../../../shared/lib/types'
import { ProjectCard } from './ProjectCard'

interface ProjectListProps {
  projects: Project[]
  loading: boolean
  onProjectTap: (project: Project) => void
}

const STATUS_ORDER: { key: ProjectStatus; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'hold', label: 'On hold' },
  { key: 'idea', label: 'Idea' },
  { key: 'done', label: 'Done' },
]

export function ProjectList({ projects, loading, onProjectTap }: ProjectListProps) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500 text-sm">No projects yet. Tap + to create one.</p>
      </div>
    )
  }

  const grouped = STATUS_ORDER.map(({ key, label }) => ({
    label,
    items: projects.filter((p) => p.status === key),
  })).filter((g) => g.items.length > 0)

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2 md:px-6">
      <div className="max-w-2xl">
      {grouped.map((group) => (
        <div key={group.label} className="mb-4">
          <h2 className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2 px-1">
            {group.label}
          </h2>
          {group.items.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => onProjectTap(project)}
            />
          ))}
        </div>
      ))}
      </div>
    </div>
  )
}
