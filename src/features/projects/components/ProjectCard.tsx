import type { Project } from '../../../shared/lib/types'

interface ProjectCardProps {
  project: Project
  onClick?: () => void
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  return (
    <div
      className="flex items-center gap-3 bg-huginn-card rounded-xl px-4 py-3 mb-2 cursor-pointer active:bg-huginn-hover transition-colors"
      onClick={onClick}
    >
      <div
        className="w-3 h-3 rounded-full shrink-0"
        style={{ backgroundColor: project.color }}
      />
      <span className="text-sm text-gray-100 flex-1">{project.name}</span>
      {project.status !== 'active' && (
        <span className="text-xs text-gray-500">{project.status}</span>
      )}
    </div>
  )
}
