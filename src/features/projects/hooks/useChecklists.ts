import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import type { Checklist, ChecklistItem } from '../../../shared/lib/types'

interface ChecklistWithItems extends Checklist {
  items: ChecklistItem[]
}

export function useChecklists(taskId: string) {
  const [checklists, setChecklists] = useState<ChecklistWithItems[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    // Fetch checklists
    const { data: clData, error: clError } = await supabase
      .from('huginn_checklists')
      .select('*')
      .eq('task_id', taskId)
      .order('position')

    if (clError) { console.error('Failed to fetch checklists:', clError); return }

    // Fetch all items for this task
    const { data: itemData, error: itemError } = await supabase
      .from('huginn_checklist_items')
      .select('*')
      .eq('task_id', taskId)
      .order('position')
      .order('created_at')

    if (itemError) { console.error('Failed to fetch checklist items:', itemError); return }

    const items = (itemData ?? []) as ChecklistItem[]
    const cls = (clData ?? []) as Checklist[]

    // Group items by checklist_id
    const result: ChecklistWithItems[] = cls.map(cl => ({
      ...cl,
      items: items.filter(i => i.checklist_id === cl.id),
    }))

    setChecklists(result)
    setLoading(false)
  }, [taskId])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    const ch1 = supabase
      .channel(`huginn_checklists_${taskId}_${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'huginn_checklists', filter: `task_id=eq.${taskId}` }, () => fetchAll())
      .subscribe()

    const ch2 = supabase
      .channel(`huginn_cl_items_${taskId}_${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'huginn_checklist_items', filter: `task_id=eq.${taskId}` }, () => fetchAll())
      .subscribe()

    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2) }
  }, [taskId, fetchAll])

  async function addChecklist(name: string = 'Checklist') {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const maxPos = checklists.length > 0 ? Math.max(...checklists.map(c => c.position)) + 1 : 0

    const { data, error } = await supabase
      .from('huginn_checklists')
      .insert({ task_id: taskId, user_id: user.id, name, position: maxPos })
      .select()
      .single()

    if (error) { console.error('Failed to add checklist:', error); return null }
    return data as Checklist
  }

  async function deleteChecklist(checklistId: string) {
    const { error } = await supabase
      .from('huginn_checklists')
      .delete()
      .eq('id', checklistId)

    if (error) console.error('Failed to delete checklist:', error)
  }

  async function renameChecklist(checklistId: string, name: string) {
    const { error } = await supabase
      .from('huginn_checklists')
      .update({ name })
      .eq('id', checklistId)

    if (error) console.error('Failed to rename checklist:', error)
  }

  async function addItem(checklistId: string, text: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const cl = checklists.find(c => c.id === checklistId)
    const maxPos = cl && cl.items.length > 0 ? Math.max(...cl.items.map(i => i.position)) + 1 : 0

    const { data, error } = await supabase
      .from('huginn_checklist_items')
      .insert({ task_id: taskId, checklist_id: checklistId, user_id: user.id, text, position: maxPos })
      .select()
      .single()

    if (error) { console.error('Failed to add item:', error); return null }
    return data as ChecklistItem
  }

  async function toggleItem(itemId: string) {
    const item = checklists.flatMap(c => c.items).find(i => i.id === itemId)
    if (!item) return

    const { error } = await supabase
      .from('huginn_checklist_items')
      .update({ checked: !item.checked })
      .eq('id', itemId)

    if (error) console.error('Failed to toggle item:', error)
  }

  async function updateItemText(itemId: string, text: string) {
    const { error } = await supabase
      .from('huginn_checklist_items')
      .update({ text })
      .eq('id', itemId)

    if (error) console.error('Failed to update item:', error)
  }

  async function deleteItem(itemId: string) {
    const { error } = await supabase
      .from('huginn_checklist_items')
      .delete()
      .eq('id', itemId)

    if (error) console.error('Failed to delete item:', error)
  }

  // Totals across all checklists
  const allItems = checklists.flatMap(c => c.items)
  const totalCount = allItems.length
  const checkedCount = allItems.filter(i => i.checked).length

  return {
    checklists, loading,
    addChecklist, deleteChecklist, renameChecklist,
    addItem, toggleItem, updateItemText, deleteItem,
    totalCount, checkedCount,
  }
}
