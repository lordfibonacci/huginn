import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import type { Activity } from '../../../shared/lib/types'

export function useActivity(taskId: string) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  const fetchActivities = useCallback(async () => {
    const { data, error } = await supabase
      .from('huginn_activity')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Failed to fetch activities:', error)
      return
    }
    setActivities(data as Activity[])
    setLoading(false)
  }, [taskId])

  useEffect(() => { fetchActivities() }, [fetchActivities])

  useEffect(() => {
    const channelName = `huginn_activity_${taskId}_${crypto.randomUUID()}`
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'huginn_activity', filter: `task_id=eq.${taskId}` }, () => {
        fetchActivities()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [taskId, fetchActivities])

  // Helper to log an activity (called from other hooks/components)
  async function logActivity(action: string, details?: Record<string, unknown>) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('huginn_activity')
      .insert({ task_id: taskId, user_id: user.id, action, details: details ?? null })
  }

  return { activities, loading, logActivity }
}
