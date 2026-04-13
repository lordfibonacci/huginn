import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../shared/hooks/useAuth'
import { ProjectList, NewProjectDrawer, useProjects } from '../features/projects'
import type { Project } from '../shared/lib/types'

export function ProjectsPage() {
  const { signOut } = useAuth()
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
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-huginn-border md:px-6">
        <div>
          <h1 className="text-lg font-extrabold tracking-tight">Projects</h1>
          <p className="text-xs text-huginn-text-secondary">
            {count} project{count !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={signOut}
          className="text-xs text-gray-500 hover:text-white md:hidden"
        >
          Sign out
        </button>
      </header>

      {/* Project list */}
      <ProjectList
        projects={projects}
        loading={loading}
        onProjectTap={handleProjectTap}
      />

      {/* Floating + button */}
      <button
        onClick={() => setShowNewProject(true)}
        className="absolute bottom-20 right-4 w-12 h-12 bg-huginn-accent rounded-full flex items-center justify-center shadow-lg active:bg-huginn-accent-hover transition-colors"
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
