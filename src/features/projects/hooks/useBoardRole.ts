import { useMemo } from 'react'
import { useAuth } from '../../../shared/hooks/useAuth'
import { useBoardMembers } from './useBoardMembers'

export type Role = 'owner' | 'admin' | 'member'

export interface BoardPermissions {
  role: Role | null
  loading: boolean
  isOwner: boolean
  isAdmin: boolean
  isMember: boolean
  /** Owner or admin — can change settings, manage members. */
  canManage: boolean
  /** Owner only — can delete the entire board. */
  canDelete: boolean
  /** Owner / admin / member — can edit cards, lists, labels, comments. */
  canEdit: boolean
}

export function useBoardRole(projectId: string): BoardPermissions {
  const { user } = useAuth()
  const { activeMembers, loading } = useBoardMembers(projectId)

  return useMemo(() => {
    const me = activeMembers.find(m => m.user_id === user?.id)
    const role = (me?.role ?? null) as Role | null
    const isOwner = role === 'owner'
    const isAdmin = role === 'admin'
    const isMember = role === 'member'
    return {
      role,
      loading,
      isOwner,
      isAdmin,
      isMember,
      canManage: isOwner || isAdmin,
      canDelete: isOwner,
      canEdit: isOwner || isAdmin || isMember,
    }
  }, [activeMembers, user?.id, loading])
}
