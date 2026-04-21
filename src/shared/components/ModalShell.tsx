import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface ModalShellProps {
  onDismiss: () => void
  children: React.ReactNode
  title?: string
}

export function ModalShell({ onDismiss, children, title }: ModalShellProps) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  function dismiss() {
    setVisible(false)
    setTimeout(onDismiss, 200)
  }

  return (
    <div className="fixed inset-0 z-50" onClick={dismiss}>
      {/* Backdrop */}
      <div className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`} />

      {/* Mobile: bottom drawer */}
      <div className="md:hidden flex items-end h-full relative">
        <div
          className={`w-full bg-huginn-card rounded-t-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.3)] p-4 pb-[env(safe-area-inset-bottom,16px)] transition-transform duration-200 max-h-[85vh] overflow-y-auto ${
            visible ? 'translate-y-0' : 'translate-y-full'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-10 h-1 bg-gray-500 rounded-full mx-auto mb-4" />
          {title && <p className="text-sm text-huginn-text-secondary mb-3">{title}</p>}
          {children}
        </div>
      </div>

      {/* Desktop: centered modal */}
      <div className="hidden md:flex items-center justify-center h-full relative">
        <div
          className={`bg-huginn-card rounded-xl shadow-2xl w-full max-w-md p-6 transition-all duration-200 max-h-[80vh] overflow-y-auto ${
            visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {title && (
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-huginn-text-primary">{title}</p>
              <button onClick={dismiss} className="text-huginn-text-muted hover:text-white transition-colors" aria-label={t('common.close')}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>
          )}
          {!title && (
            <button onClick={dismiss} className="absolute top-4 right-4 text-huginn-text-muted hover:text-white transition-colors" aria-label={t('common.close')}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          )}
          {children}
        </div>
      </div>
    </div>
  )
}
