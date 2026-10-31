import { describe, expect, it } from 'vitest'
import { normalizeForCopy } from './clipboard'

describe('normalizeForCopy', () => {
  it('turns CRLF and lone CR into LF', () => {
    expect(normalizeForCopy('a\r\nb\rc')).toBe('a\nb\nc')
  })

  it('removes trailing spaces and tabs on every line', () => {
    expect(normalizeForCopy('select 1;  \n  from x\t\nend ')).toBe('select 1;\n  from x\nend')
  })

  it('keeps inner blank lines and leading indentation', () => {
    const sql = 'begin;\n\n  update t set a = 1;\n\n\ncommit;'
    expect(normalizeForCopy(sql)).toBe(sql)
  })

  it('keeps spaces inside a line', () => {
    expect(normalizeForCopy('claude --model opus  í  d:\\x')).toBe('claude --model opus  í  d:\\x')
  })

  it('leaves leading and trailing newlines alone', () => {
    expect(normalizeForCopy('\nVerk\n')).toBe('\nVerk\n')
  })

  it('turns a whitespace only line into an empty line', () => {
    expect(normalizeForCopy('a\n   \nb')).toBe('a\n\nb')
  })

  it('returns an empty string unchanged', () => {
    expect(normalizeForCopy('')).toBe('')
  })
})
