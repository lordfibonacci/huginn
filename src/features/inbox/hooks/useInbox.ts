import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import type { Task } from '../../../shared/lib/types'

export function useInbox() {
  const [cards, setCards] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCards = useCallback(async () => {
    const { data, error } = await supabase
      .from('huginn_tasks')
      .select('*')
      .is('project_id', null)
      .eq('archived', false)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch inbox:', error)
      return
    }
    setCards(data as Task[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchCards() }, [fetchCards])

  useEffect(() => {
    const channelName = `huginn_inbox_${crypto.randomUUID()}`
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'huginn_tasks' }, () => {
        fetchCards()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchCards])

  async function addCard(title: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('huginn_tasks')
      .insert({ title, status: 'todo', user_id: user.id, position: 0 })
      .select()
      .single()

    if (error) {
      console.error('Failed to add inbox card:', error)
      return null
    }
    return data as Task
  }

  async function deleteCard(cardId: string) {
    setCards(prev => prev.filter(c => c.id !== cardId))

    const { error } = await supabase
      .from('huginn_tasks')
      .delete()
      .eq('id', cardId)

    if (error) console.error('Failed to delete inbox card:', error)
  }

  async function moveToProject(cardId: string, projectId: string, listId: string) {
    setCards(prev => prev.filter(c => c.id !== cardId))

    const { error } = await supabase
      .from('huginn_tasks')
      .update({ project_id: projectId, list_id: listId })
      .eq('id', cardId)

    if (error) console.error('Failed to move card to project:', error)
  }

  return { cards, loading, addCard, deleteCard, moveToProject, count: cards.length }
}
