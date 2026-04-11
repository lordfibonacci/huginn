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

  return { projects, loading, addProject, count: projects.length }
}
