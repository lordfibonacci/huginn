import { Marked, marked, type Token, type Tokens } from 'marked'
import createDOMPurify, { type Config, type DOMPurify } from 'dompurify'

// Markdown from item bodies and uploaded files is untrusted. It may not
// restyle the app (no style elements or attributes), plant a form that posts
// elsewhere, or load images over anything but https (srcset is stripped, it
// would bypass the src check). Links open in a new tab without access to this
// window.

const CONFIG: Config = {
  FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'option'],
  FORBID_ATTR: ['style', 'action', 'formaction', 'srcset'],
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

export type Heading = { id: string; level: 1 | 2 | 3; text: string }

type Numbered = { token: Tokens.Heading; heading: Heading }

function inlineText(tokens: Token[] | undefined): string {
  return (tokens ?? []).map((t) => ('text' in t && typeof t.text === 'string' ? t.text : '')).join('')
}

// The h1 to h3 headings at the top level of the document, numbered from 1 in
// order. Headings nested in a list or a quote get no id, so the outline and
// the ids in the html always agree.
function numberHeadings(tokens: Token[]): Numbered[] {
  const out: Numbered[] = []
  for (const t of tokens) {
    if (t.type !== 'heading') continue
    const token = t as Tokens.Heading
    if (token.depth > 3) continue
    out.push({
      token,
      heading: {
        id: `hg-h-${out.length + 1}`,
        level: token.depth as 1 | 2 | 3,
        text: inlineText(token.tokens).trim(),
      },
    })
  }
  return out
}

export function outline(source: string): Heading[] {
  return numberHeadings(marked.lexer(source, { gfm: true })).map((n) => n.heading)
}

// Without options the output is exactly the plain render the status tab has
// always used. With headingIds a fresh Marked instance per call gives every
// numbered heading its id, so the shared marked default is never changed.
export function renderMarkdown(source: string, options?: { headingIds?: boolean }): string {
  if (!options?.headingIds) {
    const raw = marked.parse(source, { async: false, gfm: true, breaks: true })
    return getPurifier().sanitize(raw, CONFIG) as string
  }
  const md = new Marked({ async: false, gfm: true, breaks: true })
  const tokens = md.lexer(source)
  const ids = new Map<Token, string>(numberHeadings(tokens).map((n) => [n.token, n.heading.id]))
  md.use({
    renderer: {
      heading(token) {
        const id = ids.get(token)
        if (!id) return false
        return `<h${token.depth} id="${id}">${this.parser.parseInline(token.tokens)}</h${token.depth}>\n`
      },
    },
  })
  const raw = md.parser(tokens)
  return getPurifier().sanitize(raw, CONFIG) as string
}
