import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import type { Profile } from '../../../shared/lib/types'

// One-shot lookup of active members for every project the user can see.
// Used by the /projects grid to show an avatar stack on shared boards
// without spinning up a per-card useBoardMembers subscription. Excludes
// the signed-in user from the returned profiles so we don't show "shared
// with yourself" on solo boards.
export function useAllProjectMembers() {
  const [byProject, setByProject] = useState<Record<string, Profile[]>>({})

  const fetch = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('huginn_board_members')
      .select('project_id, user_id')
      .eq('status', 'active')

    if (error) {
      console.error('Failed to fetch project members:', error)
      return
    }
    const rows = (data ?? []) as { project_id: string; user_id: string }[]

    const otherIds = Array.from(new Set(rows.filter(r => r.user_id !== user.id).map(r => r.user_id)))
    let profileMap: Record<string, Profile> = {}
    if (otherIds.length > 0) {
      const { data: profiles } = await supabase
        .from('huginn_profiles')
        .select('*')
        .in('id', otherIds)
      for (const p of (profiles ?? []) as Profile[]) profileMap[p.id] = p
    }

    const grouped: Record<string, Profile[]> = {}
    for (const r of rows) {
      if (r.user_id === user.id) continue
      const profile = profileMap[r.user_id]
      if (!profile) continue
      if (!grouped[r.project_id]) grouped[r.project_id] = []
      grouped[r.project_id].push(profile)
    }
    setByProject(grouped)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  useEffect(() => {
    const channel = supabase
      .channel(`huginn_all_project_members_${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'huginn_board_members' }, () => {
        fetch()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetch])

  return byProject
}
