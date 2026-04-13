import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../shared/lib/supabase'
import {
  ProjectTabs,
  TaskList,
  TaskDetailDrawer,
  NewTaskDrawer,
  NoteList,
  NoteDetailDrawer,
  NewNoteDrawer,
  ProjectSettingsDrawer,
  useProjects,
  useProjectTasks,
  useProjectNotes,
} from '../features/projects'
import { ThoughtCard } from '../features/inbox/components/ThoughtCard'
import { ThoughtDetailDrawer } from '../features/inbox/components/ThoughtDetailDrawer'
import { useThoughts } from '../features/inbox'
import type { Project, Task, Note, Thought } from '../shared/lib/types'

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [loadingProject, setLoadingProject] = useState(true)
  const [activeTab, setActiveTab] = useState<'thoughts' | 'tasks' | 'notes'>('tasks')

  // Hooks
  const { updateProject, deleteProject } = useProjects()
  const { tasks, loading: loadingTasks, addTask, updateTask, deleteTask } = useProjectTasks(id ?? '')
  const { notes, loading: loadingNotes, addNote, updateNote, deleteNote } = useProjectNotes(id ?? '')
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

  // Fetch project
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

  // Drawer state
  const [showSettings, setShowSettings] = useState(false)
  const [showNewTask, setShowNewTask] = useState(false)
  const [showNewNote, setShowNewNote] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [editingThought, setEditingThought] = useState<Thought | null>(null)

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
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Project not found.</p>
      </div>
    )
  }

  const showFab = activeTab === 'tasks' || activeTab === 'notes'

  return (
    <>
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-huginn-border">
        <Link to="/projects" className="text-gray-400 hover:text-white">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12l4.58-4.59Z" />
          </svg>
        </Link>
        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
        <h1 className="text-lg font-bold flex-1">{project.name}</h1>
        <button onClick={() => setShowSettings(true)} className="text-gray-400 hover:text-white">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M12 8.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5ZM9.25 12a2.75 2.75 0 1 1 5.5 0 2.75 2.75 0 0 1-5.5 0Z" />
            <path d="M11.98 2a1.27 1.27 0 0 0-1.26 1.1l-.17 1.2a.86.86 0 0 1-.53.64 7.9 7.9 0 0 0-1.1.46.86.86 0 0 1-.82-.05l-1.02-.65a1.27 1.27 0 0 0-1.67.2l-.04.04a1.27 1.27 0 0 0-.2 1.67l.65 1.02c.15.24.16.54.05.82a7.9 7.9 0 0 0-.46 1.1.86.86 0 0 1-.64.53l-1.2.17A1.27 1.27 0 0 0 2 11.98v.04c0 .63.47 1.17 1.1 1.26l1.2.17c.28.04.52.24.64.53.13.38.28.74.46 1.1.11.28.1.58-.05.82l-.65 1.02a1.27 1.27 0 0 0 .2 1.67l.04.04c.44.44 1.15.52 1.67.2l1.02-.65a.86.86 0 0 1 .82-.05c.36.18.72.33 1.1.46.29.1.49.36.53.64l.17 1.2c.09.63.63 1.1 1.26 1.1h.04c.63 0 1.17-.47 1.26-1.1l.17-1.2a.86.86 0 0 1 .53-.64c.38-.13.74-.28 1.1-.46a.86.86 0 0 1 .82.05l1.02.65c.52.32 1.23.24 1.67-.2l.04-.04c.44-.44.52-1.15.2-1.67l-.65-1.02a.86.86 0 0 1-.05-.82c.18-.36.33-.72.46-1.1.1-.29.36-.49.64-.53l1.2-.17c.63-.09 1.1-.63 1.1-1.26v-.04c0-.63-.47-1.17-1.1-1.26l-1.2-.17a.86.86 0 0 1-.64-.53 7.9 7.9 0 0 0-.46-1.1.86.86 0 0 1 .05-.82l.65-1.02a1.27 1.27 0 0 0-.2-1.67l-.04-.04a1.27 1.27 0 0 0-1.67-.2l-1.02.65a.86.86 0 0 1-.82.05 7.9 7.9 0 0 0-1.1-.46.86.86 0 0 1-.53-.64l-.17-1.2A1.27 1.27 0 0 0 12.02 2h-.04Z" />
          </svg>
        </button>
      </header>

      {/* Tabs */}
      <ProjectTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab content */}
      {activeTab === 'thoughts' && (
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {loadingThoughts ? (
            <div className="flex-1 flex items-center justify-center py-12">
              <p className="text-gray-500 text-sm">Loading...</p>
            </div>
          ) : thoughts.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-12">
              <p className="text-gray-500 text-sm">No thoughts filed to this project yet.</p>
            </div>
          ) : (
            thoughts.map((t) => (
              <ThoughtCard key={t.id} thought={t} onClick={() => setEditingThought(t)} />
            ))
          )}
        </div>
      )}

      {activeTab === 'tasks' && (
        <TaskList tasks={tasks} loading={loadingTasks} onTaskTap={setEditingTask} onStatusChange={(id, status) => updateTask(id, { status })} />
      )}

      {activeTab === 'notes' && (
        <NoteList notes={notes} loading={loadingNotes} onNoteTap={setEditingNote} />
      )}

      {/* FAB */}
      {showFab && (
        <button
          onClick={() => activeTab === 'tasks' ? setShowNewTask(true) : setShowNewNote(true)}
          className="absolute bottom-20 right-4 w-12 h-12 bg-huginn-accent rounded-full flex items-center justify-center shadow-lg active:bg-huginn-accent-hover transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
            <path d="M12 4a1 1 0 0 1 1 1v6h6a1 1 0 1 1 0 2h-6v6a1 1 0 1 1-2 0v-6H5a1 1 0 1 1 0-2h6V5a1 1 0 0 1 1-1Z" />
          </svg>
        </button>
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
      {showNewTask && (
        <NewTaskDrawer
          onSave={async (title) => { await addTask(title) }}
          onDone={() => setShowNewTask(false)}
        />
      )}
      {editingTask && (
        <TaskDetailDrawer
          task={editingTask}
          onUpdate={updateTask}
          onDelete={deleteTask}
          onDone={() => setEditingTask(null)}
        />
      )}
      {showNewNote && (
        <NewNoteDrawer
          onSave={async (title, body) => { await addNote(title, body) }}
          onDone={() => setShowNewNote(false)}
        />
      )}
      {editingNote && (
        <NoteDetailDrawer
          note={editingNote}
          onUpdate={updateNote}
          onDelete={deleteNote}
          onDone={() => setEditingNote(null)}
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
    </>
  )
}
