import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { copyText, normalizeForCopy } from '../lib/clipboard'

export const COPIED_MS = 1500

type CopyState = 'idle' | 'ok' | 'fail'

// Copies text and remembers the outcome for COPIED_MS, for the "Afritað" flash.
export function useCopy() {
  const [state, setState] = useState<CopyState>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
  const copy = useCallback(async (text: string) => {
    const ok = await copyText(text)
    setState(ok ? 'ok' : 'fail')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), COPIED_MS)
  }, [])
  return { state, copy }
}

type Props = {
  text: string
  // What is copied, lower case, for the screen reader label ("Afrita næsta
  // skref"). Pass a vinnubord.panel.copyOf key, not a heading.
  what?: string
}

// One tap copy for a prompt, SQL block, path or next step. The text is
// normalized (LF line endings, no trailing whitespace) before it is copied.
export function CopyButton({ text, what }: Props) {
  const { t } = useTranslation()
  const { state, copy } = useCopy()
  const label = what ? t('vinnubord.panel.copyWhat', { what }) : t('vinnubord.panel.copy')
  return (
    <button
      type="button"
      className={`hg-copy${state === 'ok' ? ' hg-copy-ok' : ''}${state === 'fail' ? ' hg-copy-fail' : ''}`}
      onClick={() => void copy(normalizeForCopy(text))}
      aria-label={label}
      title={label}
    >
      {state === 'idle' ? (
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <rect x="5.5" y="5.5" width="8" height="8" rx="2" />
          <path d="M10.5 3.5v-.5a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 3v5A1.5 1.5 0 0 0 4 9.5h.5" />
        </svg>
      ) : (
        <span role="status">{state === 'ok' ? t('vinnubord.panel.copied') : t('vinnubord.panel.copyFailed')}</span>
      )}
    </button>
  )
}
