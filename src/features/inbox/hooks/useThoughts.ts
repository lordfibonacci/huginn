import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import type { Thought } from '../../../shared/lib/types'

export function useThoughts() {
  const [thoughts, setThoughts] = useState<Thought[]>([])
  const [loading, setLoading] = useState(true)

  const fetchThoughts = useCallback(async () => {
    const { data, error } = await supabase
      .from('huginn_thoughts')
      .select('*')
      .in('status', ['inbox', 'filed'])
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch thoughts:', error)
      return
    }
    setThoughts(data as Thought[])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchThoughts()
  }, [fetchThoughts])

  useEffect(() => {
    const channelName = `huginn_thoughts_${crypto.randomUUID()}`
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'huginn_thoughts' }, () => {
        fetchThoughts()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchThoughts])

  async function addThought(body: string, source: 'text' | 'voice'): Promise<Thought | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const optimisticThought: Thought = {
      id: crypto.randomUUID(),
      user_id: user.id,
      body,
      source,
      audio_url: null,
      status: 'inbox',
      type: null,
      tags: [],
      project_id: null,
      priority: null,
      due_date: null,
      created_at: new Date().toISOString(),
    }

    setThoughts((prev) => [optimisticThought, ...prev])

    const { data, error } = await supabase
      .from('huginn_thoughts')
      .insert({ body, source, user_id: user.id })
      .select()
      .single()

    if (error) {
      console.error('Failed to add thought:', error)
      setThoughts((prev) => prev.filter((t) => t.id !== optimisticThought.id))
      return null
    }

    setThoughts((prev) =>
      prev.map((t) => (t.id === optimisticThought.id ? (data as Thought) : t))
    )
    return data as Thought
  }

  async function classifyThought(
    thoughtId: string,
    updates: { type?: 'idea' | 'task' | 'note'; project_id?: string }
  ) {
    const { error } = await supabase
      .from('huginn_thoughts')
      .update(updates)
      .eq('id', thoughtId)

    if (error) {
      console.error('Failed to classify thought:', error)
      return false
    }

    setThoughts((prev) =>
      prev.map((t) => (t.id === thoughtId ? { ...t, ...updates } : t))
    )
    return true
  }

  async function updateThought(
    thoughtId: string,
    updates: {
      body?: string
      type?: 'idea' | 'task' | 'note' | null
      project_id?: string | null
      priority?: 'low' | 'medium' | 'high' | null
      due_date?: string | null
    }
  ) {
    const prev = thoughts
    setThoughts((t) =>
      t.map((th) => (th.id === thoughtId ? { ...th, ...updates } : th))
    )

    const { error } = await supabase
      .from('huginn_thoughts')
      .update(updates)
      .eq('id', thoughtId)

    if (error) {
      console.error('Failed to update thought:', error)
      setThoughts(prev)
      return false
    }
    return true
  }

  async function deleteThought(thoughtId: string) {
    const prev = thoughts
    setThoughts((t) => t.filter((th) => th.id !== thoughtId))

    const { error } = await supabase
      .from('huginn_thoughts')
      .delete()
      .eq('id', thoughtId)

    if (error) {
      console.error('Failed to delete thought:', error)
      setThoughts(prev)
      return false
    }
    return true
  }

  async function archiveThought(thoughtId: string) {
    const prev = thoughts
    setThoughts((t) => t.filter((th) => th.id !== thoughtId))

    const { error } = await supabase
      .from('huginn_thoughts')
      .update({ status: 'archived' })
      .eq('id', thoughtId)

    if (error) {
      console.error('Failed to archive thought:', error)
      setThoughts(prev)
      return false
    }
    return true
  }

  async function convertToTask(thoughtId: string) {
    const thought = thoughts.find((t) => t.id === thoughtId)
    if (!thought || !thought.project_id) return false

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    // Create the task
    const { error: taskError } = await supabase
      .from('huginn_tasks')
      .insert({
        title: thought.body,
        project_id: thought.project_id,
        from_thought_id: thought.id,
        status: 'todo',
        user_id: user.id,
      })

    if (taskError) {
      console.error('Failed to convert thought to task:', taskError)
      return false
    }

    // Archive the thought
    setThoughts((t) => t.filter((th) => th.id !== thoughtId))

    const { error: archiveError } = await supabase
      .from('huginn_thoughts')
      .update({ status: 'archived' })
      .eq('id', thoughtId)

    if (archiveError) {
      console.error('Failed to archive converted thought:', archiveError)
    }

    return true
  }

  return { thoughts, loading, addThought, classifyThought, updateThought, deleteThought, archiveThought, convertToTask, count: thoughts.length }
}
