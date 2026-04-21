import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'
import { useAuth } from './useAuth'

export function useProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    if (!user) return

    supabase
      .from('huginn_profiles')
      .select('*')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data as Profile)
      })
  }, [user])

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
