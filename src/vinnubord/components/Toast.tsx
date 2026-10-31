import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { NewItemToast } from '../lib/toast'

// The small notice at the bottom of the board when someone else's new item
// arrives through realtime. It shows for TOAST_MS, a tap opens the item.
// A newer toast replaces the shown one and starts its own time.

const TOAST_MS = 4000

type Props = {
  toast: NewItemToast | null
  // The side panel or bottom sheet is open: the toast moves out of its way.
  panelOpen: boolean
  onOpen: (itemId: string) => void
  onDone: () => void
}

export function Toast({ toast, panelOpen, onOpen, onDone }: Props) {
  const { t } = useTranslation()

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(onDone, TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast, onDone])

  return (
    <div className={`hg-toast-wrap${panelOpen ? ' hg-toast-panel' : ''}`} role="status" aria-live="polite">
      {toast && (
        <button
          key={toast.eventId}
          type="button"
          className="hg-toast"
          onClick={() => {
            onOpen(toast.itemId)
            onDone()
          }}
        >
          <i className="hg-toast-dot" aria-hidden="true" />
          <span className="hg-toast-text">{t('vinnubord.toast.newItem', { short: toast.short, title: toast.title })}</span>
        </button>
      )}
    </div>
  )
}
