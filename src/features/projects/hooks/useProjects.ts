import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import type { Project, ProjectStatus } from '../../../shared/lib/types'

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  const fetchProjects = useCallback(async () => {
    const { data, error } = await supabase
      .from('huginn_projects')
      .select('*')
      .order('name')

    if (error) {
      console.error('Failed to fetch projects:', error)
      return
    }
    setProjects(data as Project[])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  useEffect(() => {
    const channelName = `huginn_projects_${crypto.randomUUID()}`
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'huginn_projects' }, () => {
        fetchProjects()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchProjects])

  async function addProject(
    name: string,
    color: string,
    status: ProjectStatus
  ): Promise<Project | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const optimistic: Project = {
      id: crypto.randomUUID(),
      user_id: user.id,
      name,
      description: null,
      color,
      status,
      pinned: false,
      background: 'default',
      created_at: new Date().toISOString(),
    }

    setProjects((prev) => [...prev, optimistic].sort((a, b) => a.name.localeCompare(b.name)))

    const { data, error } = await supabase
      .from('huginn_projects')
      .insert({ name, color, status, user_id: user.id })
      .select()
      .single()

    if (error) {
      console.error('Failed to add project:', error)
      setProjects((prev) => prev.filter((p) => p.id !== optimistic.id))
      return null
    }

    setProjects((prev) =>
      prev.map((p) => (p.id === optimistic.id ? (data as Project) : p))
    )
    return data as Project
  }

  async function updateProject(
    projectId: string,
    updates: { name?: string; description?: string | null; color?: string; status?: ProjectStatus; background?: string }
  ) {
    const prev = projects
    setProjects((p) => p.map((pr) => (pr.id === projectId ? { ...pr, ...updates } : pr)))

    const { error } = await supabase
      .from('huginn_projects')
      .update(updates)
      .eq('id', projectId)

    if (error) {
      console.error('Failed to update project:', error)
      setProjects(prev)
      return false
    }
    return true
  }

  async function deleteProject(projectId: string) {
    const prev = projects
    setProjects((p) => p.filter((pr) => pr.id !== projectId))

    const { error } = await supabase
      .from('huginn_projects')
      .delete()
      .eq('id', projectId)

    if (error) {
      console.error('Failed to delete project:', error)
      setProjects(prev)
      return false
    }
    return true
  }

  return { projects, loading, addProject, updateProject, deleteProject, count: projects.length }
}
