import { useTranslation } from 'react-i18next'

// Short message with a retry button for a failed load.
export function LoadError({ message, onRetry, centered = false }: { message: string; onRetry: () => void; centered?: boolean }) {
  const { t } = useTranslation()
  return (
    <div className={centered ? 'flex h-full w-full flex-col items-center justify-center gap-3 p-4 text-center' : 'mt-6 space-y-3'}>
      <p className="text-sm text-huginn-danger">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg border border-huginn-border px-3 py-1.5 text-sm text-huginn-text-primary transition-colors hover:bg-huginn-hover"
      >
        {t('vinnubord.board.retry')}
      </button>
    </div>
  )
}
