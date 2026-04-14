import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useProjects } from '../../features/projects'
import { useTaskCounts } from '../hooks/useTaskCounts'
import { NewProjectDrawer } from '../../features/projects/components/NewProjectDrawer'
import { GlobalSearch } from './GlobalSearch'
import type { Project, ProjectStatus } from '../lib/types'

const STATUS_ORDER: { key: ProjectStatus; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'hold', label: 'On hold' },
  { key: 'idea', label: 'Idea' },
  { key: 'done', label: 'Done' },
]

export function Sidebar() {
  const { pathname } = useLocation()
  const { signOut } = useAuth()
  const { projects, addProject } = useProjects()
  const { counts: taskCounts } = useTaskCounts()
  const [showNewProject, setShowNewProject] = useState(false)

  const pinned = projects.filter((p) => p.pinned)
  const unpinned = projects.filter((p) => !p.pinned)

  const groups = STATUS_ORDER.map(({ key, label }) => ({
    label,
    items: unpinned.filter((p) => p.status === key),
  })).filter((g) => g.items.length > 0)

  function isProjectActive(project: Project) {
    return pathname === `/projects/${project.id}`
  }

  function ProjectRow({ project }: { project: Project }) {
    const active = isProjectActive(project)
    const count = taskCounts[project.id] || 0
    return (
      <Link
        to={`/projects/${project.id}`}
        className={`flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg mx-2 transition-colors ${
          active
            ? 'bg-huginn-accent text-white'
            : 'text-gray-400 hover:bg-huginn-card hover:text-gray-200'
        }`}
      >
        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
        <span className="flex-1 truncate">{project.name}</span>
        {count > 0 && (
          <span className={`text-xs ${active ? 'text-white/70' : 'text-huginn-text-muted'}`}>{count}</span>
        )}
      </Link>
    )
  }

  return (
    <>
      <aside className="w-64 border-r border-huginn-border flex flex-col bg-huginn-base">
        {/* App name */}
        <div className="px-4 pt-5 pb-3">
          <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-huginn-accent to-[#a78bfa] bg-clip-text text-transparent">
            Huginn
          </h1>
        </div>

        {/* Search */}
        <div className="px-3 mb-3">
          <GlobalSearch />
        </div>

        {/* Projects section */}
        <div className="flex items-center justify-between px-4 mt-3 mb-2">
          <span className="text-xs font-bold uppercase tracking-widest text-huginn-accent">Projects</span>
          <button
            onClick={() => setShowNewProject(true)}
            className="text-gray-500 hover:text-white hover:bg-huginn-card rounded-md p-1 transition-colors"
            title="New project"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M10 3a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H4a1 1 0 1 1 0-2h5V4a1 1 0 0 1 1-1Z" />
            </svg>
          </button>
        </div>

        {/* Project list */}
        <div className="flex-1 overflow-y-auto pb-2">
          {pinned.length > 0 && (
            <div className="mb-2">
              {pinned.map((p) => (
                <ProjectRow key={p.id} project={p} />
              ))}
            </div>
          )}

          {groups.map((group) => (
            <div key={group.label} className="mb-2">
              {(groups.length > 1 || pinned.length > 0) && (
                <p className="text-[11px] font-semibold uppercase tracking-wider text-huginn-text-muted px-4 mb-1">{group.label}</p>
              )}
              {group.items.map((p) => (
                <ProjectRow key={p.id} project={p} />
              ))}
            </div>
          ))}

          {projects.length === 0 && (
            <p className="text-xs text-huginn-text-muted px-4 py-2">No projects yet</p>
          )}
        </div>

        {/* Bottom */}
        <div className="border-t border-huginn-border px-4 py-3">
          <button
            onClick={signOut}
            className="text-xs text-gray-500 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {showNewProject && (
        <NewProjectDrawer
          onSave={async (name, color, status) => { await addProject(name, color, status) }}
          onDone={() => setShowNewProject(false)}
        />
      )}
    </>
  )
}
