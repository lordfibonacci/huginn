import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

interface TextAttachmentViewerProps {
  url: string
  name: string
  attachmentId: string | null
  kind: 'markdown' | 'text'
  onClose: () => void
  onDelete?: (attachmentId: string) => void | Promise<void>
}

export function isMarkdownAttachment(name: string): boolean {
  return /\.(md|markdown|mdx)$/i.test(name)
}

export function isPlainTextAttachment(name: string): boolean {
  return /\.(txt|log|csv|json|ya?ml)$/i.test(name)
}

export function textAttachmentKind(name: string): 'markdown' | 'text' | null {
  if (isMarkdownAttachment(name)) return 'markdown'
  if (isPlainTextAttachment(name)) return 'text'
  return null
}

export function TextAttachmentViewer({ url, name, attachmentId, kind, onClose, onDelete }: TextAttachmentViewerProps) {
  const { t } = useTranslation()
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setText(null)
    setError(null)
    fetch(url)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.text()
      })
      .then(body => { if (!cancelled) setText(body) })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)) })
    return () => { cancelled = true }
  }, [url])

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onEsc, { capture: true })
    return () => document.removeEventListener('keydown', onEsc, { capture: true } as EventListenerOptions)
  }, [onClose])

  const renderedHtml = useMemo(() => {
    if (kind !== 'markdown' || text == null) return null
    const raw = marked.parse(text, { async: false, gfm: true, breaks: true }) as string
    return DOMPurify.sanitize(raw)
  }, [kind, text])

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-6"
      onClick={(e) => {
        e.stopPropagation()
        onClose()
      }}
    >
      <div
        className="relative w-full max-w-3xl max-h-[82vh] bg-huginn-card border border-huginn-border rounded-lg shadow-2xl shadow-black/60 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-huginn-border/70 bg-huginn-surface/80">
          <p className="text-sm font-medium text-huginn-text-primary truncate">{name}</p>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 text-huginn-text-primary">
          {error && (
            <p className="text-sm text-huginn-danger">{t('card.textViewer.error', { message: error })}</p>
          )}
          {!error && text == null && (
            <p className="text-sm text-huginn-text-muted">{t('card.textViewer.loading')}</p>
          )}
          {!error && text != null && kind === 'markdown' && renderedHtml != null && (
            <div
              className="huginn-markdown text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          )}
          {!error && text != null && kind === 'text' && (
            <pre className="text-xs leading-relaxed whitespace-pre-wrap break-words font-mono text-huginn-text-primary/90">{text}</pre>
          )}
        </div>
      </div>
      <div
        className="mt-4 flex items-center gap-3 text-xs text-white/80 flex-wrap justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-huginn-accent hover:text-white transition-colors"
        >
          {t('card.lightbox.openNewTab')}
        </a>
        <a
          href={url}
          download={name}
          className="text-white/80 hover:text-white transition-colors"
        >
          {t('card.lightbox.download')}
        </a>
        {attachmentId && onDelete && (
          <button
            type="button"
            onClick={async () => {
              await onDelete(attachmentId)
              onClose()
            }}
            className="text-huginn-danger hover:text-white transition-colors"
          >
            {t('card.lightbox.delete')}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="text-white/60 hover:text-white transition-colors"
        >
          {t('card.lightbox.close')}
        </button>
      </div>
    </div>
  )
}
