import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import type { Comment } from '../../../shared/lib/types'

export function useComments(taskId: string) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)

  const fetchComments = useCallback(async () => {
    const { data, error } = await supabase
      .from('huginn_comments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Failed to fetch comments:', error)
      return
    }
    setComments(data as Comment[])
    setLoading(false)
  }, [taskId])

  useEffect(() => { fetchComments() }, [fetchComments])

  useEffect(() => {
    const channelName = `huginn_comments_${taskId}_${crypto.randomUUID()}`
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'huginn_comments', filter: `task_id=eq.${taskId}` }, () => {
        fetchComments()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [taskId, fetchComments])

  async function addComment(body: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const optimistic: Comment = {
      id: crypto.randomUUID(),
      task_id: taskId,
      user_id: user.id,
      body,
      created_at: new Date().toISOString(),
    }

    setComments(prev => [...prev, optimistic])

    const { data, error } = await supabase
      .from('huginn_comments')
      .insert({ task_id: taskId, user_id: user.id, body })
      .select()
      .single()

    if (error) {
      console.error('Failed to add comment:', error)
      setComments(prev => prev.filter(c => c.id !== optimistic.id))
      return null
    }

    setComments(prev => prev.map(c => c.id === optimistic.id ? (data as Comment) : c))
    return data as Comment
  }

  async function deleteComment(commentId: string) {
    const prev = comments
    setComments(c => c.filter(comment => comment.id !== commentId))

    const { error } = await supabase
      .from('huginn_comments')
      .delete()
      .eq('id', commentId)

    if (error) {
      console.error('Failed to delete comment:', error)
      setComments(prev)
    }
  }

  return { comments, loading, addComment, deleteComment }
}
