import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../shared/lib/supabase'
import { DndContext, DragOverlay, PointerSensor, closestCorners, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import {
  BoardView,
  CardPopup,
  ProjectSettingsDrawer,
  useProjects,
  useProjectTasks,
  useLists,
  useLabels,
} from '../features/projects'
import { TaskCard } from '../features/projects/components/TaskCard'
import { CalendarView } from '../features/projects/components/CalendarView'
import { BoardFilterBar, applyBoardFilters, DEFAULT_FILTERS } from '../features/projects/components/BoardFilterBar'
import type { BoardFilters } from '../features/projects/components/BoardFilterBar'
import { getBackground } from '../shared/lib/boardBackgrounds'
import { InboxPanel, INBOX_DROPPABLE_ID } from '../features/inbox/components/InboxPanel'
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
  const { tasks, loading: loadingTasks, addTask, updateTask, deleteTask, removeTaskLocal, archiveTask, copyTask, moveTaskToBoard } = useProjectTasks(id ?? '')
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

  // Board-level cover image map: first image attachment per task (prefer is_cover).
  const [coverImageMap, setCoverImageMap] = useState<Record<string, string>>({})
  const [coverVersion, setCoverVersion] = useState(0)

  const fetchCoverImages = useCallback(() => {
    if (!tasks.length) { setCoverImageMap({}); return }
    const taskIds = tasks.map(t => t.id)
    supabase
      .from('huginn_attachments')
      .select('task_id, url, type, is_cover, created_at')
      .in('task_id', taskIds)
      .eq('type', 'image')
      .order('is_cover', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!data) return
        const map: Record<string, string> = {}
        for (const row of data as { task_id: string; url: string }[]) {
          if (!map[row.task_id]) map[row.task_id] = row.url
        }
        setCoverImageMap(map)
      })
  }, [tasks])

  useEffect(() => { fetchCoverImages() }, [fetchCoverImages, coverVersion])

  useEffect(() => {
    const channelName = `huginn_attachments_board_${id}_${crypto.randomUUID()}`
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'huginn_attachments' }, () => {
        setCoverVersion(v => v + 1)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id])

  // Inbox
  const { cards: inboxCards, loading: loadingInbox, addCard: addInboxCard, deleteCard: deleteInboxCard, count: inboxCount } = useInbox()
  const [showInbox, setShowInbox] = useState(false)

  const filtersActive = filters.search !== '' || filters.labelIds.length > 0 || filters.priority !== null || filters.dueStatus !== 'all'

  // Local optimistic copy of tasks so dnd-kit's sortable can reorder live
  // during a drag without waiting on the server. Synced from server-truth
  // (`tasks`) whenever a drag is NOT in progress.
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks)
  const isDraggingRef = useRef(false)
  useEffect(() => {
    if (!isDraggingRef.current) {
      setLocalTasks([...tasks].sort((a, b) => {
        if ((a.list_id ?? '') !== (b.list_id ?? '')) return 0
        return (a.position ?? 0) - (b.position ?? 0)
      }))
    }
  }, [tasks])

  // Preview slot for an incoming inbox card during drag. When set, a phantom
  // task is injected into localTasks at the hover position so the destination
  // list's SortableContext animates cards out of the way (same visual as a
  // normal cross-list reorder).
  const INBOX_PREVIEW_ID = '__inbox_preview__'
  const [inboxPreview, setInboxPreview] = useState<{ card: Task; listId: string; index: number } | null>(null)

  const tasksWithPreview = useMemo(() => {
    if (!inboxPreview) return localTasks
    const phantom: Task = {
      ...inboxPreview.card,
      id: INBOX_PREVIEW_ID,
      project_id: id ?? null,
      list_id: inboxPreview.listId,
      position: inboxPreview.index,
    }
    // Insert the phantom into its target list at the requested index, preserving
    // the rest of the array order.
    const result: Task[] = []
    let inserted = false
    let sameListCount = 0
    for (const t of localTasks) {
      if (t.list_id === inboxPreview.listId) {
        if (!inserted && sameListCount === inboxPreview.index) {
          result.push(phantom)
          inserted = true
        }
        sameListCount++
      }
      result.push(t)
    }
    if (!inserted) result.push(phantom)
    return result
  }, [localTasks, inboxPreview, id])

  const filteredTasks = filtersActive ? applyBoardFilters(tasksWithPreview, filters) as Task[] : tasksWithPreview

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

  function handleRenameList(listId: string, name: string) {
    updateList(listId, { name })
  }

  function handleAddList(name: string) {
    addList(name)
  }

  // ===== Drag-and-drop (board cards + inbox cards) =====
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [explosion, setExplosion] = useState<{ x: number; y: number } | null>(null)
  const explosionPendingRef = useRef(false)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  // Track the pointer continuously while a drag is active so we know where
  // to spawn the explosion when the 10-second easter egg fires.
  useEffect(() => {
    if (!activeTask) return
    function handlePointerMove(e: PointerEvent) {
      lastPointerRef.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('pointermove', handlePointerMove)
    return () => window.removeEventListener('pointermove', handlePointerMove)
  }, [activeTask])

  function findTaskAnywhere(taskId: string): Task | undefined {
    return localTasks.find(t => t.id === taskId) ?? inboxCards.find(c => c.id === taskId)
  }

  // Resolve the list-container that an over.id refers to.
  // - If over.id IS a list id, that's the container.
  // - If over.id is a task id (a card under the pointer), use that task's list.
  function resolveContainer(id: string): string | null {
    if (lists.some(l => l.id === id)) return id
    const task = localTasks.find(t => t.id === id)
    return task?.list_id ?? null
  }

  function handleDragStart(event: DragStartEvent) {
    isDraggingRef.current = true
    const task = findTaskAnywhere(event.active.id as string)
    setActiveTask(task ?? null)
    setInboxPreview(null)
    explosionPendingRef.current = false
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    holdTimerRef.current = setTimeout(() => {
      explosionPendingRef.current = true
      setExplosion({ ...lastPointerRef.current })
      setActiveTask(null)
    }, 10000)
  }

  function handleDragCancel() {
    isDraggingRef.current = false
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
    setActiveTask(null)
    setInboxPreview(null)
    setLocalTasks(tasks)
  }

  // Live-reorder localTasks while dragging so cards visibly slide to make room.
  // Inbox cards are NOT in localTasks — they preview-on-hover via the list ring
  // only; the actual adoption happens on drop.
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return
    const activeId = active.id as string
    const overId = over.id as string
    if (activeId === overId) return

    const activeTaskObj = localTasks.find(t => t.id === activeId)

    // Inbox card being dragged onto the board — inject a phantom preview
    // slot into the target list so the SortableContext animates cards out
    // of the way (same visual as a cross-list reorder).
    if (!activeTaskObj) {
      const inboxCard = inboxCards.find(c => c.id === activeId)
      if (!inboxCard) return
      if (overId === INBOX_DROPPABLE_ID || inboxCards.some(c => c.id === overId)) {
        setInboxPreview(null)
        return
      }
      // Hovering the phantom preview itself — keep it where it is.
      if (overId === INBOX_PREVIEW_ID) return
      const overContainer = resolveContainer(overId)
      if (!overContainer) { setInboxPreview(null); return }
      const overTask = localTasks.find(t => t.id === overId)
      const sameListTasks = localTasks.filter(t => t.list_id === overContainer)
      let index: number
      if (overTask && overTask.list_id === overContainer) {
        index = sameListTasks.indexOf(overTask)
      } else {
        index = sameListTasks.length // hovering whitespace — append at end
      }
      setInboxPreview(prev =>
        prev && prev.listId === overContainer && prev.index === index && prev.card.id === inboxCard.id
          ? prev
          : { card: inboxCard, listId: overContainer, index }
      )
      return
    }

    // Don't mutate localTasks when a BOARD card hovers the inbox panel. Removing
    // the active card from its source list mid-drag unmounts its <SortableCard>,
    // which kills the useSortable instance and makes dnd-kit lose track of
    // the active draggable — `over` becomes null on release, the drop is ignored.
    if (overId === INBOX_DROPPABLE_ID || inboxCards.some(c => c.id === overId)) {
      return
    }

    const activeContainer = activeTaskObj.list_id ?? null
    const overContainer = resolveContainer(overId)
    if (!overContainer) return

    if (activeContainer === overContainer) {
      // Same-list reorder
      const overTask = localTasks.find(t => t.id === overId)
      if (!overTask) return // hovering the list itself (whitespace) — skip
      const fromIndex = localTasks.indexOf(activeTaskObj)
      const toIndex = localTasks.indexOf(overTask)
      if (fromIndex !== toIndex) {
        setLocalTasks(prev => arrayMove(prev, fromIndex, toIndex))
      }
    } else {
      // Cross-list move
      setLocalTasks(prev => {
        const without = prev.filter(t => t.id !== activeId)
        const moved = { ...activeTaskObj, list_id: overContainer }
        const overTask = prev.find(t => t.id === overId)
        if (overTask && overTask.list_id === overContainer) {
          // Inserting just before the hovered card
          const insertAt = without.indexOf(overTask)
          without.splice(insertAt, 0, moved)
        } else {
          // Hovering empty list whitespace — append to end of that list
          const lastIndexInTarget = (() => {
            for (let i = without.length - 1; i >= 0; i--) {
              if (without[i].list_id === overContainer) return i
            }
            return -1
          })()
          without.splice(lastIndexInTarget + 1, 0, moved)
        }
        return without
      })
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    isDraggingRef.current = false
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
    setActiveTask(null)
    setInboxPreview(null)

    if (explosionPendingRef.current) {
      // Card was nuked — discard any optimistic moves
      setLocalTasks(tasks)
      return
    }

    const { active, over } = event
    if (!over) {
      setLocalTasks(tasks)
      return
    }

    const activeId = active.id as string
    const overId = over.id as string

    // Treat "over an inbox card" the same as "over the inbox panel" — both mean inbox.
    const droppedOnInbox = overId === INBOX_DROPPABLE_ID || inboxCards.some(c => c.id === overId)

    // Inbox card -> board: adopt into target list at the previewed index
    const inboxCard = inboxCards.find(c => c.id === activeId)
    if (inboxCard) {
      if (droppedOnInbox) return // dropped back on inbox itself, no-op
      const targetList = inboxPreview?.listId ?? resolveContainer(overId)
      if (!targetList) return
      const targetIndex = inboxPreview?.listId === targetList ? inboxPreview.index : 0

      // Build the new order for the target list with the inbox card inserted,
      // then persist (inbox card gets project_id + list_id + position, siblings
      // get renumbered where their index changed).
      const targetTasks = localTasks.filter(t => t.list_id === targetList)
      const newOrder = [...targetTasks]
      newOrder.splice(Math.min(targetIndex, targetTasks.length), 0, { ...inboxCard })
      const writes = newOrder
        .map((t, index): Promise<unknown> | null => {
          if (t.id === activeId) {
            return (async () => {
              const { error } = await supabase
                .from('huginn_tasks')
                .update({ project_id: id!, list_id: targetList, position: index })
                .eq('id', activeId)
              if (error) console.error('Move inbox -> project failed:', error)
            })()
          }
          const orig = tasks.find(o => o.id === t.id)
          if (orig && orig.position !== index) {
            return updateTask(t.id, { position: index })
          }
          return null
        })
        .filter((p): p is Promise<unknown> => p !== null)
      await Promise.all(writes)
      // The inbox hook's unfiltered realtime + useProjectTasks refetch will pull the card in;
      // useInbox will drop it from its cards array on the next UPDATE event.
      return
    }

    // Board card -> inbox: detach from project + list, take ownership
    if (droppedOnInbox) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error } = await supabase
        .from('huginn_tasks')
        .update({ project_id: null, list_id: null, user_id: user.id, position: 0 })
        .eq('id', activeId)
      if (error) {
        console.error('Move-to-inbox failed:', error)
        setLocalTasks(tasks)
        return
      }
      // Renumber the source list (gap left by the removed card)
      const sourceListId = tasks.find(t => t.id === activeId)?.list_id
      if (sourceListId) {
        const remaining = localTasks.filter(t => t.list_id === sourceListId)
        const writes = remaining.flatMap((t, index) => {
          const orig = tasks.find(o => o.id === t.id)
          return orig && orig.position !== index ? [updateTask(t.id, { position: index })] : []
        })
        await Promise.all(writes)
      }
      return
    }

    // Board card: persist new list_id + position for any tasks whose slot changed
    const movedTask = localTasks.find(t => t.id === activeId)
    if (!movedTask) return

    const originalTask = tasks.find(t => t.id === activeId)
    const affectedLists = new Set<string>()
    if (movedTask.list_id) affectedLists.add(movedTask.list_id)
    if (originalTask?.list_id && originalTask.list_id !== movedTask.list_id) {
      affectedLists.add(originalTask.list_id)
    }

    const writes: Promise<unknown>[] = []
    for (const listId of affectedLists) {
      const tasksInList = localTasks.filter(t => t.list_id === listId)
      tasksInList.forEach((t, index) => {
        const orig = tasks.find(o => o.id === t.id)
        if (!orig) return
        const listChanged = orig.list_id !== t.list_id
        const positionChanged = orig.position !== index
        if (listChanged || positionChanged) {
          writes.push(updateTask(t.id, { list_id: t.list_id ?? undefined, position: index }))
        }
      })
    }
    await Promise.all(writes)
  }

  // Auto-clear the explosion after the animation finishes
  useEffect(() => {
    if (!explosion) return
    const t = setTimeout(() => setExplosion(null), 1200)
    return () => clearTimeout(t)
  }, [explosion])

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
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
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
          onRenameList={handleRenameList}
          onArchiveList={archiveList}
          onAddList={handleAddList}
          selectedTaskId={currentTask?.id}
          taskLabelsMap={taskLabelsMap}
          coverImageMap={coverImageMap}
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
          onMovedAway={removeTaskLocal}
          onArchive={selectedIsInbox ? undefined : archiveTask}
          onCopy={copyTask}
          onMoveToBoard={selectedIsInbox ? undefined : moveTaskToBoard}
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

    <DragOverlay>
      {activeTask && (
        <div className="w-[250px] rotate-2 opacity-90 pointer-events-none">
          <TaskCard task={activeTask} />
        </div>
      )}
    </DragOverlay>

    {explosion && <ExplosionFx x={explosion.x} y={explosion.y} />}
    </DndContext>
  )
}

