import type { Project } from '../../../shared/lib/types'

interface ProjectCardProps {
  project: Project
  onClick?: () => void
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  return (
    <div
      className="flex items-center gap-3 bg-huginn-card rounded-lg px-4 py-3 mb-2 cursor-pointer hover:bg-huginn-hover transition-colors"
      onClick={onClick}
    >
      <div
        className="w-4 h-4 rounded-full shrink-0"
        style={{ backgroundColor: project.color }}
      />
      <span className="text-sm text-huginn-text-primary flex-1">{project.name}</span>
      {project.status !== 'active' && (
        <span className="bg-huginn-surface text-huginn-text-secondary text-[11px] rounded-md px-2 py-0.5">
          {project.status}
        </span>
      )}
    </div>
  )
}
