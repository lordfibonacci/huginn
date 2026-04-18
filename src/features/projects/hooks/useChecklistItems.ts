import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import type { ChecklistItem } from '../../../shared/lib/types'

export function useChecklistItems(taskId: string) {
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchItems = useCallback(async () => {
    const { data, error } = await supabase
      .from('huginn_checklist_items')
      .select('*')
      .eq('task_id', taskId)
      .order('position')
      .order('created_at')

    if (error) {
      console.error('Failed to fetch checklist items:', error)
      return
    }
    setItems(data as ChecklistItem[])
    setLoading(false)
  }, [taskId])

  useEffect(() => { fetchItems() }, [fetchItems])

  useEffect(() => {
    const channelName = `huginn_checklist_${taskId}_${crypto.randomUUID()}`
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'huginn_checklist_items', filter: `task_id=eq.${taskId}` }, () => {
        fetchItems()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [taskId, fetchItems])

  async function addItem(text: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const maxPos = items.length > 0 ? Math.max(...items.map(i => i.position)) + 1 : 0

    const optimistic: ChecklistItem = {
      id: crypto.randomUUID(),
      task_id: taskId,
      checklist_id: '',
      user_id: user.id,
      text,
      checked: false,
      position: maxPos,
      created_at: new Date().toISOString(),
    }

    setItems(prev => [...prev, optimistic])

    const { data, error } = await supabase
      .from('huginn_checklist_items')
      .insert({ task_id: taskId, user_id: user.id, text, position: maxPos })
      .select()
      .single()

    if (error) {
      console.error('Failed to add checklist item:', error)
      setItems(prev => prev.filter(i => i.id !== optimistic.id))
      return null
    }

    setItems(prev => prev.map(i => i.id === optimistic.id ? (data as ChecklistItem) : i))
    return data as ChecklistItem
  }

  async function toggleItem(itemId: string) {
    const item = items.find(i => i.id === itemId)
    if (!item) return

    setItems(prev => prev.map(i => i.id === itemId ? { ...i, checked: !i.checked } : i))

    const { error } = await supabase
      .from('huginn_checklist_items')
      .update({ checked: !item.checked })
      .eq('id', itemId)

    if (error) {
      console.error('Failed to toggle checklist item:', error)
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, checked: item.checked } : i))
    }
  }

  async function updateItemText(itemId: string, text: string) {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, text } : i))

    const { error } = await supabase
      .from('huginn_checklist_items')
      .update({ text })
      .eq('id', itemId)

    if (error) {
      console.error('Failed to update checklist item:', error)
      fetchItems()
    }
  }

  async function deleteItem(itemId: string) {
    const prev = items
    setItems(i => i.filter(item => item.id !== itemId))

    const { error } = await supabase
      .from('huginn_checklist_items')
      .delete()
      .eq('id', itemId)

    if (error) {
      console.error('Failed to delete checklist item:', error)
      setItems(prev)
    }
  }

  const checkedCount = items.filter(i => i.checked).length
  const totalCount = items.length

  return { items, loading, addItem, toggleItem, updateItemText, deleteItem, checkedCount, totalCount }
}
