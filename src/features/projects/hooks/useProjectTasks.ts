import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import type { Task, TaskStatus } from '../../../shared/lib/types'

export function useProjectTasks(projectId: string) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from('huginn_tasks')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch tasks:', error)
      return
    }
    setTasks(data as Task[])
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  useEffect(() => {
    const channel = supabase
      .channel(`huginn_tasks_${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'huginn_tasks', filter: `project_id=eq.${projectId}` }, () => {
        fetchTasks()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [projectId, fetchTasks])

  async function addTask(title: string): Promise<Task | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const optimistic: Task = {
      id: crypto.randomUUID(),
      user_id: user.id,
      project_id: projectId,
      title,
      notes: null,
      status: 'todo',
      priority: null,
      from_thought_id: null,
      due_date: null,
      created_at: new Date().toISOString(),
    }

    setTasks((prev) => [optimistic, ...prev])

    const { data, error } = await supabase
      .from('huginn_tasks')
      .insert({ title, status: 'todo', project_id: projectId, user_id: user.id })
      .select()
      .single()

    if (error) {
      console.error('Failed to add task:', error)
      setTasks((prev) => prev.filter((t) => t.id !== optimistic.id))
      return null
    }

    setTasks((prev) => prev.map((t) => (t.id === optimistic.id ? (data as Task) : t)))
    return data as Task
  }

  async function updateTask(
    taskId: string,
    updates: { title?: string; notes?: string | null; status?: TaskStatus; priority?: 'low' | 'medium' | 'high' | null; due_date?: string | null }
  ) {
    const prev = tasks
    setTasks((t) => t.map((tk) => (tk.id === taskId ? { ...tk, ...updates } : tk)))

    const { error } = await supabase
      .from('huginn_tasks')
      .update(updates)
      .eq('id', taskId)

    if (error) {
      console.error('Failed to update task:', error)
      setTasks(prev)
      return false
    }
    return true
  }

  async function deleteTask(taskId: string) {
    const prev = tasks
    setTasks((t) => t.filter((tk) => tk.id !== taskId))

    const { error } = await supabase
      .from('huginn_tasks')
      .delete()
      .eq('id', taskId)

    if (error) {
      console.error('Failed to delete task:', error)
      setTasks(prev)
      return false
    }
    return true
  }

  return { tasks, loading, addTask, updateTask, deleteTask }
}
