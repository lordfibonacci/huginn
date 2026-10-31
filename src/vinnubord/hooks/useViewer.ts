import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../shared/hooks/useAuth'
import { listMyMemberships, type Membership } from '../lib/api'
import type { Participant, Project } from '../lib/types'

// The signed in user, their projects and their participant row. With a
// projectId the participant is the row in that project, otherwise the first.
// A failed membership load sets error, so callers do not mistake it for no access.
export function useViewer(projectId?: string | null) {
  const { user, loading: authLoading } = useAuth()
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [loadingMemberships, setLoadingMemberships] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const reload = useCallback(() => setAttempt((n) => n + 1), [])

  const userId = user?.id ?? null

  useEffect(() => {
    if (authLoading) return
    if (!userId) {
      setMemberships([])
      setError(null)
      setLoadingMemberships(false)
      return
    }
    let active = true
    setLoadingMemberships(true)
    setError(null)
    listMyMemberships()
      .then((rows) => {
        if (active) setMemberships(rows)
      })
      .catch((e: unknown) => {
        console.error(e)
        if (!active) return
        setMemberships([])
        setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (active) setLoadingMemberships(false)
      })
    return () => {
      active = false
    }
  }, [authLoading, userId, attempt])

  const match = projectId ? memberships.find((m) => m.project.id === projectId) : memberships[0]
  const participant: Participant | null = match?.participant ?? null
  const projects: Project[] = memberships.map((m) => m.project)

  return { user, participant, projects, loading: authLoading || loadingMemberships, error, reload }
}
