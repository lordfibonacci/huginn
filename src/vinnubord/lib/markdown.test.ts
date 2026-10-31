// @vitest-environment jsdom
import DOMPurify from 'dompurify'
import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './markdown'

function dom(html: string): HTMLElement {
  const el = document.createElement('div')
  el.innerHTML = html
  return el
}

describe('renderMarkdown', () => {
  it('renders ordinary markdown', () => {
    const el = dom(renderMarkdown('# Titill\n\n**feitt** og `kóði`\n\n- a\n- b'))
    expect(el.querySelector('h1')?.textContent).toBe('Titill')
    expect(el.querySelector('strong')?.textContent).toBe('feitt')
    expect(el.querySelectorAll('li')).toHaveLength(2)
  })

  it('strips style elements and inline styles', () => {
    const el = dom(renderMarkdown('<style>body{display:none}</style>\n\n<p style="position:fixed">x</p>'))
    expect(el.querySelector('style')).toBeNull()
    expect(el.querySelector('[style]')).toBeNull()
    expect(el.textContent).not.toContain('display:none')
  })

  it('strips forms and form controls', () => {
    const el = dom(
      renderMarkdown(
        '<form action="https://evil.example/steal"><input name="p"><textarea></textarea><select><option>a</option></select><button formaction="https://evil.example">Senda</button></form>',
      ),
    )
    expect(el.querySelector('form, input, textarea, select, option, button')).toBeNull()
    expect(el.querySelector('[action], [formaction]')).toBeNull()
  })

  it('removes javascript links and opens other links in a new tab', () => {
    const el = dom(renderMarkdown('[a](javascript:alert(1)) [b](https://huginn.pro)'))
    const links = [...el.querySelectorAll('a')]
    expect(links.some((a) => (a.getAttribute('href') ?? '').startsWith('javascript'))).toBe(false)
    const ok = links.find((a) => a.getAttribute('href') === 'https://huginn.pro')
    expect(ok?.getAttribute('target')).toBe('_blank')
    expect(ok?.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('keeps https images only', () => {
    const el = dom(
      renderMarkdown('![a](https://x.example/a.png) ![b](http://x.example/b.png) <img src="data:image/png;base64,AAAA"> <img src="/c.png">'),
    )
    const srcs = [...el.querySelectorAll('img')].map((i) => i.getAttribute('src'))
    expect(srcs).toEqual(['https://x.example/a.png'])
  })

  it('leaves the shared DOMPurify instance untouched', () => {
    renderMarkdown('[b](https://huginn.pro)')
    const out = DOMPurify.sanitize('<a href="https://huginn.pro">b</a><p style="color:red">x</p>')
    expect(out).toContain('style=')
    expect(out).not.toContain('target=')
  })
})
