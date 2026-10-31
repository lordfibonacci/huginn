import { useEffect, useState } from 'react'
import { useAuth } from '../../shared/hooks/useAuth'
import { listMyMemberships, type Membership } from '../lib/api'
import type { Participant, Project } from '../lib/types'

// The signed in user, their projects and their participant row. With a
// projectId the participant is the row in that project, otherwise the first.
export function useViewer(projectId?: string | null) {
  const { user, loading: authLoading } = useAuth()
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [loadingMemberships, setLoadingMemberships] = useState(true)

  const userId = user?.id ?? null

  useEffect(() => {
    if (authLoading) return
    if (!userId) {
      setMemberships([])
      setLoadingMemberships(false)
      return
    }
    let active = true
    setLoadingMemberships(true)
    listMyMemberships()
      .then((rows) => {
        if (active) setMemberships(rows)
      })
      .catch((e: unknown) => {
        console.error(e)
        if (active) setMemberships([])
      })
      .finally(() => {
        if (active) setLoadingMemberships(false)
      })
    return () => {
      active = false
    }
  }, [authLoading, userId])

  const match = projectId ? memberships.find((m) => m.project.id === projectId) : memberships[0]
  const participant: Participant | null = match?.participant ?? null
  const projects: Project[] = memberships.map((m) => m.project)

  return { user, participant, projects, loading: authLoading || loadingMemberships }
}
