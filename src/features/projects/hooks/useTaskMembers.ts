import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import type { Profile } from '../../../shared/lib/types'

export function useTaskMembers(taskId: string) {
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  const fetchMembers = useCallback(async () => {
    const { data, error } = await supabase
      .from('huginn_task_members')
      .select('user_id')
      .eq('task_id', taskId)

    if (error) {
      console.error('Failed to fetch task members:', error)
      return
    }

    const ids = (data as { user_id: string }[]).map(d => d.user_id)
    setMemberIds(ids)

    if (ids.length > 0) {
      const { data: profileData } = await supabase
        .from('huginn_profiles')
        .select('*')
        .in('id', ids)

      if (profileData) setProfiles(profileData as Profile[])
    } else {
      setProfiles([])
    }

    setLoading(false)
  }, [taskId])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  useEffect(() => {
    const channelName = `huginn_task_members_${taskId}_${crypto.randomUUID()}`
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'huginn_task_members' }, () => {
        fetchMembers()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [taskId, fetchMembers])

  async function assignMember(userId: string) {
    if (memberIds.includes(userId)) return

    const { error } = await supabase
      .from('huginn_task_members')
      .insert({ task_id: taskId, user_id: userId })

    if (error) {
      console.error('Failed to assign member:', error)
    }
  }

  async function unassignMember(userId: string) {
    const { error } = await supabase
      .from('huginn_task_members')
      .delete()
      .eq('task_id', taskId)
      .eq('user_id', userId)

    if (error) {
      console.error('Failed to unassign member:', error)
    }
  }

  function isAssigned(userId: string) {
    return memberIds.includes(userId)
  }

  return { memberIds, profiles, loading, assignMember, unassignMember, isAssigned }
}
