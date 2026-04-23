import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import type { Task, Project } from '../../../shared/lib/types'

interface CalendarData {
  tasks: Task[]
  projectMap: Record<string, Project>
  loading: boolean
}

// Cross-board calendar: every task with a due_date the user can access.
// RLS scopes to boards the user is an active member of.
export function useCalendarTasks(): CalendarData {
  const [tasks, setTasks] = useState<Task[]>([])
  const [projectMap, setProjectMap] = useState<Record<string, Project>>({})
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    const [tasksRes, projectsRes] = await Promise.all([
      supabase
        .from('huginn_tasks')
        .select('*')
        .eq('archived', false)
        .neq('status', 'done')
        .not('due_date', 'is', null),
      supabase.from('huginn_projects').select('*'),
    ])

    if (tasksRes.error) {
      console.error('Failed to fetch calendar tasks:', tasksRes.error)
      setLoading(false)
      return
    }

    const pmap: Record<string, Project> = {}
    for (const p of (projectsRes.data ?? []) as Project[]) pmap[p.id] = p

    setTasks((tasksRes.data ?? []) as Task[])
    setProjectMap(pmap)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    const channel = supabase
      .channel(`huginn_calendar_${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'huginn_tasks' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'huginn_projects' }, () => fetchAll())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchAll])

  return { tasks, projectMap, loading }
}
