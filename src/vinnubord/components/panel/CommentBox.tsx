import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAsyncAction } from '../../hooks/useAsyncAction'

type Props = {
  onSend: (body: string) => Promise<void>
  // Called after a send went through, the item panel uses it to show the chat.
  onSent?: () => void
}

// Comment field at the bottom of a panel. The draft is this component's own
// state, never derived from board data, so a realtime refetch keeps it.
// With a fine pointer Enter sends and Shift and Enter is a new line; on touch
// Enter is a new line and the button sends. Ctrl or Cmd and Enter send on both.
export function CommentBox({ onSend, onSent }: Props) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState('')
  const [fine] = useState(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: fine)').matches,
  )
  const { busy, error, run } = useAsyncAction()
  const body = draft.trim()

  const send = async () => {
    if (!body || busy) return
    const sent = body
    const ok = await run(() => onSend(sent))
    // Clear only what was sent: text typed while it was on the way stays.
    if (ok) {
      setDraft((d) => (d.trim() === sent ? '' : d))
      onSent?.()
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void send()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
    if (e.ctrlKey || e.metaKey || (fine && !e.shiftKey)) {
      e.preventDefault()
      void send()
    }
  }

  const hint = t(fine ? 'vinnubord.panel.comment.hintFine' : 'vinnubord.panel.comment.hintCoarse')

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
          title={hint}
          rows={1}
        />
        <button type="submit" className="hg-btn hg-btn-primary" disabled={!body || busy}>
          {t('vinnubord.panel.comment.send')}
        </button>
      </div>
    </form>
  )
}
