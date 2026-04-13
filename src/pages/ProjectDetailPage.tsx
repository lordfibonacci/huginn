import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../shared/lib/supabase'
import {
  ProjectTabs,
  TaskList,
  TaskDetailDrawer,
  TaskDetailPanel,
  ProjectSettingsDrawer,
  useProjects,
  useProjectTasks,
} from '../features/projects'
import { ThoughtCard } from '../features/inbox/components/ThoughtCard'
import { ThoughtDetailDrawer } from '../features/inbox/components/ThoughtDetailDrawer'
import { useThoughts } from '../features/inbox'
import type { Project, Task, Thought } from '../shared/lib/types'

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [loadingProject, setLoadingProject] = useState(true)
  const [activeTab, setActiveTab] = useState<'tasks' | 'thoughts'>('tasks')

  // Hooks
  const { updateProject, deleteProject } = useProjects()
  const { tasks, loading: loadingTasks, addTask, updateTask, deleteTask } = useProjectTasks(id ?? '')
  const { updateThought, deleteThought, archiveThought, convertToTask } = useThoughts()

  // Thoughts for this project
  const [thoughts, setThoughts] = useState<Thought[]>([])
  const [loadingThoughts, setLoadingThoughts] = useState(true)

  const fetchProjectThoughts = useCallback(async () => {
    if (!id) return
    const { data, error } = await supabase
      .from('huginn_thoughts')
      .select('*')
      .eq('project_id', id)
      .neq('status', 'archived')
      .order('created_at', { ascending: false })

    if (!error && data) setThoughts(data as Thought[])
    setLoadingThoughts(false)
  }, [id])

  useEffect(() => {
    fetchProjectThoughts()
  }, [fetchProjectThoughts])

  useEffect(() => {
    if (!id) return
    const channelName = `huginn_thoughts_project_${id}_${crypto.randomUUID()}`
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'huginn_thoughts', filter: `project_id=eq.${id}` }, () => {
        fetchProjectThoughts()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id, fetchProjectThoughts])

  useEffect(() => {
    if (!id) return
    supabase
      .from('huginn_projects')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (!error) setProject(data as Project)
        setLoadingProject(false)
      })
  }, [id])

  // Selection state
  const [showSettings, setShowSettings] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [editingThought, setEditingThought] = useState<Thought | null>(null)

  // Keep editing task in sync with latest data
  const currentEditingTask = editingTask
    ? tasks.find((t) => t.id === editingTask.id) ?? editingTask
    : null

  async function handleDeleteProject(projectId: string) {
    const success = await deleteProject(projectId)
    if (success) navigate('/projects')
    return success
  }

  async function handleUpdateProject(projectId: string, updates: { name?: string; description?: string | null; color?: string; status?: any }) {
    const success = await updateProject(projectId, updates)
    if (success && project) {
      setProject({ ...project, ...updates })
    }
    return success
  }

  if (loadingProject) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-huginn-text-muted text-sm">Loading...</p>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-huginn-text-muted text-sm">Project not found.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 min-h-0">
      {/* Left: project content */}
      <div className={`flex flex-col min-h-0 ${currentEditingTask && activeTab === 'tasks' ? 'hidden md:flex md:flex-1' : 'flex-1'}`}>
        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-huginn-border md:px-5">
          <Link to="/projects" className="text-huginn-text-muted hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12l4.58-4.59Z" />
            </svg>
          </Link>
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
          <h1 className="text-lg font-bold flex-1">{project.name}</h1>
          <button onClick={() => setShowSettings(true)} className="text-huginn-text-muted hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M8.34 1.804A1 1 0 0 1 9.32 1h1.36a1 1 0 0 1 .98.804l.295 1.473c.497.144.971.342 1.416.587l1.25-.834a1 1 0 0 1 1.262.125l.962.962a1 1 0 0 1 .125 1.262l-.834 1.25c.245.445.443.919.587 1.416l1.473.294a1 1 0 0 1 .804.98v1.362a1 1 0 0 1-.804.98l-1.473.295a6.95 6.95 0 0 1-.587 1.416l.834 1.25a1 1 0 0 1-.125 1.262l-.962.962a1 1 0 0 1-1.262.125l-1.25-.834a6.953 6.953 0 0 1-1.416.587l-.294 1.473a1 1 0 0 1-.98.804H9.32a1 1 0 0 1-.98-.804l-.295-1.473a6.957 6.957 0 0 1-1.416-.587l-1.25.834a1 1 0 0 1-1.262-.125l-.962-.962a1 1 0 0 1-.125-1.262l.834-1.25a6.957 6.957 0 0 1-.587-1.416l-1.473-.294A1 1 0 0 1 1 11.36V9.998a1 1 0 0 1 .804-.98l1.473-.295c.144-.497.342-.971.587-1.416l-.834-1.25a1 1 0 0 1 .125-1.262l.962-.962A1 1 0 0 1 5.38 3.708l1.25.834a6.957 6.957 0 0 1 1.416-.587l.294-1.473ZM13 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" clipRule="evenodd" />
            </svg>
          </button>
        </header>

        {/* Tabs */}
        <ProjectTabs activeTab={activeTab} onTabChange={(tab) => { setActiveTab(tab); setEditingTask(null); setEditingThought(null) }} />

        {/* Tab content */}
        {activeTab === 'thoughts' && (
          <div className="flex-1 overflow-y-auto p-4 md:p-5">
            {loadingThoughts ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-huginn-text-muted text-sm">Loading...</p>
              </div>
            ) : thoughts.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-huginn-text-muted text-sm">No thoughts filed to this project yet.</p>
              </div>
            ) : (
              thoughts.map((t) => (
                <ThoughtCard key={t.id} thought={t} onClick={() => setEditingThought(t)} />
              ))
            )}
          </div>
        )}

        {activeTab === 'tasks' && (
          <TaskList
            tasks={tasks}
            loading={loadingTasks}
            onTaskTap={setEditingTask}
            onStatusChange={(taskId, status) => updateTask(taskId, { status })}
            onAddTask={async (title) => { await addTask(title) }}
            selectedTaskId={currentEditingTask?.id}
          />
        )}
      </div>

      {/* Right: task detail panel (desktop only) */}
      {currentEditingTask && activeTab === 'tasks' && (
        <div className="hidden md:flex md:w-[400px] lg:w-[450px] border-l border-huginn-border bg-huginn-surface">
          <div className="flex-1">
            <TaskDetailPanel
              task={currentEditingTask}
              projectId={id!}
              onUpdate={updateTask}
              onDelete={deleteTask}
              onClose={() => setEditingTask(null)}
            />
          </div>
        </div>
      )}

      {/* Mobile: task detail drawer */}
      {currentEditingTask && activeTab === 'tasks' && (
        <div className="md:hidden">
          <TaskDetailDrawer
            task={currentEditingTask}
            onUpdate={updateTask}
            onDelete={deleteTask}
            onDone={() => setEditingTask(null)}
          />
        </div>
      )}

      {/* Drawers */}
      {showSettings && (
        <ProjectSettingsDrawer
          project={project}
          onUpdate={handleUpdateProject}
          onDelete={handleDeleteProject}
          onDone={() => setShowSettings(false)}
        />
      )}
      {editingThought && (
        <ThoughtDetailDrawer
          thought={editingThought}
          onUpdate={updateThought}
          onDelete={deleteThought}
          onArchive={archiveThought}
          onConvertToTask={convertToTask}
          onDone={() => setEditingThought(null)}
        />
      )}
    </div>
  )
}
