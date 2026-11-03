import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'

const MarkdownView = lazy(() => import('./MarkdownView'))

// Markdown reader for item bodies and md files (sanitized, see lib/markdown).
// The renderer arrives in its own chunk on first use. headingIds gives h1 to
// h3 the ids the file reader's contents link to; the status tab leaves it off.
export function Markdown({ source, headingIds }: { source: string; headingIds?: boolean }) {
  const { t } = useTranslation()
  return (
    <Suspense fallback={<p className="hg-pn-muted">{t('vinnubord.loading')}</p>}>
      <MarkdownView source={source} headingIds={headingIds} />
    </Suspense>
  )
}
