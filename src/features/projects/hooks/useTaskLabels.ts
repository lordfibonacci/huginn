import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import type { Label } from '../../../shared/lib/types'

export function useTaskLabels(taskId: string) {
  const [labelIds, setLabelIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTaskLabels = useCallback(async () => {
    const { data, error } = await supabase
      .from('huginn_task_labels')
      .select('label_id')
      .eq('task_id', taskId)

    if (error) {
      console.error('Failed to fetch task labels:', error)
      return
    }
    setLabelIds((data as { label_id: string }[]).map(d => d.label_id))
    setLoading(false)
  }, [taskId])

  useEffect(() => { fetchTaskLabels() }, [fetchTaskLabels])

  useEffect(() => {
    const channelName = `huginn_task_labels_${taskId}_${crypto.randomUUID()}`
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'huginn_task_labels' }, () => {
        fetchTaskLabels()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [taskId, fetchTaskLabels])

  async function addLabel(labelId: string) {
    if (labelIds.includes(labelId)) return
    setLabelIds(prev => [...prev, labelId])

    const { error } = await supabase
      .from('huginn_task_labels')
      .insert({ task_id: taskId, label_id: labelId })

    if (error) {
      console.error('Failed to add label to task:', error)
      setLabelIds(prev => prev.filter(id => id !== labelId))
    }
  }

  async function removeLabel(labelId: string) {
    setLabelIds(prev => prev.filter(id => id !== labelId))

    const { error } = await supabase
      .from('huginn_task_labels')
      .delete()
      .eq('task_id', taskId)
      .eq('label_id', labelId)

    if (error) {
      console.error('Failed to remove label from task:', error)
      setLabelIds(prev => [...prev, labelId])
    }
  }

  function hasLabel(labelId: string) {
    return labelIds.includes(labelId)
  }

  return { labelIds, loading, addLabel, removeLabel, hasLabel }
}
