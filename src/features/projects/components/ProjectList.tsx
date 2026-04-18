import type { Project, ProjectStatus } from '../../../shared/lib/types'
import { ProjectCard } from './ProjectCard'
import { PendingInvitesPanel } from './PendingInvitesPanel'
import { LoadingScreen, EmptyState } from '../../../shared/components/Logo'
import { useTaskCounts } from '../../../shared/hooks/useTaskCounts'
import { usePendingInvites } from '../hooks/usePendingInvites'

interface ProjectListProps {
  projects: Project[]
  loading: boolean
  onProjectTap: (project: Project) => void
  onCreateProject?: () => void
}

const STATUS_ORDER: { key: ProjectStatus; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'hold', label: 'On hold' },
  { key: 'idea', label: 'Idea' },
  { key: 'done', label: 'Done' },
]

export function ProjectList({ projects, loading, onProjectTap, onCreateProject }: ProjectListProps) {
  const { counts } = useTaskCounts()
  const { count: invitesCount } = usePendingInvites()

  if (loading) {
    return <LoadingScreen message="Loading projects" />
  }

  if (projects.length === 0 && invitesCount === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <EmptyState
          title="No projects yet"
          hint="Create your first board to get started."
        />
        {onCreateProject && (
          <button
            onClick={onCreateProject}
            className="mt-4 inline-flex items-center gap-2 bg-huginn-accent hover:bg-huginn-accent-hover text-white text-sm font-semibold rounded-lg px-5 py-2.5 shadow-md shadow-huginn-accent/30 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M10 3a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H4a1 1 0 1 1 0-2h5V4a1 1 0 0 1 1-1Z" />
            </svg>
            Create your first board
          </button>
        )}
      </div>
    )
  }

  const grouped = STATUS_ORDER.map(({ key, label }) => ({
    label,
    items: projects.filter((p) => p.status === key),
  })).filter((g) => g.items.length > 0)

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <PendingInvitesPanel />
        {projects.length === 0 && onCreateProject && (
          <div className="flex flex-col items-center justify-center py-10">
            <EmptyState
              title="No projects yet"
              hint="Create your first board, or accept an invitation above."
            />
            <button
              onClick={onCreateProject}
              className="mt-4 inline-flex items-center gap-2 bg-huginn-accent hover:bg-huginn-accent-hover text-white text-sm font-semibold rounded-lg px-5 py-2.5 shadow-md shadow-huginn-accent/30 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M10 3a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H4a1 1 0 1 1 0-2h5V4a1 1 0 0 1 1-1Z" />
              </svg>
              Create a board
            </button>
          </div>
        )}
        {grouped.map((group, groupIdx) => (
          <section key={group.label} className="mb-8">
            <h2 className="text-[11px] uppercase tracking-widest text-huginn-text-secondary font-semibold mb-3 px-0.5">
              {group.label}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {group.items.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  taskCount={counts[project.id]}
                  onClick={() => onProjectTap(project)}
                />
              ))}
              {groupIdx === 0 && onCreateProject && (
                <NewProjectTile onClick={onCreateProject} />
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function NewProjectTile({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="h-32 w-full rounded-xl border border-dashed border-huginn-border bg-huginn-card/40 hover:bg-huginn-card hover:border-huginn-accent/60 transition-colors flex flex-col items-center justify-center gap-1.5 text-huginn-text-muted hover:text-huginn-text-primary group"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 group-hover:text-huginn-accent transition-colors">
        <path d="M10 3a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H4a1 1 0 1 1 0-2h5V4a1 1 0 0 1 1-1Z" />
      </svg>
      <span className="text-xs font-medium">New board</span>
    </button>
  )
}
