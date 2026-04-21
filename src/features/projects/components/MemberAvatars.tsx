import { useTranslation } from 'react-i18next'
import type { Profile } from '../../../shared/lib/types'

interface MemberAvatarsProps {
  profiles: Profile[]
  size?: 'sm' | 'md'
  max?: number
}

function getInitials(profile: Profile): string {
  if (profile.display_name) {
    return profile.display_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  }
  if (profile.email) {
    return profile.email[0].toUpperCase()
  }
  return '?'
}

const AVATAR_COLORS = [
  'bg-huginn-accent', 'bg-huginn-success', 'bg-huginn-warning', 'bg-huginn-danger',
  'bg-[#0984e3]', 'bg-[#e84393]',
]

function getAvatarColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i)
    hash |= 0
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function MemberAvatars({ profiles, size = 'md', max = 5 }: MemberAvatarsProps) {
  const { t } = useTranslation()
  if (profiles.length === 0) return null

  const shown = profiles.slice(0, max)
  const overflow = profiles.length - max

  const sizeClasses = size === 'sm'
    ? 'w-5 h-5 text-[8px]'
    : 'w-7 h-7 text-[10px]'

  return (
    <div className="flex -space-x-1.5">
      {shown.map((profile) => (
        <div
          key={profile.id}
          className={`${sizeClasses} rounded-full ${getAvatarColor(profile.id)} flex items-center justify-center font-bold text-white ring-2 ring-huginn-surface`}
          title={profile.display_name || profile.email || t('members.fallbackUser')}
        >
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            getInitials(profile)
          )}
        </div>
      ))}
      {overflow > 0 && (
        <div className={`${sizeClasses} rounded-full bg-huginn-card flex items-center justify-center font-bold text-huginn-text-muted ring-2 ring-huginn-surface`}>
          +{overflow}
        </div>
      )}
    </div>
  )
}
