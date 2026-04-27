import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import { useAuth } from '../../../shared/hooks/useAuth'
import type { Mention, CardView, Profile, Project, Task } from '../../../shared/lib/types'

// Module-level bus so useMarkCardViewed can hand the new viewed_at directly
// to any mounted mentions hooks. Realtime would eventually echo the same
// upsert, but the round-trip is unreliable enough that the bell badge often
// stayed lit until manual refresh.
type CardViewedListener = (taskId: string, viewedAt: string) => void
const cardViewedListeners = new Set<CardViewedListener>()
function emitCardViewed(taskId: string, viewedAt: string) {
  for (const cb of cardViewedListeners) cb(taskId, viewedAt)
}

// Per-board map of unread mention counts keyed by task_id. Used to render the
// unread dot on each TaskCard.
//
// "Unread" = mention.created_at > my last card_views.viewed_at for that task,
// or no card_view row exists yet (treat as -infinity).
export function useUnreadMentionsByTask(projectId: string): Record<string, number> {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [mentions, setMentions] = useState<Mention[]>([])
  const [views, setViews] = useState<Record<string, string>>({}) // task_id -> viewed_at

  const fetchData = useCallback(async () => {
    if (!projectId || !userId) return
    const { data: tasksData } = await supabase
      .from('huginn_tasks')
      .select('id')
      .eq('project_id', projectId)
      .eq('archived', false)
    const taskIds = ((tasksData ?? []) as Pick<Task, 'id'>[]).map(t => t.id)
    if (taskIds.length === 0) {
      setMentions([])
      setViews({})
      return
    }

    const [mentionsRes, viewsRes] = await Promise.all([
      supabase
        .from('huginn_mentions')
        .select('*')
        .eq('mentioned_user_id', userId)
        .in('task_id', taskIds),
      supabase
        .from('huginn_card_views')
        .select('task_id, viewed_at')
        .eq('user_id', userId)
        .in('task_id', taskIds),
    ])

    setMentions((mentionsRes.data ?? []) as Mention[])
    const viewMap: Record<string, string> = {}
    for (const v of (viewsRes.data ?? []) as Pick<CardView, 'task_id' | 'viewed_at'>[]) {
      viewMap[v.task_id] = v.viewed_at
    }
    setViews(viewMap)
  }, [projectId, userId])

  useEffect(() => { fetchData() }, [fetchData])

  // Realtime: refetch on any mention or card_view change. Cheap — both tables
  // are small and the recipient filter is server-side.
  useEffect(() => {
    if (!projectId || !userId) return
    const channelName = `huginn_mentions_board_${projectId}_${crypto.randomUUID()}`
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'huginn_mentions' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'huginn_card_views' }, () => fetchData())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [projectId, userId, fetchData])

  // Local bus: instant update when this device opens a card.
  useEffect(() => {
    const handler: CardViewedListener = (taskId, viewedAt) => {
      setViews(prev => {
        const existing = prev[taskId]
        if (existing && existing >= viewedAt) return prev
        return { ...prev, [taskId]: viewedAt }
      })
    }
    cardViewedListeners.add(handler)
    return () => { cardViewedListeners.delete(handler) }
  }, [])

  return useMemo(() => {
    const counts: Record<string, number> = {}
    for (const m of mentions) {
      const viewedAt = views[m.task_id]
      if (!viewedAt || new Date(m.created_at) > new Date(viewedAt)) {
        counts[m.task_id] = (counts[m.task_id] ?? 0) + 1
      }
    }
    return counts
  }, [mentions, views])
}

export interface MentionRow {
  mention: Mention
  task: Pick<Task, 'id' | 'title' | 'project_id'>
  project: Pick<Project, 'id' | 'name' | 'color'> | null
  mentioner: Profile | null
}

