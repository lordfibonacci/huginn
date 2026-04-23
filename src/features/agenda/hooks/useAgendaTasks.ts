import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import { useAuth } from '../../../shared/hooks/useAuth'
import type { Task, Project } from '../../../shared/lib/types'

export interface AgendaBuckets {
  overdueAndToday: Task[]
  thisWeek: Task[]
  myAssignments: Task[]
  starred: Task[]
  completedToday: number
  projectMap: Record<string, Project>
  assigneesByTask: Record<string, string[]>
  loading: boolean
}

function localDateIso(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function useAgendaTasks(): AgendaBuckets {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [projectMap, setProjectMap] = useState<Record<string, Project>>({})
  const [assigneesByTask, setAssigneesByTask] = useState<Record<string, string[]>>({})
  const [completedToday, setCompletedToday] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    // Local midnight as an ISO timestamp for the completed-today count.
    const midnight = new Date()
    midnight.setHours(0, 0, 0, 0)

    // Active agenda rows + today's completions, fetched together.
    const [tasksRes, doneTodayRes] = await Promise.all([
      supabase
        .from('huginn_tasks')
        .select('*')
        .eq('archived', false)
        .neq('status', 'done'),
      supabase
        .from('huginn_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('archived', false)
        .eq('status', 'done')
        .gte('updated_at', midnight.toISOString()),
    ])

    if (tasksRes.error) {
      console.error('Failed to fetch agenda tasks:', tasksRes.error)
      setLoading(false)
      return
    }
    const fetched = (tasksRes.data ?? []) as Task[]

    // Fetch projects (RLS scopes) in parallel with task members
    const [projectsRes, membersRes] = await Promise.all([
      supabase.from('huginn_projects').select('*'),
      fetched.length > 0
        ? supabase
            .from('huginn_task_members')
            .select('task_id, user_id')
            .in('task_id', fetched.map(t => t.id))
        : Promise.resolve({ data: [], error: null }),
    ])

    const pmap: Record<string, Project> = {}
    for (const p of (projectsRes.data ?? []) as Project[]) pmap[p.id] = p

    const amap: Record<string, string[]> = {}
    for (const m of (membersRes.data ?? []) as { task_id: string; user_id: string }[]) {
      if (!amap[m.task_id]) amap[m.task_id] = []
      amap[m.task_id].push(m.user_id)
    }

    setTasks(fetched)
    setProjectMap(pmap)
    setAssigneesByTask(amap)
    setCompletedToday(doneTodayRes.count ?? 0)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Subscribe unfiltered to the three tables the hub depends on. Unfiltered because
  // a card moving boards, getting assigned, etc. changes which bucket it sits in —
  // a column-filtered subscription would miss the departure (the RLS filter trap).
  useEffect(() => {
    const channel = supabase
      .channel(`huginn_agenda_${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'huginn_tasks' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'huginn_task_members' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'huginn_projects' }, () => fetchAll())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchAll])

  const me = user?.id ?? ''
  const today = localDateIso(new Date())
  const weekEnd = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return localDateIso(d)
  })()

  // Only bucket tasks that belong to a board the user can access. Inbox cards
  // (project_id = null) skip Today — the /inbox tab is their home.
  const boardTasks = tasks.filter(t => t.project_id && projectMap[t.project_id])

  const overdueAndToday: Task[] = []
  const thisWeek: Task[] = []
  const myAssignments: Task[] = []
  const starred: Task[] = []

  for (const t of boardTasks) {
    if (t.starred) starred.push(t)
    if (t.due_date) {
      if (t.due_date <= today) overdueAndToday.push(t)
      else if (t.due_date <= weekEnd) thisWeek.push(t)
    } else {
      const assignees = assigneesByTask[t.id] ?? []
      const assignedToMe = assignees.includes(me)
      const mineByCreation = assignees.length === 0 && t.user_id === me
      if (assignedToMe || mineByCreation) myAssignments.push(t)
    }
  }

  // Sort each bucket so the UI is stable.
  overdueAndToday.sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
  thisWeek.sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
  // Newest first for "no due date, mine" — surfaces recently-captured work.
  myAssignments.sort((a, b) => b.created_at.localeCompare(a.created_at))
  starred.sort((a, b) => b.created_at.localeCompare(a.created_at))

  return { overdueAndToday, thisWeek, myAssignments, starred, completedToday, projectMap, assigneesByTask, loading }
}
