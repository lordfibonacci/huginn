import { useTranslation } from 'react-i18next'
import { Avatar } from '../../../shared/components/Avatar'
import { useBoardMembers } from '../hooks/useBoardMembers'

interface BoardMembersStackProps {
  projectId: string
  onClick?: () => void
  max?: number
}

export function BoardMembersStack({ projectId, onClick, max = 4 }: BoardMembersStackProps) {
  const { t } = useTranslation()
  const { activeMembers, loading } = useBoardMembers(projectId)

  const visible = activeMembers.slice(0, max)
  const overflow = activeMembers.length - visible.length

  // Empty-state placeholder: a single person icon that still opens the drawer
  // so the owner can invite their first member.
  if (loading || visible.length === 0) {
    return (
      <button
        onClick={onClick}
        className="flex items-center justify-center w-7 h-7 rounded-full text-huginn-text-muted hover:text-white hover:bg-huginn-hover transition-colors"
        title={t('members.stack.label')}
        aria-label={t('members.stack.label')}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-7 9a7 7 0 1 1 14 0H3Z" />
        </svg>
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className="flex items-center -space-x-1.5 rounded-full p-0.5 hover:bg-huginn-hover/40 transition-colors group"
      title={activeMembers.length === 1
        ? t('members.stack.titleOne', { count: activeMembers.length })
        : t('members.stack.titleOther', { count: activeMembers.length })}
      aria-label={t('members.stack.label')}
    >
      {visible.map((m) => (
        <div
          key={m.id}
          className="ring-2 ring-huginn-base group-hover:ring-huginn-hover transition-colors rounded-full"
        >
          <Avatar
            url={m.profile?.avatar_url}
            name={m.profile?.display_name}
            email={m.profile?.email}
            size={24}
          />
        </div>
      ))}
      {overflow > 0 && (
        <div className="ring-2 ring-huginn-base group-hover:ring-huginn-hover w-6 h-6 rounded-full bg-huginn-card text-[10px] font-bold text-huginn-text-secondary flex items-center justify-center">
          +{overflow}
        </div>
      )}
    </button>
  )
}