// Global unread mentions across all boards. Powers the top-bar bell counter
// and dropdown.
export function useGlobalMentions(): { count: number; rows: MentionRow[]; loading: boolean } {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [mentions, setMentions] = useState<Mention[]>([])
  const [views, setViews] = useState<Record<string, string>>({})
  const [tasksById, setTasksById] = useState<Record<string, Pick<Task, 'id' | 'title' | 'project_id'>>>({})
  const [projectsById, setProjectsById] = useState<Record<string, Pick<Project, 'id' | 'name' | 'color'>>>({})
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({})
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    if (!userId) return
    // All mentions where I'm the recipient. Limit defensively.
    const { data: mentionsData } = await supabase
      .from('huginn_mentions')
      .select('*')
      .eq('mentioned_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200)

    const mentionRows = (mentionsData ?? []) as Mention[]
    setMentions(mentionRows)

    if (mentionRows.length === 0) {
      setViews({})
      setTasksById({})
      setProjectsById({})
      setProfilesById({})
      setLoading(false)
      return
    }

    const taskIds = Array.from(new Set(mentionRows.map(m => m.task_id)))
    const mentionerIds = Array.from(new Set(mentionRows.map(m => m.mentioner_id)))

    const [viewsRes, tasksRes, profilesRes] = await Promise.all([
      supabase
        .from('huginn_card_views')
        .select('task_id, viewed_at')
        .eq('user_id', userId)
        .in('task_id', taskIds),
      supabase
        .from('huginn_tasks')
        .select('id, title, project_id')
        .in('id', taskIds),
      supabase
        .from('huginn_profiles')
        .select('*')
        .in('id', mentionerIds),
    ])

    const viewMap: Record<string, string> = {}
    for (const v of (viewsRes.data ?? []) as Pick<CardView, 'task_id' | 'viewed_at'>[]) {
      viewMap[v.task_id] = v.viewed_at
    }
    setViews(viewMap)

    const taskMap: Record<string, Pick<Task, 'id' | 'title' | 'project_id'>> = {}
    const projectIds = new Set<string>()
    for (const t of (tasksRes.data ?? []) as Pick<Task, 'id' | 'title' | 'project_id'>[]) {
      taskMap[t.id] = t
      if (t.project_id) projectIds.add(t.project_id)
    }
    setTasksById(taskMap)

    if (projectIds.size > 0) {
      const { data: projectsData } = await supabase
        .from('huginn_projects')
        .select('id, name, color')
        .in('id', Array.from(projectIds))
      const projectMap: Record<string, Pick<Project, 'id' | 'name' | 'color'>> = {}
      for (const p of (projectsData ?? []) as Pick<Project, 'id' | 'name' | 'color'>[]) {
        projectMap[p.id] = p
      }
      setProjectsById(projectMap)
    } else {
      setProjectsById({})
    }

    const profileMap: Record<string, Profile> = {}
    for (const p of (profilesRes.data ?? []) as Profile[]) {
      profileMap[p.id] = p
    }
    setProfilesById(profileMap)

    setLoading(false)
  }, [userId])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    if (!userId) return
    const channelName = `huginn_global_mentions_${userId}_${crypto.randomUUID()}`
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'huginn_mentions' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'huginn_card_views' }, () => fetchAll())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, fetchAll])

  // Local bus: instant update when this device opens a card.
  useEffect(() => {
    const handler: CardViewedListener = (taskId, viewedAt) => {
      setViews(prev => {
        const existing = prev[taskId]
        if (existing && existing >= viewedAt) return prev
        return { ...prev, [taskId]: viewedAt }
      })
    }
    cardViewedListeners.add(handler)
    return () => { cardViewedListeners.delete(handler) }
  }, [])

  const { rows, count } = useMemo(() => {
    const result: MentionRow[] = []
    for (const m of mentions) {
      const viewedAt = views[m.task_id]
      if (viewedAt && new Date(m.created_at) <= new Date(viewedAt)) continue
      const task = tasksById[m.task_id]
      if (!task) continue // task not found (likely deleted) — skip
      result.push({
        mention: m,
        task,
        project: task.project_id ? projectsById[task.project_id] ?? null : null,
        mentioner: profilesById[m.mentioner_id] ?? null,
      })
    }
    return { rows: result, count: result.length }
  }, [mentions, views, tasksById, projectsById, profilesById])

  return { count, rows, loading }
}

// Fire-and-forget upsert of huginn_card_views(task_id, user_id) on mount.
// Clears the unread dot for the current user on this card. Realtime echoes
// the update to other tabs/views.
export function useMarkCardViewed(taskId: string | null | undefined) {
  const { user } = useAuth()
  useEffect(() => {
    if (!taskId || !user?.id) return
    const viewedAt = new Date().toISOString()
    emitCardViewed(taskId, viewedAt)
    supabase
      .from('huginn_card_views')
      .upsert(
        { task_id: taskId, user_id: user.id, viewed_at: viewedAt },
        { onConflict: 'task_id,user_id' },
      )
      .then(({ error }) => {
        if (error) console.error('Failed to mark card viewed:', error)
      })
  }, [taskId, user?.id])
}
