import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAsyncAction } from '../../hooks/useAsyncAction'
import { addParticipantByEmail, removeParticipant } from '../../lib/api'
import { participantRemoveBlock, validateShort } from '../../lib/settings'
import type { Participant } from '../../lib/types'
import { Actions, Field } from './parts'

type Props = { projectId: string; participants: Participant[]; viewerId: string; onChange: () => void }

// Who is in the project. Anyone can be removed except yourself and the
// service user (ruling R24). New people are added by the email of an
// existing account, through the hg_add_participant function.
export function ParticipantsEditor({ projectId, participants, viewerId, onChange }: Props) {
  const { t } = useTranslation()
  return (
    <section className="hg-set-sec" aria-labelledby="hg-set-participants">
      <h2 id="hg-set-participants">{t('vinnubord.settings.participants.title')}</h2>
      <p className="hg-set-hint">{t('vinnubord.settings.participants.hint')}</p>
      <ul className="hg-set-list">
        {participants.map((p) => (
          <li key={p.id}>
            <ParticipantRow participant={p} viewerId={viewerId} onRemoved={onChange} />
          </li>
        ))}
      </ul>
      <NewParticipant projectId={projectId} participants={participants} onSaved={onChange} />
    </section>
  )
}

function ParticipantRow({ participant, viewerId, onRemoved }: { participant: Participant; viewerId: string; onRemoved: () => void }) {
  const { t } = useTranslation()
  const { busy, error, run } = useAsyncAction()
  const removable = participantRemoveBlock(participant, viewerId) === null

  async function remove() {
    if (!window.confirm(t('vinnubord.settings.participants.removeConfirm', { name: participant.display_name }))) return
    if (await run(() => removeParticipant(participant, viewerId))) onRemoved()
  }

  return (
    <div className="hg-set-row hg-set-person">
      <span className={`hg-set-av${participant.is_service ? ' hg-set-av-service' : ''}`} aria-hidden="true">
        {participant.short}
      </span>
      <span className="hg-set-who">
        <b>{participant.display_name}</b>
        {participant.user_id === viewerId && <span className="hg-set-badge">{t('vinnubord.settings.participants.you')}</span>}
        {participant.is_service && <span className="hg-set-badge">{t('vinnubord.settings.participants.service')}</span>}
      </span>
      {removable && (
        <Actions error={error}>
          <button type="button" className="hg-btn hg-btn-ghost hg-btn-danger" disabled={busy} onClick={() => void remove()}>
            {t('vinnubord.settings.remove')}
          </button>
        </Actions>
      )}
    </div>
  )
}

function NewParticipant({ projectId, participants, onSaved }: { projectId: string; participants: Participant[]; onSaved: () => void }) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [short, setShort] = useState('')
  const [name, setName] = useState('')
  const [invalid, setInvalid] = useState<string | null>(null)
  const { busy, error, run } = useAsyncAction()
  const ready = email.trim() !== '' && short.trim() !== '' && name.trim() !== ''

  async function add() {
    const reason = validateShort(short, participants)
    setInvalid(reason)
    if (reason) return
    const ok = await run(async () => {
      await addParticipantByEmail(projectId, email, short, name)
    })
    if (ok) {
      setEmail('')
      setShort('')
      setName('')
      onSaved()
    }
  }

  return (
    <form
      className="hg-set-row hg-set-row-new"
      onSubmit={(e) => {
        e.preventDefault()
        if (ready && !busy) void add()
      }}
    >
      <p className="hg-set-row-title">{t('vinnubord.settings.participants.newTitle')}</p>
      <Field className="hg-set-field-wide" label={t('vinnubord.settings.participants.email')} hint={t('vinnubord.settings.participants.addHint')}>
        <input
          type="email"
          autoComplete="off"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
        />
      </Field>
      <Field label={t('vinnubord.settings.participants.name')}>
        <input value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
      </Field>
      <Field className="hg-set-field-coord" label={t('vinnubord.settings.participants.short')}>
        <input value={short} onChange={(e) => setShort(e.target.value)} disabled={busy} maxLength={3} />
      </Field>
      <Actions error={invalid ?? error}>
        <button type="submit" className="hg-btn hg-btn-primary" disabled={!ready || busy}>
          {t('vinnubord.settings.add')}
        </button>
      </Actions>
    </form>
  )
}
