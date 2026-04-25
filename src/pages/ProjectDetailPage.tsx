import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../shared/lib/supabase'
import { DndContext, DragOverlay, PointerSensor, closestCorners, useSensor, useSensors } from '@dnd-kit/core'
import type { CollisionDetection, DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core'
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
import { useUnreadMentionsByTask } from '../features/projects/hooks/useMentions'
import { TaskCard } from '../features/projects/components/TaskCard'
import { LIST_SORT_KEYS, type ListSortKey } from '../features/projects/components/ListColumn'

function loadListSort(listId: string): ListSortKey {
  try {
    const v = localStorage.getItem(`huginn.sort.list.${listId}`)
    if (v && (LIST_SORT_KEYS as readonly string[]).includes(v)) return v as ListSortKey
  } catch { /* localStorage unavailable */ }
  return 'manual'
}

function saveListSort(listId: string, key: ListSortKey) {
  try {
    if (key === 'manual') localStorage.removeItem(`huginn.sort.list.${listId}`)
    else localStorage.setItem(`huginn.sort.list.${listId}`, key)
  } catch { /* localStorage unavailable */ }
}
import { CalendarView } from '../features/projects/components/CalendarView'
import { BoardFilterBar, applyBoardFilters, DEFAULT_FILTERS } from '../features/projects/components/BoardFilterBar'
import type { BoardFilters } from '../features/projects/components/BoardFilterBar'
import { useEnabledRunes } from '../runes/useEnabledRunes'
import { MetaBoardButton } from '../runes/meta-social/MetaBoardButton'
import { getBackground } from '../shared/lib/boardBackgrounds'
import { InboxPanel, INBOX_DROPPABLE_ID } from '../features/inbox/components/InboxPanel'
import { useInbox } from '../features/inbox/hooks/useInbox'
import { ToolBar } from '../shared/components/ToolBar'
import { LoadingScreen } from '../shared/components/Logo'
import { ProjectGlyph } from '../features/projects/components/ProjectGlyph'
import { BoardMembersStack } from '../features/projects/components/BoardMembersStack'
import { BoardMembersDrawer } from '../features/projects/components/BoardMembersDrawer'
import type { Project, Task, Label, List } from '../shared/lib/types'

export function ProjectDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [loadingProject, setLoadingProject] = useState(true)

  // Hooks
  const { updateProject, deleteProject } = useProjects()
  const { tasks, loading: loadingTasks, addTask, updateTask, deleteTask, removeTaskLocal, archiveTask, copyTask, moveTaskToBoard } = useProjectTasks(id ?? '')
  const { lists, archivedLists, loading: loadingLists, addList, updateList, archiveList, unarchiveList, reorderLists } = useLists(id ?? '')
  const { labels } = useLabels(id ?? '')
  const unreadMentionsByTask = useUnreadMentionsByTask(id ?? '')
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
        if (isDraggingRef.current) { pendingLabelRefetchRef.current = true; return }
        setTaskLabelVersion(v => v + 1)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id])

  // Board-level cover image map: first image attachment per task (prefer is_cover).
  const [coverImageMap, setCoverImageMap] = useState<Record<string, string>>({})
  const [coverVersion, setCoverVersion] = useState(0)
  // Mid-drag, attachment realtime events are deferred so a refetch doesn't
  // produce a new coverImageMap reference and re-render every TaskCard while
  // dnd-kit is mid-measure. The trailing flag fires once the drag releases.
  const pendingCoverRefetchRef = useRef(false)
  const pendingLabelRefetchRef = useRef(false)

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
        if (isDraggingRef.current) { pendingCoverRefetchRef.current = true; return }
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
  const [localLists, setLocalLists] = useState<List[]>(lists)
  const isDraggingRef = useRef(false)
  // True while handleDragEnd's N parallel UPDATE writes are still in flight.
  // Each UPDATE emits its own realtime event → `tasks`/`lists` refetches with
  // a PARTIALLY-reordered server snapshot. Without this guard, the [tasks]
  // effect below sorts that stale snapshot and stomps our optimistic
  // localTasks — the card visibly jumps to whatever positions the partial
  // state dictates before the final echo settles (perceived as 200-400 ms of
  // drop "lag"). Same reasoning for localLists.
  const pendingReorderRef = useRef(false)
  // Per-list sort preferences. Lifted from BoardView because handleDragEnd
  // needs to flip a list to 'manual' on same-list card drops.
  const [sortByList, setSortByList] = useState<Record<string, ListSortKey>>({})
  // Hydrate sort prefs from localStorage when lists arrive.
  useEffect(() => {
    setSortByList(prev => {
      const next = { ...prev }
      let changed = false
      for (const list of lists) {
        if (!next[list.id]) {
          const hydrated = loadListSort(list.id)
          if (hydrated !== 'manual') { next[list.id] = hydrated; changed = true }
        }
      }
      return changed ? next : prev
    })
  }, [lists])
  const handleSortChange = useCallback((listId: string, key: ListSortKey) => {
    setSortByList(prev => ({ ...prev, [listId]: key }))
    saveListSort(listId, key)
  }, [])
  // The list the currently-dragged card came from. Used to suspend that
  // list's sort visually during the drag so dnd-kit can reorder its cards.
  const [dragSourceListId, setDragSourceListId] = useState<string | null>(null)
  useEffect(() => {
    if (!isDraggingRef.current && !pendingReorderRef.current) {
      setLocalTasks([...tasks].sort((a, b) => {
        if ((a.list_id ?? '') !== (b.list_id ?? '')) return 0
        return (a.position ?? 0) - (b.position ?? 0)
      }))
    }
  }, [tasks])
  useEffect(() => {
    if (!isDraggingRef.current && !pendingReorderRef.current) setLocalLists(lists)
  }, [lists])

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
  const [searchParams, setSearchParams] = useSearchParams()

  // Runes — enabled set for this board, plus which rune (if any) currently
  // owns the main viewport via its boardView surface.
  const { enabled: enabledRunes } = useEnabledRunes(id)
  const metaRune = enabledRunes.find(r => r.id === 'meta-social')
  const [activeRuneView, setActiveRuneView] = useState<string | null>(null)
  const ActiveRuneView = activeRuneView
    ? enabledRunes.find(r => r.id === activeRuneView)?.surfaces.boardView ?? null
    : null

  // Deep-link: ?card=<taskId> (e.g. from the ⌘K palette) opens the popup.
  // Wait for the tasks fetch to settle so we don't prematurely give up on a
  // card that exists but hasn't loaded yet.
  useEffect(() => {
    const cardId = searchParams.get('card')
    if (!cardId || loadingTasks) return
    const match = tasks.find((t) => t.id === cardId)
    if (match) setSelectedTask(match)
    // Strip the param either way so refresh/back doesn't re-open, and so a
    // missing card doesn't stay stuck in the URL.
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('card')
      return next
    }, { replace: true })
  }, [searchParams, tasks, loadingTasks, setSearchParams])

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
  const [activeListId, setActiveListId] = useState<string | null>(null)
  const [explosion, setExplosion] = useState<{ x: number; y: number } | null>(null)
  const explosionPendingRef = useRef(false)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  // Records the last cross-list move so we can suppress an immediate move
  // BACK to the source list when collisionDetection oscillates between two
  // adjacent lists (the cause of the image-card drag loop — tall cards make
  // the over target flip-flop on every layout reflow).
  const recentCrossListRef = useRef<{ taskId: string; from: string; to: string; ts: number } | null>(null)

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
    if (localLists.some(l => l.id === id)) return id
    const task = localTasks.find(t => t.id === id)
    return task?.list_id ?? null
  }

  function isListDrag(event: { active: { data: { current?: unknown } } }): boolean {
    const data = event.active.data.current as { type?: string } | undefined
    return data?.type === 'list'
  }

  // When dragging a list, restrict collision targets to other lists so the
  // outer horizontal SortableContext gets clean `over` events (cards would
  // otherwise be picked, stranding the list at its start position). Cards and
  // inbox drags keep the default closestCorners across all droppables.

  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const activeType = (args.active.data.current as { type?: string } | null)?.type
    if (activeType === 'list') {
      const listsOnly = args.droppableContainers.filter(
        (c) => (c.data.current as { type?: string } | null)?.type === 'list'
      )
      return closestCorners({ ...args, droppableContainers: listsOnly })
    }
    return closestCorners(args)
  }, [])

  function handleDragStart(event: DragStartEvent) {
    isDraggingRef.current = true
    // Always reset the hold-to-explode state at the start of ANY drag so
    // stale `true` from a previous drag doesn't trip the dragEnd bail-out.
    explosionPendingRef.current = false
    recentCrossListRef.current = null
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    setInboxPreview(null)

    if (isListDrag(event)) {
      setActiveTask(null)
      setActiveListId(event.active.id as string)
      return
    }
    setActiveListId(null)
    const task = findTaskAnywhere(event.active.id as string)
    setActiveTask(task ?? null)
    // Track source list so BoardView can render that list as manual during
    // the drag (suspends sort so dnd-kit's arrayMove actually works visually).
    if (task?.list_id) setDragSourceListId(task.list_id)
    else setDragSourceListId(null)
    holdTimerRef.current = setTimeout(() => {
      explosionPendingRef.current = true
      setExplosion({ ...lastPointerRef.current })
      setActiveTask(null)
    }, 10000)
  }

  function handleDragCancel() {
    isDraggingRef.current = false
    recentCrossListRef.current = null
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
    setActiveTask(null)
    setActiveListId(null)
    setDragSourceListId(null)
    setInboxPreview(null)
    setLocalTasks(tasks)
    setLocalLists(lists)
    flushPendingRefetches()
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

    // List reorder — arrayMove localLists while hovering over another list.
    if (isListDrag(event)) {
      if (!localLists.some(l => l.id === overId)) return
      setLocalLists(prev => {
        const from = prev.findIndex(l => l.id === activeId)
        const to = prev.findIndex(l => l.id === overId)
        if (from === -1 || to === -1 || from === to) return prev
        return arrayMove(prev, from, to)
      })
      return
    }

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

    const overContainer = resolveContainer(overId)
    if (!overContainer) return

    // Only mutate localTasks for CROSS-list moves (changing list_id). Same-list
    // visual reordering is handled by dnd-kit's verticalListSortingStrategy via
    // transforms — calling setLocalTasks every dragOver to arrayMove caused
    // infinite render loops when the active card swapped with a card of
    // different height (cursor stayed over the same target → re-fire → loop).
    // Final same-list order is computed in dragEnd from over.id.
    setLocalTasks(prev => {
      const currentActive = prev.find(t => t.id === activeId)
      if (!currentActive) return prev
      const currentList = currentActive.list_id ?? null
      if (currentList === overContainer) return prev // same-list — no-op here

      // Suppress the inverse of a move we just made (collisionDetection
      // ping-pong between adjacent lists). Without this, tall cards loop:
      // L1 → L2 → L1 → L2 ... forever.
      const recent = recentCrossListRef.current
      if (
        recent
        && recent.taskId === activeId
        && recent.from === overContainer
        && currentList && recent.to === currentList
        && Date.now() - recent.ts < 120
      ) {
        return prev
      }

      // Cross-list move: detach from current list, insert into target list.
      const without = prev.filter(t => t.id !== activeId)
      const moved = { ...currentActive, list_id: overContainer }
      const overTask = prev.find(t => t.id === overId)
      if (overTask && overTask.list_id === overContainer) {
        const insertAt = without.indexOf(overTask)
        without.splice(insertAt, 0, moved)
      } else {
        let lastIndexInTarget = -1
        for (let i = without.length - 1; i >= 0; i--) {
          if (without[i].list_id === overContainer) { lastIndexInTarget = i; break }
        }
        without.splice(lastIndexInTarget + 1, 0, moved)
      }
      if (currentList) {
        recentCrossListRef.current = { taskId: activeId, from: currentList, to: overContainer, ts: Date.now() }
      }
      return without
    })
  }

  function flushPendingRefetches() {
    if (pendingCoverRefetchRef.current) {
      pendingCoverRefetchRef.current = false
      setCoverVersion(v => v + 1)
    }
    if (pendingLabelRefetchRef.current) {
      pendingLabelRefetchRef.current = false
      setTaskLabelVersion(v => v + 1)
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    isDraggingRef.current = false
    recentCrossListRef.current = null
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
    setActiveTask(null)
    setActiveListId(null)
    setDragSourceListId(null)
    setInboxPreview(null)
    flushPendingRefetches()

    if (explosionPendingRef.current) {
      // Card was nuked — discard any optimistic moves
      setLocalTasks(tasks)
      return
    }

    const { active, over } = event

    // Gate the [tasks]/[lists] resync effects for the duration of any DB
    // writes we fire below. See pendingReorderRef declaration for why.
    pendingReorderRef.current = true
    try {

    // List reorder — persist new order if localLists diverges from server lists.
    if (isListDrag(event)) {
      if (!over) { setLocalLists(lists); return }
      const newOrder = localLists.map(l => l.id)
      const originalOrder = lists.map(l => l.id)
      const changed = newOrder.some((id, i) => id !== originalOrder[i])
      if (changed) await reorderLists(newOrder)
      return
    }

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
    const sameList = originalTask?.list_id && movedTask.list_id === originalTask.list_id

    // Same-list reorder: dragOver no longer mutates localTasks for same-list
    // (caused infinite loops). Compute the final order here from over.id and
    // apply via arrayMove so the persistence loop below sees the new order.
    let workingTasks = localTasks
    if (sameList && movedTask.list_id) {
      const overTask = localTasks.find(t => t.id === overId)
      const overIsSameList = overTask && overTask.list_id === movedTask.list_id
      if (overIsSameList) {
        const fromIndex = localTasks.indexOf(movedTask)
        const toIndex = localTasks.indexOf(overTask)
        if (fromIndex !== toIndex) {
          workingTasks = arrayMove(localTasks, fromIndex, toIndex)
          setLocalTasks(workingTasks)
        }
      }
      // If user dropped on the list itself (whitespace), leave order unchanged.
    }

    // If user manually reordered within a sorted list, the act of reordering
    // expresses manual intent — flip that list's sort to 'manual' so the new
    // order persists visually. Cross-list drops leave the source list's sort
    // alone (user is just moving a card out, not ordering within).
    if (sameList && movedTask.list_id && (sortByList[movedTask.list_id] ?? 'manual') !== 'manual') {
      handleSortChange(movedTask.list_id, 'manual')
    }
    const affectedLists = new Set<string>()
    if (movedTask.list_id) affectedLists.add(movedTask.list_id)
    if (originalTask?.list_id && originalTask.list_id !== movedTask.list_id) {
      affectedLists.add(originalTask.list_id)
    }

    const writes: Promise<unknown>[] = []
    for (const listId of affectedLists) {
      const tasksInList = workingTasks.filter(t => t.list_id === listId)
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

    } finally {
      pendingReorderRef.current = false
    }
  }

  // Auto-clear the explosion after the animation finishes
  useEffect(() => {
    if (!explosion) return
    const t = setTimeout(() => setExplosion(null), 1200)
    return () => clearTimeout(t)
  }, [explosion])

  if (loadingProject) {
    return <LoadingScreen message={t('board.loading')} />
  }

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-huginn-text-muted text-sm">{t('board.notFound')}</p>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
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
      {/* Slim board header — project context on left, board controls on right.
          Back nav lives in the GlobalTopBar (Boards link). Project-name click
          opens settings, so no separate gear. Avatar stack opens members. */}
      <header className="relative z-20 flex items-center gap-2 px-4 py-1.5 border-b border-huginn-border bg-huginn-base/40 shrink-0">
        <button
          onClick={() => setShowSettings(true)}
          className="flex items-center gap-2 min-w-0 flex-1 group rounded-md px-1.5 py-1 -mx-1.5 hover:bg-huginn-hover/40 transition-colors"
          title={t('board.projectSettings')}
        >
          <ProjectGlyph color={project.color} size={16} />
          <h1 className="text-sm font-bold tracking-tight truncate text-white">
            {project.name}
          </h1>
        </button>

        {/* View switcher */}
        <div className="flex bg-huginn-card rounded-md p-0.5">
          <button
            onClick={() => { setView('board'); setActiveRuneView(null) }}
            className={`text-xs font-semibold px-2.5 py-1 rounded transition-colors ${
              view === 'board' && !activeRuneView ? 'bg-huginn-accent text-white' : 'text-huginn-text-secondary hover:text-white'
            }`}
          >
            {t('board.view.cards')}
          </button>
          <button
            onClick={() => { setView('calendar'); setActiveRuneView(null) }}
            className={`text-xs font-semibold px-2.5 py-1 rounded transition-colors ${
              view === 'calendar' && !activeRuneView ? 'bg-huginn-accent text-white' : 'text-huginn-text-secondary hover:text-white'
            }`}
          >
            {t('board.view.calendar')}
          </button>
        </div>

        {/* Rune-provided view buttons (gated on rune being enabled) */}
        {metaRune && (
          <MetaBoardButton
            active={activeRuneView === 'meta-social'}
            onClick={() => setActiveRuneView(cur => (cur === 'meta-social' ? null : 'meta-social'))}
          />
        )}

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
      </header>

      {/* Board, Calendar, or active rune view — with board background.
          Rune view (when set) takes precedence over the core cards/calendar
          toggle so the user can flip back by clicking the active rune button. */}
      <div className="flex-1 flex flex-col min-h-0" style={{ background: getBackground(project.background ?? 'default').style }}>
      {ActiveRuneView ? (
        <ActiveRuneView projectId={id!} />
      ) : view === 'board' ? (
        <BoardView
          lists={localLists}
          tasks={filteredTasks}
          loading={loadingLists || loadingTasks}
          onTaskTap={setSelectedTask}
          onAddCard={handleAddCard}
          onRenameList={handleRenameList}
          onArchiveList={archiveList}
          onAddList={handleAddList}
          onStatusChange={(taskId, status) => { updateTask(taskId, { status }) }}
          selectedTaskId={currentTask?.id}
          taskLabelsMap={taskLabelsMap}
          coverImageMap={coverImageMap}
          unreadMentionsByTask={unreadMentionsByTask}
          sortByList={sortByList}
          onSortChange={handleSortChange}
          dragSourceListId={dragSourceListId}
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
        currentProjectId={id}
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
          archivedLists={archivedLists}
          onUpdate={handleUpdateProject}
          onDelete={handleDeleteProject}
          onRestoreList={unarchiveList}
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

    <DragOverlay dropAnimation={null}>
      {activeTask && (
        <div className="w-[248px] rotate-2 opacity-95 pointer-events-none drop-shadow-2xl">
          <TaskCard
            task={activeTask}
            labels={taskLabelsMap[activeTask.id]}
            coverImageUrl={coverImageMap[activeTask.id]}
          />
        </div>
      )}
      {activeListId && (() => {
        const list = localLists.find(l => l.id === activeListId)
        if (!list) return null
        const listTasks = localTasks.filter(t => t.list_id === list.id).slice(0, 4)
        return (
          <div className="w-[248px] rotate-1 bg-black/40 backdrop-blur-sm rounded-xl p-2 pointer-events-none shadow-2xl ring-1 ring-huginn-accent/40">
            <div className="text-sm font-bold text-huginn-text-primary px-2 py-1 mb-1">
              {list.name}
            </div>
            <div className="space-y-1.5">
              {listTasks.map(t => (
                <div key={t.id} className="bg-huginn-card rounded-lg px-3 py-2 text-sm text-huginn-text-primary shadow-sm">
                  {t.title}
                </div>
              ))}
              {listTasks.length === 0 && (
                <div className="h-6" />
              )}
            </div>
          </div>
        )
      })()}
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
