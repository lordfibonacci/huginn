import { useMemo, useState } from 'react'
import { ModalShell } from '../../../shared/components/ModalShell'
import { Avatar } from '../../../shared/components/Avatar'
import { useAuth } from '../../../shared/hooks/useAuth'
import { useProfileSearch } from '../../../shared/hooks/useProfileSearch'
import { useBoardMembers } from '../hooks/useBoardMembers'
import type { MemberRole } from '../hooks/useBoardMembers'

interface BoardMembersDrawerProps {
  projectId: string
  onDone: () => void
}

const ROLE_LABEL: Record<MemberRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
}

const ROLE_HINT: Record<MemberRole, string> = {
  owner: 'Full control. Can delete the board.',
  admin: 'Manage members and settings. Cannot delete the board.',
  member: 'Edit cards, lists, comments.',
}

export function BoardMembersDrawer({ projectId, onDone }: BoardMembersDrawerProps) {
  const { user } = useAuth()
  const { members, loading, addMember, changeRole, removeMember } = useBoardMembers(projectId)

  const myMembership = useMemo(
    () => members.find(m => m.user_id === user?.id),
    [members, user?.id]
  )
  const canManage = myMembership?.role === 'owner' || myMembership?.role === 'admin'

  const [inviteOpen, setInviteOpen] = useState(false)

  return (
    <ModalShell onDismiss={onDone} title="Board members">
      {loading ? (
        <p className="text-sm text-huginn-text-muted py-6 text-center">Loading members…</p>
      ) : (
        <>
          {canManage && (
            <div className="mb-4">
              {inviteOpen ? (
                <InviteSearch
                  excludeIds={members.map(m => m.user_id)}
                  onAdd={async (userId, role) => {
                    const result = await addMember(userId, role)
                    if (result.ok) setInviteOpen(false)
                    return result
                  }}
                  onCancel={() => setInviteOpen(false)}
                />
              ) : (
                <button
                  onClick={() => setInviteOpen(true)}
                  className="w-full bg-huginn-accent text-white text-sm font-semibold rounded-lg py-2.5 hover:bg-huginn-accent-hover transition-colors flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-7 9a7 7 0 1 1 14 0H3Z" />
                  </svg>
                  Add member
                </button>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            {members.map((m) => {
              const isMe = m.user_id === user?.id
              const isOwner = m.role === 'owner'
              const isPending = m.status === 'pending'
              return (
                <div
                  key={m.id}
                  className={`flex items-center gap-3 p-2.5 rounded-lg hover:bg-huginn-hover/40 group ${isPending ? 'opacity-70' : ''}`}
                >
                  <Avatar
                    url={m.profile?.avatar_url}
                    name={m.profile?.display_name}
                    email={m.profile?.email}
                    size={36}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate flex items-center gap-2">
                      {m.profile?.display_name || m.profile?.email || 'Unknown user'}
                      {isMe && <span className="text-huginn-text-muted font-normal">(you)</span>}
                      {isPending && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-huginn-warning/20 text-huginn-warning">
                          Pending
                        </span>
                      )}
                    </p>
                    {m.profile?.email && m.profile.display_name && (
                      <p className="text-[11px] text-huginn-text-muted truncate">{m.profile.email}</p>
                    )}
                  </div>

                  {canManage && !isOwner && !isPending ? (
                    <select
                      value={m.role}
                      onChange={(e) => changeRole(m.id, e.target.value as MemberRole)}
                      className="bg-huginn-surface border border-huginn-border text-xs text-huginn-text-primary rounded-md px-2 py-1 outline-none focus:border-huginn-accent cursor-pointer"
                    >
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                    </select>
                  ) : (
                    <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded ${
                      isOwner ? 'bg-huginn-accent/20 text-huginn-accent' : 'bg-huginn-surface text-huginn-text-secondary'
                    }`}>
                      {ROLE_LABEL[m.role]}
                    </span>
                  )}

                  {((canManage && !isOwner) || isMe) && !isOwner && (
                    <button
                      onClick={() => {
                        if (window.confirm(isMe ? 'Leave this board?' : `Remove ${m.profile?.display_name || m.profile?.email || 'this member'}?`)) {
                          removeMember(m.id)
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 text-huginn-text-muted hover:text-huginn-danger transition-all p-1 rounded hover:bg-huginn-danger/10"
                      title={isMe ? 'Leave board' : 'Remove'}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path d="M9 2a1 1 0 0 0-.894.553L7.382 4H4a1 1 0 0 0 0 2h12a1 1 0 1 0 0-2h-3.382l-.724-1.447A1 1 0 0 0 11 2H9Z" />
                        <path fillRule="evenodd" d="M4.5 7a.5.5 0 0 1 .5.5v9.5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V7.5a.5.5 0 0 1 1 0v9.5a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7.5a.5.5 0 0 1 .5-.5Z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {!canManage && myMembership && (
            <p className="text-[11px] text-huginn-text-muted mt-4 px-1">
              You are a {ROLE_LABEL[myMembership.role].toLowerCase()} on this board. {ROLE_HINT[myMembership.role]}
            </p>
          )}
        </>
      )}
    </ModalShell>
  )
}

function InviteSearch({
  excludeIds,
  onAdd,
  onCancel,
}: {
  excludeIds: string[]
  onAdd: (userId: string, role: MemberRole) => Promise<{ ok: boolean; message?: string; reason?: string }>
  onCancel: () => void
}) {
  const [query, setQuery] = useState('')
  const [role, setRole] = useState<MemberRole>('member')
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const { results, loading } = useProfileSearch(query, excludeIds)

  async function handleAdd(userId: string) {
    setError(null)
    setBusyId(userId)
    const result = await onAdd(userId, role)
    setBusyId(null)
    if (!result.ok) setError(result.message ?? 'Could not add')
  }

  return (
    <div className="bg-huginn-surface/60 border border-huginn-border/60 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-huginn-text-muted font-semibold uppercase tracking-wider">Add member</span>
        <button onClick={onCancel} className="text-huginn-text-muted hover:text-white text-xs">Cancel</button>
      </div>

      <div className="flex gap-2 mb-2">
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email…"
          className="flex-1 bg-huginn-card text-sm text-white rounded-md px-3 py-2 outline-none border border-huginn-border focus:border-huginn-accent placeholder-huginn-text-muted"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as MemberRole)}
          className="bg-huginn-card border border-huginn-border text-xs text-huginn-text-primary rounded-md px-2 py-1 outline-none cursor-pointer"
          title="Role"
        >
          <option value="admin">Admin</option>
          <option value="member">Member</option>
        </select>
      </div>

      {query.trim().length < 2 ? (
        <p className="text-[11px] text-huginn-text-muted px-1 py-1">Type at least 2 characters to search.</p>
      ) : loading ? (
        <p className="text-[11px] text-huginn-text-muted px-1 py-1">Searching…</p>
      ) : results.length === 0 ? (
        <p className="text-[11px] text-huginn-text-muted px-1 py-1">No matching users. They need a Huginn account first.</p>
      ) : (
        <div className="space-y-1 max-h-56 overflow-y-auto">
          {results.map((p) => (
            <button
              key={p.id}
              onClick={() => handleAdd(p.id)}
              disabled={busyId === p.id}
              className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-huginn-hover transition-colors text-left disabled:opacity-50"
            >
              <Avatar url={p.avatar_url} name={p.display_name} email={p.email} size={28} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-huginn-text-primary truncate">{p.display_name || p.email}</p>
                {p.display_name && p.email && (
                  <p className="text-[11px] text-huginn-text-muted truncate">{p.email}</p>
                )}
              </div>
              <span className="text-[10px] uppercase tracking-wider font-bold text-huginn-accent">
                {busyId === p.id ? '…' : 'Add'}
              </span>
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-[11px] text-huginn-danger mt-2 px-1">{error}</p>}
    </div>
  )
}
