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
      .order('position')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch tasks:', error)
      return
    }
    setTasks(data as Task[])
    setLoading(false)
  }, [projectId])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  useEffect(() => {
    const channelName = `huginn_tasks_${projectId}_${crypto.randomUUID()}`
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'huginn_tasks', filter: `project_id=eq.${projectId}` }, () => {
        fetchTasks()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [projectId, fetchTasks])

  async function addTask(title: string, listId?: string): Promise<Task | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    // Get max position in the target list
    const listTasks = listId ? tasks.filter(t => t.list_id === listId) : tasks
    const maxPos = listTasks.length > 0 ? Math.max(...listTasks.map(t => t.position)) + 1 : 0

    const optimistic: Task = {
      id: crypto.randomUUID(),
      user_id: user.id,
      project_id: projectId,
      list_id: listId ?? null,
      title,
      notes: null,
      status: 'todo',
      priority: null,
      position: maxPos,
      from_thought_id: null,
      start_date: null,
      due_date: null,
      recurring: null,
      created_at: new Date().toISOString(),
    }

    setTasks((prev) => [...prev, optimistic])

    const insertData: Record<string, unknown> = {
      title, status: 'todo', project_id: projectId, user_id: user.id, position: maxPos
    }
    if (listId) insertData.list_id = listId

    const { data, error } = await supabase
      .from('huginn_tasks')
      .insert(insertData)
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
    updates: { title?: string; notes?: string | null; status?: TaskStatus; priority?: 'low' | 'medium' | 'high' | null; start_date?: string | null; due_date?: string | null; recurring?: 'never' | 'daily' | 'weekly' | 'monthly' | 'yearly' | null; list_id?: string; position?: number }
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

  // Drop a task from local state without hitting the DB. Use this when the
  // task left the project via a path the realtime filter (project_id=eq.X)
  // can't see — e.g. moved to inbox (project_id -> null), reassigned to
  // another project, etc. The caller is responsible for the actual write.
  function removeTaskLocal(taskId: string) {
    setTasks((t) => t.filter((tk) => tk.id !== taskId))
  }

  return { tasks, loading, addTask, updateTask, deleteTask, removeTaskLocal }
}
