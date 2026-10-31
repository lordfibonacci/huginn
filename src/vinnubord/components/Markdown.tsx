import { useMemo } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

// Links in rendered markdown open in a new tab and cannot reach this window.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('href')) {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

// Markdown reader for item bodies and md files: marked, then DOMPurify.
export function Markdown({ source }: { source: string }) {
  const html = useMemo(() => {
    const raw = marked.parse(source, { async: false, gfm: true, breaks: true })
    return DOMPurify.sanitize(raw)
  }, [source])
  return <div className="hg-markdown" dangerouslySetInnerHTML={{ __html: html }} />
}
