import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import type { BoardMember, Profile } from '../../../shared/lib/types'

interface MemberWithProfile extends BoardMember {
  profile?: Profile
}

export function useBoardMembers(projectId: string) {
  const [members, setMembers] = useState<MemberWithProfile[]>([])
  const [loading, setLoading] = useState(true)

  const fetchMembers = useCallback(async () => {
    const { data, error } = await supabase
      .from('huginn_board_members')
      .select('*')
      .eq('project_id', projectId)

    if (error) {
      console.error('Failed to fetch board members:', error)
      return
    }

    const memberData = data as BoardMember[]

    // Fetch profiles for all members
    if (memberData.length > 0) {
      const userIds = memberData.map(m => m.user_id)
      const { data: profiles } = await supabase
        .from('huginn_profiles')
        .select('*')
        .in('id', userIds)

      const profileMap: Record<string, Profile> = {}
      if (profiles) {
        for (const p of profiles as Profile[]) {
          profileMap[p.id] = p
        }
      }

      setMembers(memberData.map(m => ({
        ...m,
        profile: profileMap[m.user_id],
      })))
    } else {
      setMembers([])
    }

    setLoading(false)
  }, [projectId])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  useEffect(() => {
    const channelName = `huginn_board_members_${projectId}_${crypto.randomUUID()}`
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'huginn_board_members', filter: `project_id=eq.${projectId}` }, () => {
        fetchMembers()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [projectId, fetchMembers])

  async function inviteMember(email: string, role: 'admin' | 'member' | 'viewer' = 'member') {
    // Look up user by email in profiles
    const { data: profile } = await supabase
      .from('huginn_profiles')
      .select('id')
      .eq('email', email)
      .single()

    if (!profile) {
      console.error('User not found:', email)
      return false
    }

    const { error } = await supabase
      .from('huginn_board_members')
      .insert({ project_id: projectId, user_id: profile.id, role })

    if (error) {
      console.error('Failed to invite member:', error)
      return false
    }

    return true
  }

  async function removeMember(memberId: string) {
    const { error } = await supabase
      .from('huginn_board_members')
      .delete()
      .eq('id', memberId)

    if (error) {
      console.error('Failed to remove member:', error)
      return false
    }
    return true
  }

  return { members, loading, inviteMember, removeMember }
}
