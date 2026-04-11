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
      .eq('status', 'inbox')
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

  return { thoughts, loading, addThought, classifyThought, count: thoughts.length }
}
