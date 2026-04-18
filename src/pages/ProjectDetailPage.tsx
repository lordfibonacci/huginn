import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../shared/lib/supabase'
import {
  BoardView,
  CardPopup,
  ProjectSettingsDrawer,
  useProjects,
  useProjectTasks,
  useLists,
  useLabels,
} from '../features/projects'
import { CalendarView } from '../features/projects/components/CalendarView'
import { BoardFilterBar, applyBoardFilters, DEFAULT_FILTERS } from '../features/projects/components/BoardFilterBar'
import type { BoardFilters } from '../features/projects/components/BoardFilterBar'
import { getBackground } from '../shared/lib/boardBackgrounds'
import { InboxPanel } from '../features/inbox/components/InboxPanel'
import { useInbox } from '../features/inbox/hooks/useInbox'
import { ToolBar } from '../shared/components/ToolBar'
import { LoadingScreen } from '../shared/components/Logo'
import { ProjectGlyph } from '../features/projects/components/ProjectGlyph'
import { BoardMembersStack } from '../features/projects/components/BoardMembersStack'
import { BoardMembersDrawer } from '../features/projects/components/BoardMembersDrawer'
import type { Project, Task, Label } from '../shared/lib/types'

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [loadingProject, setLoadingProject] = useState(true)

  // Hooks
  const { updateProject, deleteProject } = useProjects()
  const { tasks, loading: loadingTasks, addTask, updateTask, deleteTask } = useProjectTasks(id ?? '')
  const { lists, loading: loadingLists, addList, updateList, archiveList } = useLists(id ?? '')
  const { labels } = useLabels(id ?? '')
  const [filters, setFilters] = useState<BoardFilters>(DEFAULT_FILTERS)

  // Fetch all task labels for this project's tasks
  const [taskLabelsMap, setTaskLabelsMap] = useState<Record<string, Label[]>>({})
  const [taskLabelVersion, setTaskLabelVersion] = useState(0)

  const fetchTaskLabels = useCallback(() => {
    if (!tasks.length || !labels.length) return
    const taskIds = tasks.map(t => t.id)
    supabase
      .from('huginn_task_labels')
      .select('task_id, label_id')
      .in('task_id', taskIds)
      .then(({ data }) => {
        if (!data) return
        const labelsById: Record<string, Label> = {}
        for (const l of labels) labelsById[l.id] = l
        const map: Record<string, Label[]> = {}
        for (const row of data as { task_id: string; label_id: string }[]) {
          if (!map[row.task_id]) map[row.task_id] = []
          if (labelsById[row.label_id]) map[row.task_id].push(labelsById[row.label_id])
        }
        setTaskLabelsMap(map)
      })
  }, [tasks, labels])

  useEffect(() => { fetchTaskLabels() }, [fetchTaskLabels, taskLabelVersion])

  // Realtime: refetch task labels on any change
  useEffect(() => {
    const channelName = `huginn_task_labels_board_${id}_${crypto.randomUUID()}`
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'huginn_task_labels' }, () => {
        setTaskLabelVersion(v => v + 1)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id])

  // Inbox
  const { cards: inboxCards, loading: loadingInbox, addCard: addInboxCard, deleteCard: deleteInboxCard, count: inboxCount } = useInbox()
  const [showInbox, setShowInbox] = useState(false)

  const filtersActive = filters.search !== '' || filters.labelIds.length > 0 || filters.priority !== null || filters.dueStatus !== 'all'
  const filteredTasks = filtersActive ? applyBoardFilters(tasks, filters) as Task[] : tasks

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

  // State
  const [view, setView] = useState<'board' | 'calendar'>('board')
  const [showSettings, setShowSettings] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  // Keep selected task in sync with latest data (could be a project task OR an inbox card)
  const currentTask = selectedTask
    ? tasks.find((t) => t.id === selectedTask.id)
      ?? inboxCards.find((c) => c.id === selectedTask.id)
      ?? selectedTask
    : null
  const selectedIsInbox = currentTask?.project_id == null

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

  async function handleAddCard(listId: string, title: string) {
    await addTask(title, listId)
  }

  function handleMoveCard(taskId: string, newListId: string) {
    updateTask(taskId, { list_id: newListId })
  }

  function handleRenameList(listId: string, name: string) {
    updateList(listId, { name })
  }

  function handleAddList(name: string) {
    addList(name)
  }

  if (loadingProject) {
    return <LoadingScreen message="Loading board" />
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
      {/* Inbox panel — pushes board to the right */}
      {showInbox && (
        <InboxPanel
          cards={inboxCards}
          loading={loadingInbox}
          onAddCard={addInboxCard}
          onDeleteCard={deleteInboxCard}
          onCardTap={(card) => setSelectedTask(card)}
          onClose={() => setShowInbox(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
      {/* Header */}
      <header className="relative flex items-center gap-3 px-5 py-3.5 border-b border-huginn-border bg-huginn-base/80 backdrop-blur-sm md:gap-4 md:px-6 md:py-4 shrink-0">
        <Link
          to="/projects"
          className="flex items-center justify-center w-9 h-9 rounded-lg text-huginn-text-muted hover:text-white hover:bg-huginn-hover transition-colors -ml-1.5"
          aria-label="Back to projects"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12l4.58-4.59Z" />
          </svg>
        </Link>

        <div className="w-px h-7 bg-huginn-border/70" aria-hidden />

        <button
          onClick={() => setShowSettings(true)}
          className="flex items-center gap-3 min-w-0 flex-1 group rounded-lg px-2 py-1.5 -mx-2 hover:bg-huginn-hover/40 transition-colors"
          title="Project settings"
        >
          <ProjectGlyph color={project.color} size={20} />
          <h1 className="text-lg font-bold tracking-tight truncate text-white group-hover:text-white">
            {project.name}
          </h1>
        </button>

        {/* View switcher */}
        <div className="flex bg-huginn-card rounded-lg p-0.5">
          <button
            onClick={() => setView('board')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
              view === 'board' ? 'bg-huginn-accent text-white shadow-sm' : 'text-huginn-text-secondary hover:text-white'
            }`}
          >
            Board
          </button>
          <button
            onClick={() => setView('calendar')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
              view === 'calendar' ? 'bg-huginn-accent text-white shadow-sm' : 'text-huginn-text-secondary hover:text-white'
            }`}
          >
            Calendar
          </button>
        </div>

        <BoardFilterBar
          filters={filters}
          onChange={setFilters}
          labels={labels}
          isActive={filtersActive}
        />

        <BoardMembersStack
          projectId={id!}
          onClick={() => setShowMembers(true)}
        />

        <button
          onClick={() => setShowSettings(true)}
          className="flex items-center justify-center w-9 h-9 rounded-lg text-huginn-text-muted hover:text-white hover:bg-huginn-hover transition-colors"
          aria-label="Project settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M8.34 1.804A1 1 0 0 1 9.32 1h1.36a1 1 0 0 1 .98.804l.295 1.473c.497.144.971.342 1.416.587l1.25-.834a1 1 0 0 1 1.262.125l.962.962a1 1 0 0 1 .125 1.262l-.834 1.25c.245.445.443.919.587 1.416l1.473.294a1 1 0 0 1 .804.98v1.362a1 1 0 0 1-.804.98l-1.473.295a6.95 6.95 0 0 1-.587 1.416l.834 1.25a1 1 0 0 1-.125 1.262l-.962.962a1 1 0 0 1-1.262.125l-1.25-.834a6.953 6.953 0 0 1-1.416.587l-.294 1.473a1 1 0 0 1-.98.804H9.32a1 1 0 0 1-.98-.804l-.295-1.473a6.957 6.957 0 0 1-1.416-.587l-1.25.834a1 1 0 0 1-1.262-.125l-.962-.962a1 1 0 0 1-.125-1.262l.834-1.25a6.957 6.957 0 0 1-.587-1.416l-1.473-.294A1 1 0 0 1 1 11.36V9.998a1 1 0 0 1 .804-.98l1.473-.295c.144-.497.342-.971.587-1.416l-.834-1.25a1 1 0 0 1 .125-1.262l.962-.962A1 1 0 0 1 5.38 3.708l1.25.834a6.957 6.957 0 0 1 1.416-.587l.294-1.473ZM13 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" clipRule="evenodd" />
          </svg>
        </button>
      </header>

      {/* Board or Calendar — with board background */}
      <div className="flex-1 flex flex-col min-h-0" style={{ background: getBackground(project.background ?? 'default').style }}>
      {view === 'board' ? (
        <BoardView
          lists={lists}
          tasks={filteredTasks}
          loading={loadingLists || loadingTasks}
          onTaskTap={setSelectedTask}
          onAddCard={handleAddCard}
          onMoveCard={handleMoveCard}
          onRenameList={handleRenameList}
          onArchiveList={archiveList}
          onAddList={handleAddList}
          selectedTaskId={currentTask?.id}
          taskLabelsMap={taskLabelsMap}
        />
      ) : (
        <CalendarView
          tasks={filteredTasks}
          onTaskTap={setSelectedTask}
        />
      )}
      </div>

      {/* Floating bottom toolbar (fixed, viewport-anchored) */}
      <ToolBar
        inboxOpen={showInbox}
        inboxCount={inboxCount}
        onToggleInbox={() => setShowInbox(!showInbox)}
        onSwitchProjects={() => navigate('/projects')}
      />

      </div>{/* end main content */}

      {/* Card popup — same component for board tasks and inbox cards */}
      {currentTask && (
        <CardPopup
          task={currentTask}
          projectId={selectedIsInbox ? '' : id!}
          lists={selectedIsInbox ? [] : lists}
          onUpdate={updateTask}
          onDelete={selectedIsInbox
            ? async (taskId) => { await deleteInboxCard(taskId); return true }
            : deleteTask}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {/* Settings drawer */}
      {showSettings && (
        <ProjectSettingsDrawer
          project={project}
          onUpdate={handleUpdateProject}
          onDelete={handleDeleteProject}
          onDone={() => setShowSettings(false)}
        />
      )}

      {/* Members drawer */}
      {showMembers && (
        <BoardMembersDrawer
          projectId={id!}
          onDone={() => setShowMembers(false)}
        />
      )}
    </div>
  )
}
