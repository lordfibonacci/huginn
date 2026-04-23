import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import type { BoardMember, Profile } from '../../../shared/lib/types'

export interface MemberWithProfile extends BoardMember {
  profile?: Profile
}

export type MemberRole = 'owner' | 'admin' | 'member'

export type InviteResult =
  | { ok: true; member: BoardMember }
  | { ok: false; reason: 'not_found' | 'already_member' | 'forbidden' | 'unknown'; message: string }

export function useBoardMembers(projectId: string) {
  const [members, setMembers] = useState<MemberWithProfile[]>([])
  const [loading, setLoading] = useState(true)

  const fetchMembers = useCallback(async () => {
    if (!projectId) return
    const { data, error } = await supabase
      .from('huginn_board_members')
      .select('*')
      .eq('project_id', projectId)

    if (error) {
      console.error('Failed to fetch board members:', error)
      setLoading(false)
      return
    }

    const memberData = data as BoardMember[]

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

      const sorted = memberData
        .map(m => ({ ...m, profile: profileMap[m.user_id] }))
        .sort((a, b) => {
          // active first, then by role weight
          if (a.status !== b.status) return a.status === 'active' ? -1 : 1
          return roleWeight(a.role) - roleWeight(b.role)
        })
      setMembers(sorted)
    } else {
      setMembers([])
    }

    setLoading(false)
  }, [projectId])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  useEffect(() => {
    if (!projectId) return
    const channelName = `huginn_board_members_${projectId}_${crypto.randomUUID()}`
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'huginn_board_members', filter: `project_id=eq.${projectId}` }, () => {
        fetchMembers()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [projectId, fetchMembers])

  // Keep member avatars/display names fresh when a teammate updates their
  // own profile. Realtime on huginn_profiles is unfiltered (small table;
  // updates are rare) and we just refetch on any change.
  useEffect(() => {
    if (!projectId) return
    const channelName = `huginn_profiles_for_board_${projectId}_${crypto.randomUUID()}`
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'huginn_profiles' }, (payload) => {
        const updatedId = (payload.new as { id?: string })?.id
        if (updatedId && members.some(m => m.user_id === updatedId)) {
          fetchMembers()
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [projectId, members, fetchMembers])

  const activeMembers = useMemo(() => members.filter(m => m.status === 'active'), [members])
  const pendingMembers = useMemo(() => members.filter(m => m.status === 'pending'), [members])

  async function addMember(userId: string, role: MemberRole = 'member'): Promise<InviteResult> {
    if (members.some(m => m.user_id === userId)) {
      const existing = members.find(m => m.user_id === userId)!
      const message = existing.status === 'pending' ? 'Already invited (pending).' : 'Already a member of this project.'
      return { ok: false, reason: 'already_member', message }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { ok: false, reason: 'forbidden', message: 'Not signed in.' }
    }

    const { data, error } = await supabase
      .from('huginn_board_members')
      .insert({
        project_id: projectId,
        user_id: userId,
        role,
        status: 'pending',
        invited_by: user.id,
      })
      .select()
      .single()

    if (error) {
      const isForbidden = error.code === '42501' || /permission/i.test(error.message)
      return {
        ok: false,
        reason: isForbidden ? 'forbidden' : 'unknown',
        message: isForbidden ? 'You need owner or admin role to add members.' : error.message,
      }
    }
    return { ok: true, member: data as BoardMember }
  }

  async function changeRole(memberId: string, role: MemberRole): Promise<boolean> {
    const prev = members
    setMembers(p => p.map(m => m.id === memberId ? { ...m, role } : m))
    const { error } = await supabase
      .from('huginn_board_members')
      .update({ role })
      .eq('id', memberId)

    if (error) {
      console.error('Failed to change role:', error)
      setMembers(prev)
      return false
    }
    return true
  }

  async function removeMember(memberId: string): Promise<boolean> {
    const prev = members
    setMembers(p => p.filter(m => m.id !== memberId))
    const { error } = await supabase
      .from('huginn_board_members')
      .delete()
      .eq('id', memberId)

    if (error) {
      console.error('Failed to remove member:', error)
      setMembers(prev)
      return false
    }
    return true
  }

  return { members, activeMembers, pendingMembers, loading, addMember, changeRole, removeMember }
}

function roleWeight(role: string): number {
  switch (role) {
    case 'owner': return 0
    case 'admin': return 1
    case 'member': return 2
    default: return 3
  }
}
