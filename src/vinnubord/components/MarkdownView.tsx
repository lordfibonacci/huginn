import { useMemo } from 'react'
import { renderMarkdown } from '../lib/markdown'

// The markdown reader itself. Loaded lazily through Markdown.tsx so marked
// and DOMPurify stay out of the main chunk.
export default function MarkdownView({ source, headingIds }: { source: string; headingIds?: boolean }) {
  const html = useMemo(() => renderMarkdown(source, { headingIds }), [source, headingIds])
  return <div className="hg-markdown" dangerouslySetInnerHTML={{ __html: html }} />
}
