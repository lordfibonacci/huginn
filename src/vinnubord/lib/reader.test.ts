import { describe, it, expect } from 'vitest'
import { activeHeading, readerKind, showToc } from './reader'

describe('activeHeading', () => {
  it('is 0 before the first heading and on an empty list', () => {
    expect(activeHeading([100, 400], 0)).toBe(0)
    expect(activeHeading([], 500)).toBe(0)
  })
  it('is the last heading above the top edge, with slack', () => {
    expect(activeHeading([0, 300, 600], 299)).toBe(1)
    expect(activeHeading([0, 300, 600], 292)).toBe(1)
    expect(activeHeading([0, 300, 600], 291)).toBe(0)
    expect(activeHeading([0, 300, 600], 10000)).toBe(2)
  })
})

describe('readerKind and showToc', () => {
  it('md and txt open in the reader, nothing else', () => {
    expect(readerKind('a.md')).toBe('md')
    expect(readerKind('A.TXT')).toBe('txt')
    expect(readerKind('a.pdf')).toBeNull()
    expect(readerKind('a.html')).toBeNull()
  })
  it('a toc needs two headings', () => {
    expect(showToc([{ id: 'hg-h-1' }])).toBe(false)
    expect(showToc([{ id: 'hg-h-1' }, { id: 'hg-h-2' }])).toBe(true)
  })
})
