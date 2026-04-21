import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import type { Label } from '../../../shared/lib/types'

export function useLabels(projectId: string) {
  const [labels, setLabels] = useState<Label[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLabels = useCallback(async () => {
    const { data, error } = await supabase
      .from('huginn_labels')
      .select('*')
      .eq('project_id', projectId)
      .order('name')

    if (error) {
      console.error('Failed to fetch labels:', error)
      return
    }
    setLabels(data as Label[])
    setLoading(false)
  }, [projectId])

  useEffect(() => { fetchLabels() }, [fetchLabels])

  useEffect(() => {
    const channelName = `huginn_labels_${projectId}_${crypto.randomUUID()}`
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'huginn_labels', filter: `project_id=eq.${projectId}` }, () => {
        fetchLabels()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [projectId, fetchLabels])

  async function createLabel(name: string, color: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('huginn_labels')
      .insert({ project_id: projectId, user_id: user.id, name, color })
      .select()
      .single()

    if (error) {
      console.error('Failed to create label:', error)
      return null
    }

    setLabels(prev => [...prev, data as Label].sort((a, b) => a.name.localeCompare(b.name)))
    return data as Label
  }

  async function updateLabel(labelId: string, updates: { name?: string; color?: string }) {
    const prev = labels
    setLabels(ls => ls.map(l => (l.id === labelId ? { ...l, ...updates } : l)).sort((a, b) => a.name.localeCompare(b.name)))
    const { error } = await supabase.from('huginn_labels').update(updates).eq('id', labelId)
    if (error) {
      console.error('Failed to update label:', error)
      setLabels(prev)
      return false
    }
    return true
  }

  async function deleteLabel(labelId: string) {
    const prev = labels
    setLabels(ls => ls.filter(l => l.id !== labelId))
    const { error } = await supabase.from('huginn_labels').delete().eq('id', labelId)
    if (error) {
      console.error('Failed to delete label:', error)
      setLabels(prev)
      return false
    }
    return true
  }

  return { labels, loading, createLabel, updateLabel, deleteLabel }
}
