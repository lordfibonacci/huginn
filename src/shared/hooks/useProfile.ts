import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'
import { useAuth } from './useAuth'

export function useProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)

  const fetchProfile = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('huginn_profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    if (data) setProfile(data as Profile)
  }, [user])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  // Realtime: pick up profile edits made from other devices/tabs.
  useEffect(() => {
    if (!user) return
    const channelName = `huginn_profile_self_${user.id}_${crypto.randomUUID()}`
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'huginn_profiles', filter: `id=eq.${user.id}` }, () => {
        fetchProfile()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, fetchProfile])

  async function updateProfile(updates: { display_name?: string; avatar_url?: string; locale?: string }) {
    if (!user) return false

    const { error } = await supabase
      .from('huginn_profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id)

    if (error) {
      console.error('Failed to update profile:', error)
      return false
    }

    setProfile(prev => prev ? { ...prev, ...updates } : prev)
    return true
  }

  return { profile, updateProfile }
}
