import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import type { List } from '../../../shared/lib/types'

export function useLists(projectId: string) {
  const [lists, setLists] = useState<List[]>([])
  const [archivedLists, setArchivedLists] = useState<List[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLists = useCallback(async () => {
    // Single round-trip, split client-side so the realtime handler only
    // needs to fire one refetch regardless of whether a list was archived,
    // restored, or created.
    const { data, error } = await supabase
      .from('huginn_lists')
      .select('*')
      .eq('project_id', projectId)
      .order('position')

    if (error) {
      console.error('Failed to fetch lists:', error)
      return
    }
    const all = data as List[]
    setLists(all.filter(l => !l.archived))
    setArchivedLists(all.filter(l => l.archived).sort((a, b) => b.created_at.localeCompare(a.created_at)))
    setLoading(false)
  }, [projectId])

  useEffect(() => { fetchLists() }, [fetchLists])

  useEffect(() => {
    const channelName = `huginn_lists_${projectId}_${crypto.randomUUID()}`
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'huginn_lists', filter: `project_id=eq.${projectId}` }, () => {
        fetchLists()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [projectId, fetchLists])

  async function addList(name: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const maxPos = lists.length > 0 ? Math.max(...lists.map(l => l.position)) + 1 : 0

    const { data, error } = await supabase
      .from('huginn_lists')
      .insert({ project_id: projectId, user_id: user.id, name, position: maxPos })
      .select()
      .single()

    if (error) {
      console.error('Failed to add list:', error)
      return null
    }

    return data as List
  }

  async function updateList(listId: string, updates: { name?: string; position?: number }) {
    const { error } = await supabase
      .from('huginn_lists')
      .update(updates)
      .eq('id', listId)

    if (error) {
      console.error('Failed to update list:', error)
      return false
    }
    return true
  }

  async function reorderLists(orderedIds: string[]) {
    const writes: Promise<unknown>[] = []
    orderedIds.forEach((listId, index) => {
      const current = lists.find(l => l.id === listId)
      if (current && current.position !== index) {
        writes.push(
          (async () => {
            const { error } = await supabase.from('huginn_lists').update({ position: index }).eq('id', listId)
            if (error) console.error('Failed to reorder list:', error)
          })()
        )
      }
    })
    await Promise.all(writes)
  }

  async function archiveList(listId: string) {
    const { error } = await supabase
      .from('huginn_lists')
      .update({ archived: true })
      .eq('id', listId)

    if (error) {
      console.error('Failed to archive list:', error)
      return false
    }
    return true
  }

  async function unarchiveList(listId: string) {
    // Restore to the end of the active lists so it doesn't collide with an
    // existing position. Caller can drag it elsewhere after restore.
    const maxPos = lists.length > 0 ? Math.max(...lists.map(l => l.position)) + 1 : 0
    const { error } = await supabase
      .from('huginn_lists')
      .update({ archived: false, position: maxPos })
      .eq('id', listId)

    if (error) {
      console.error('Failed to unarchive list:', error)
      return false
    }
    return true
  }

  return { lists, archivedLists, loading, addList, updateList, archiveList, unarchiveList, reorderLists }
}
