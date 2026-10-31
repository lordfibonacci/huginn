import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'

const MarkdownView = lazy(() => import('./MarkdownView'))

// Markdown reader for item bodies and md files (sanitized, see lib/markdown).
// The renderer arrives in its own chunk on first use.
export function Markdown({ source }: { source: string }) {
  const { t } = useTranslation()
  return (
    <Suspense fallback={<p className="hg-pn-muted">{t('vinnubord.loading')}</p>}>
      <MarkdownView source={source} />
    </Suspense>
  )
}
