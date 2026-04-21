import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePendingInvites, type PendingInvite } from '../hooks/usePendingInvites'
import { Avatar } from '../../../shared/components/Avatar'
import { ProjectGlyph } from './ProjectGlyph'
import { getBackground } from '../../../shared/lib/boardBackgrounds'

export function PendingInvitesPanel() {
  const { t } = useTranslation()
  const { invites, loading, accept, decline } = usePendingInvites()

  if (loading || invites.length === 0) return null

  return (
    <section className="mb-8">
      <h2 className="text-[11px] uppercase tracking-widest text-huginn-accent font-bold mb-3 px-0.5 flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-huginn-accent animate-pulse" />
        {t('projects.invites.heading')}
        <span className="text-huginn-text-muted font-semibold normal-case tracking-normal">
          {t('projects.invites.countSuffix', { count: invites.length })}
        </span>
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {invites.map((invite) => (
          <InviteCard
            key={invite.member_id}
            invite={invite}
            onAccept={() => accept(invite.member_id)}
            onDecline={() => decline(invite.member_id)}
          />
        ))}
      </div>
    </section>
  )
}

function InviteCard({ invite, onAccept, onDecline }: {
  invite: PendingInvite
  onAccept: () => Promise<boolean>
  onDecline: () => Promise<boolean>
}) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null)
  const bg = getBackground(invite.project_background ?? 'default')

  async function handleAccept() {
    setBusy('accept')
    await onAccept()
  }

  async function handleDecline() {
    if (!window.confirm(t('projects.invites.confirmDecline', { name: invite.project_name }))) return
    setBusy('decline')
    await onDecline()
  }

  const inviterLabel = invite.invited_by_name || invite.invited_by_email || t('projects.invites.inviterFallback')

  return (
    <div className="relative rounded-xl overflow-hidden border border-huginn-accent/40 ring-1 ring-huginn-accent/20 bg-huginn-card">
      {/* Top — board preview strip with glyph + name */}
      <div
        className="relative h-20 px-4 flex items-end pb-3"
        style={{ background: bg.style }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
        <div className="relative flex items-center gap-2.5">
          <ProjectGlyph color={invite.project_color} size={20} />
          <h3 className="text-base font-bold text-white drop-shadow-sm truncate">
            {invite.project_name}
          </h3>
        </div>
      </div>

      {/* Body — inviter + role + actions */}
      <div className="p-3.5 space-y-3">
        <div className="flex items-center gap-2.5">
          <Avatar
            url={invite.invited_by_avatar_url}
            name={invite.invited_by_name}
            email={invite.invited_by_email}
            size={28}
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-huginn-text-secondary leading-tight">
              <span className="font-semibold text-white">{inviterLabel}</span> {t('projects.invites.invitedYouAs')}
            </p>
            <p className="text-xs">
              <span className="font-bold uppercase tracking-wider text-huginn-accent">
                {t(`projects.role.${invite.role}`, { defaultValue: invite.role })}
              </span>
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleDecline}
            disabled={busy !== null}
            className="flex-1 text-sm text-huginn-text-secondary hover:text-huginn-danger hover:bg-huginn-danger/10 transition-colors py-2 rounded-lg disabled:opacity-50"
          >
            {busy === 'decline' ? '…' : t('projects.invites.decline')}
          </button>
          <button
            onClick={handleAccept}
            disabled={busy !== null}
            className="flex-1 bg-huginn-accent hover:bg-huginn-accent-hover text-white text-sm font-semibold py-2 rounded-lg disabled:opacity-50 shadow-sm shadow-huginn-accent/30"
          >
            {busy === 'accept' ? '…' : t('projects.invites.accept')}
          </button>
        </div>
      </div>
    </div>
  )
}
