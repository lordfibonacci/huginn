import { useTranslation } from 'react-i18next'
import type { Profile, Project } from '../../../shared/lib/types'
import { ProjectGlyph } from './ProjectGlyph'
import { Avatar } from '../../../shared/components/Avatar'
import { getBackground } from '../../../shared/lib/boardBackgrounds'

interface ProjectCardProps {
  project: Project
  taskCount?: number
  sharedWith?: Profile[]
  onClick?: () => void
}

export function ProjectCard({ project, taskCount, sharedWith, onClick }: ProjectCardProps) {
  const { t } = useTranslation()
  const bg = getBackground(project.background ?? 'default')
  const visibleAvatars = sharedWith?.slice(0, 3) ?? []
  const overflow = (sharedWith?.length ?? 0) - visibleAvatars.length

  return (
    <button
      onClick={onClick}
      className="group relative h-32 w-full text-left rounded-xl overflow-hidden border border-huginn-border/60 hover:border-huginn-border transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/30 focus:outline-none focus:ring-2 focus:ring-huginn-accent/60"
      style={{ background: bg.style }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent pointer-events-none" />

      <div className="relative h-full flex flex-col justify-between p-3.5">
        <div className="flex items-start justify-between gap-2">
          <ProjectGlyph color={project.color} size={18} />
          <div className="flex items-center gap-1.5">
            {visibleAvatars.length > 0 && (
              <div
                className="flex -space-x-1.5"
                title={t('projects.card.sharedWith', { count: sharedWith?.length ?? 0 })}
              >
                {visibleAvatars.map((p) => (
                  <Avatar
                    key={p.id}
                    url={p.avatar_url}
                    name={p.display_name}
                    email={p.email}
                    size={20}
                    className="ring-2 ring-black/30"
                  />
                ))}
                {overflow > 0 && (
                  <span className="ring-2 ring-black/30 rounded-full bg-black/50 text-white/90 text-[9px] font-bold flex items-center justify-center" style={{ width: 20, height: 20 }}>
                    +{overflow}
                  </span>
                )}
              </div>
            )}
            {project.status !== 'active' && (
              <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-black/40 text-white/80 backdrop-blur-sm">
                {t(`projects.status.${project.status}`)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-end justify-between gap-2">
          <h3 className="text-sm font-bold text-white leading-tight line-clamp-2 drop-shadow-sm">
            {project.name}
          </h3>
          {typeof taskCount === 'number' && taskCount > 0 && (
            <span className="text-[11px] font-semibold text-white/85 bg-white/10 backdrop-blur-sm px-2 py-0.5 rounded-full shrink-0">
              {taskCount}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
