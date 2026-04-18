import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import { useAuth } from '../../../shared/hooks/useAuth'

export interface PendingInvite {
  member_id: string
  project_id: string
  project_name: string
  project_color: string
  project_background: string | null
  role: 'owner' | 'admin' | 'member'
  invited_by: string | null
  invited_by_name: string | null
  invited_by_email: string | null
  invited_by_avatar_url: string | null
  created_at: string
}

export function usePendingInvites() {
  const { user } = useAuth()
  const [invites, setInvites] = useState<PendingInvite[]>([])
  const [loading, setLoading] = useState(true)

  const fetchInvites = useCallback(async () => {
    if (!user) {
      setInvites([])
      setLoading(false)
      return
    }
    const { data, error } = await supabase.rpc('huginn_pending_invites_for', { p_user_id: user.id })
    if (error) {
      console.error('Failed to load pending invites:', error)
      setLoading(false)
      return
    }
    setInvites((data ?? []) as PendingInvite[])
    setLoading(false)
  }, [user])

  useEffect(() => { fetchInvites() }, [fetchInvites])

  useEffect(() => {
    if (!user) return
    const channelName = `huginn_invites_${user.id}_${crypto.randomUUID()}`
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'huginn_board_members',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        fetchInvites()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, fetchInvites])

  async function accept(memberId: string): Promise<boolean> {
    const prev = invites
    setInvites(list => list.filter(i => i.member_id !== memberId))
    const { data, error } = await supabase.rpc('huginn_accept_invite', { p_member_id: memberId })
    if (error || data !== true) {
      console.error('Failed to accept invite:', error)
      setInvites(prev)
      return false
    }
    return true
  }

  async function decline(memberId: string): Promise<boolean> {
    const prev = invites
    setInvites(list => list.filter(i => i.member_id !== memberId))
    const { error } = await supabase
      .from('huginn_board_members')
      .delete()
      .eq('id', memberId)
    if (error) {
      console.error('Failed to decline invite:', error)
      setInvites(prev)
      return false
    }
    return true
  }

  return { invites, loading, accept, decline, count: invites.length }
}
