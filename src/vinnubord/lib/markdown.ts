import { marked } from 'marked'
import createDOMPurify, { type Config, type DOMPurify } from 'dompurify'

// Markdown from item bodies and uploaded files is untrusted. It may not
// restyle the app (no style elements or attributes), plant a form that posts
// elsewhere, or load images over anything but https. Links open in a new tab
// without access to this window.

const CONFIG: Config = {
  FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'option'],
  FORBID_ATTR: ['style', 'action', 'formaction'],
}

// A dedicated instance, so the hook below never reaches other DOMPurify users.
let purifier: DOMPurify | null = null

function getPurifier(): DOMPurify {
  if (purifier) return purifier
  const p = createDOMPurify(window)
  p.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && node.getAttribute('href')) {
      node.setAttribute('target', '_blank')
      node.setAttribute('rel', 'noopener noreferrer')
    }
    if (node.tagName === 'IMG' && !/^https:\/\//i.test(node.getAttribute('src') ?? '')) {
      node.remove()
    }
  })
  purifier = p
  return p
}

export function renderMarkdown(source: string): string {
  const raw = marked.parse(source, { async: false, gfm: true, breaks: true })
  return getPurifier().sanitize(raw, CONFIG) as string
}