// 10-second-hold easter egg. Renders a one-shot CSS particle burst at the
// pointer position. Card data is untouched — when the drag is released, the
// card is still in its original slot.
function ExplosionFx({ x, y }: { x: number; y: number }) {
  const particles = Array.from({ length: 14 })
  return (
    <div
      className="fixed pointer-events-none z-[100]"
      style={{ left: x, top: y, width: 0, height: 0 }}
      aria-hidden
    >
      <span className="absolute -translate-x-1/2 -translate-y-1/2 text-4xl select-none animate-[hg-explode-core_900ms_ease-out_forwards]">
        💥
      </span>
      {particles.map((_, i) => {
        const angle = (i / particles.length) * Math.PI * 2
        const dx = Math.cos(angle) * 90
        const dy = Math.sin(angle) * 90
        const colors = ['#6c5ce7', '#fdcb6e', '#e17055', '#00b894', '#0984e3', '#e84393']
        const color = colors[i % colors.length]
        return (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              left: 0,
              top: 0,
              width: 8,
              height: 8,
              backgroundColor: color,
              boxShadow: `0 0 8px ${color}`,
              transform: 'translate(-50%, -50%)',
              animation: `hg-explode-particle 900ms ease-out forwards`,
              ['--hg-dx' as string]: `${dx}px`,
              ['--hg-dy' as string]: `${dy}px`,
            }}
          />
        )
      })}
    </div>
  )
}
