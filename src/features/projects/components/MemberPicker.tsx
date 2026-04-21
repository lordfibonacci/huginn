import { useTranslation } from 'react-i18next'
import type { Profile } from '../../../shared/lib/types'

interface BoardMemberInfo {
  user_id: string
  role: string
  profile?: Profile
}

interface MemberPickerProps {
  boardMembers: BoardMemberInfo[]
  assignedIds: string[]
  onToggle: (userId: string) => void
  onClose: () => void
}

function getInitials(profile?: Profile): string {
  if (!profile) return '?'
  if (profile.display_name) {
    return profile.display_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  }
  return profile.email?.[0]?.toUpperCase() ?? '?'
}

export function MemberPicker({ boardMembers, assignedIds, onToggle, onClose }: MemberPickerProps) {
  const { t } = useTranslation()
  return (
    <>
      {/* Backdrop to close on outside click */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div className="absolute top-full left-0 mt-1.5 z-50 bg-huginn-card border border-huginn-border rounded-lg shadow-2xl p-3 w-60">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-huginn-text-secondary">{t('members.heading')}</p>
        <button onClick={onClose} className="text-huginn-text-muted hover:text-white">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L6.94 8l-1.72 1.72a.75.75 0 1 0 1.06 1.06L8 9.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L9.06 8l1.72-1.72a.75.75 0 0 0-1.06-1.06L8 6.94 6.28 5.22Z" />
          </svg>
        </button>
      </div>

      <div className="space-y-1">
        {boardMembers.map((member) => {
          const isAssigned = assignedIds.includes(member.user_id)
          const profile = member.profile
          return (
            <button
              key={member.user_id}
              onClick={() => onToggle(member.user_id)}
              className={`flex items-center gap-2.5 w-full px-2 py-1.5 rounded-md text-xs transition-colors ${
                isAssigned ? 'bg-huginn-surface ring-1 ring-huginn-accent' : 'hover:bg-huginn-surface'
              }`}
            >
              <div className="w-6 h-6 rounded-full bg-huginn-accent flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                {getInitials(profile)}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-huginn-text-primary truncate">{profile?.display_name || profile?.email || t('members.unknown')}</p>
                {profile?.display_name && profile?.email && (
                  <p className="text-[10px] text-huginn-text-muted truncate">{profile.email}</p>
                )}
              </div>
              {isAssigned && (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 text-huginn-accent shrink-0">
                  <path fillRule="evenodd" d="M12.4 4.7a.75.75 0 0 1 .1 1.06l-5.25 6a.75.75 0 0 1-1.1.02L3.6 9.1a.75.75 0 1 1 1.1-1.02l2.05 2.22 4.7-5.37a.75.75 0 0 1 1.06-.1l-.1-.13Z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          )
        })}
        {boardMembers.length === 0 && (
          <p className="text-xs text-huginn-text-muted py-2 text-center">{t('members.empty')}</p>
        )}
      </div>
      </div>
    </>
  )
}
