import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ProjectList, NewProjectDrawer, useProjects } from '../features/projects'
import { Mark, Wordmark } from '../shared/components/Logo'
import type { Project } from '../shared/lib/types'

export function ProjectsPage() {
  const { t } = useTranslation()
  const { projects, loading, addProject, count } = useProjects()
  const [showNewProject, setShowNewProject] = useState(false)
  const navigate = useNavigate()

  function handleProjectTap(project: Project) {
    navigate(`/projects/${project.id}`)
  }

  async function handleSave(name: string, color: string, status: 'idea' | 'active' | 'hold' | 'done') {
    await addProject(name, color, status)
  }

  return (
    <>
      {/* Mobile header only — desktop nav is in GlobalTopBar. */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-huginn-border gap-4 md:hidden">
        <div className="flex items-center gap-3 shrink-0">
          <Mark size={32} />
          <div className="flex flex-col">
            <Wordmark height={20} />
            <p className="text-[11px] text-huginn-text-secondary mt-0.5">
              {count === 1 ? t('projects.header.countOne', { count }) : t('projects.header.countOther', { count })}
            </p>
          </div>
        </div>
      </header>

      {/* Project list */}
      <ProjectList
        projects={projects}
        loading={loading}
        onProjectTap={handleProjectTap}
        onCreateProject={() => setShowNewProject(true)}
      />

      {/* Mobile-only floating + (desktop uses inline tile in the grid) */}
      <button
        onClick={() => setShowNewProject(true)}
        className="md:hidden absolute bottom-20 right-4 w-12 h-12 bg-huginn-accent rounded-full flex items-center justify-center shadow-lg active:bg-huginn-accent-hover transition-colors"
        aria-label={t('projects.actions.newProject')}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
          <path d="M12 4a1 1 0 0 1 1 1v6h6a1 1 0 1 1 0 2h-6v6a1 1 0 1 1-2 0v-6H5a1 1 0 1 1 0-2h6V5a1 1 0 0 1 1-1Z" />
        </svg>
      </button>

      {/* New project drawer */}
      {showNewProject && (
        <NewProjectDrawer
          onSave={handleSave}
          onDone={() => setShowNewProject(false)}
        />
      )}
    </>
  )
}
