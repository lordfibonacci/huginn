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

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-semibold text-huginn-text-secondary hover:text-white hover:bg-huginn-hover transition-colors group"
      title={activeMembers.length === 1
        ? t('members.stack.titleOne', { count: activeMembers.length })
        : t('members.stack.titleOther', { count: activeMembers.length })}
    >
      {!loading && visible.length > 0 && (
        <div className="flex -space-x-1.5">
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
        </div>
      )}
      <span className="flex items-center gap-1">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
          <path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-7 9a7 7 0 1 1 14 0H3Z" />
        </svg>
        {t('members.stack.label')}
      </span>
    </button>
  )
}
