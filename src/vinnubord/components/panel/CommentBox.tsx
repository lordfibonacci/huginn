import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAsyncAction } from '../../hooks/useAsyncAction'

type Props = {
  onSend: (body: string) => Promise<void>
}

// Comment field at the bottom of a panel. The draft is this component's own
// state, never derived from board data, so a realtime refetch keeps it.
export function CommentBox({ onSend }: Props) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState('')
  const { busy, error, run } = useAsyncAction()
  const body = draft.trim()

  const send = async () => {
    if (!body || busy) return
    const sent = body
    const ok = await run(() => onSend(sent))
    // Clear only what was sent: text typed while it was on the way stays.
    if (ok) setDraft((d) => (d.trim() === sent ? '' : d))
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void send()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      void send()
    }
  }

  return (
    <form className="hg-compose" onSubmit={onSubmit}>
      {error && (
        <p className="hg-pn-error" role="alert">
          {error}
        </p>
      )}
      <div className="hg-compose-row">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('vinnubord.panel.comment.placeholder')}
          aria-label={t('vinnubord.panel.comment.placeholder')}
          title={t('vinnubord.panel.comment.hint')}
          rows={1}
        />
        <button type="submit" className="hg-btn hg-btn-primary" disabled={!body || busy}>
          {t('vinnubord.panel.comment.send')}
        </button>
      </div>
    </form>
  )
}
