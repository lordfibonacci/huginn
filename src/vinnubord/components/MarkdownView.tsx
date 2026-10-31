import { useMemo } from 'react'
import { renderMarkdown } from '../lib/markdown'

// The markdown reader itself. Loaded lazily through Markdown.tsx so marked
// and DOMPurify stay out of the main chunk.
export default function MarkdownView({ source }: { source: string }) {
  const html = useMemo(() => renderMarkdown(source), [source])
  return <div className="hg-markdown" dangerouslySetInnerHTML={{ __html: html }} />
}
