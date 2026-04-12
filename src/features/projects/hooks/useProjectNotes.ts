import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import type { Note } from '../../../shared/lib/types'

export function useProjectNotes(projectId: string) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)

  const fetchNotes = useCallback(async () => {
    const { data, error } = await supabase
      .from('huginn_notes')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch notes:', error)
      return
    }
    setNotes(data as Note[])
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  async function addNote(title: string | null, body: string): Promise<Note | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const optimistic: Note = {
      id: crypto.randomUUID(),
      user_id: user.id,
      project_id: projectId,
      title: title || null,
      body,
      from_thought_id: null,
      created_at: new Date().toISOString(),
    }

    setNotes((prev) => [optimistic, ...prev])

    const { data, error } = await supabase
      .from('huginn_notes')
      .insert({ title: title || null, body, project_id: projectId, user_id: user.id })
      .select()
      .single()

    if (error) {
      console.error('Failed to add note:', error)
      setNotes((prev) => prev.filter((n) => n.id !== optimistic.id))
      return null
    }

    setNotes((prev) => prev.map((n) => (n.id === optimistic.id ? (data as Note) : n)))
    return data as Note
  }

  async function updateNote(
    noteId: string,
    updates: { title?: string | null; body?: string }
  ) {
    const prev = notes
    setNotes((n) => n.map((nt) => (nt.id === noteId ? { ...nt, ...updates } : nt)))

    const { error } = await supabase
      .from('huginn_notes')
      .update(updates)
      .eq('id', noteId)

    if (error) {
      console.error('Failed to update note:', error)
      setNotes(prev)
      return false
    }
    return true
  }

  async function deleteNote(noteId: string) {
    const prev = notes
    setNotes((n) => n.filter((nt) => nt.id !== noteId))

    const { error } = await supabase
      .from('huginn_notes')
      .delete()
      .eq('id', noteId)

    if (error) {
      console.error('Failed to delete note:', error)
      setNotes(prev)
      return false
    }
    return true
  }

  return { notes, loading, addNote, updateNote, deleteNote }
}
