import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import type { SocialPost, Task } from '../../../shared/lib/types'

export interface ScheduledPostRow {
  post: SocialPost
  task: Task
}

// Fetches social posts for a given project (via task.project_id), with their tasks joined.
export function useScheduledPosts(projectId: string | undefined) {
  const [rows, setRows] = useState<ScheduledPostRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRows = useCallback(async () => {
    if (!projectId) { setRows([]); setLoading(false); return }
    const { data: tasks, error: taskErr } = await supabase
      .from('huginn_tasks')
      .select('*')
      .eq('project_id', projectId)
      .eq('archived', false)
    if (taskErr) { console.error(taskErr); return }
    const taskIds = (tasks ?? []).map(t => t.id)
    if (taskIds.length === 0) { setRows([]); setLoading(false); return }
    const { data: posts, error: postErr } = await supabase
      .from('huginn_social_posts')
      .select('*')
      .in('task_id', taskIds)
    if (postErr) { console.error(postErr); return }
    const taskMap = new Map((tasks as Task[]).map(t => [t.id, t]))
    const combined = (posts as SocialPost[])
      .map(p => ({ post: p, task: taskMap.get(p.task_id)! }))
      .filter(r => !!r.task)
    setRows(combined)
    setLoading(false)
  }, [projectId])

  useEffect(() => { fetchRows() }, [fetchRows])

  useEffect(() => {
    if (!projectId) return
    // Subscribe unfiltered to huginn_social_posts (can't filter by project_id on this table);
    // the re-fetch scopes correctly. Cheap because the set per board is small.
    const channel = supabase
      .channel(`huginn_social_posts_board_${projectId}_${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'huginn_social_posts' },
         () => fetchRows())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [projectId, fetchRows])

  return { rows, loading }
}
