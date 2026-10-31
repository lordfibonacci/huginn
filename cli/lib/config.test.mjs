import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadCredentials, parseArgs, redact, resolveProject } from './config.mjs'

let root

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'huginn-cli-'))
})

afterAll(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('parseArgs', () => {
  it('splits commands, value flags and boolean flags', () => {
    const r = parseArgs(['pull', '--project', 'metta', '--json', '--since=2026-10-01'])
    expect(r.positional).toEqual(['pull'])
    expect(r.flags).toEqual({ project: 'metta', json: true, since: '2026-10-01' })
  })

  it('treats a flag followed by another flag as boolean', () => {
    expect(parseArgs(['--debug', '--json']).flags).toEqual({ debug: true, json: true })
  })
})

describe('resolveProject', () => {
  it('finds .huginn-project in a parent folder', () => {
    const repo = join(root, 'repo')
    const deep = join(repo, 'src', 'deep')
    mkdirSync(deep, { recursive: true })
    writeFileSync(join(repo, '.huginn-project'), '# Huginn\nslug=metta\n')
    expect(resolveProject(deep, [])).toEqual({ slug: 'metta' })
  })

  it('prefers --project over the file', () => {
    const repo = join(root, 'repo2')
    mkdirSync(repo, { recursive: true })
    writeFileSync(join(repo, '.huginn-project'), 'slug=metta\n')
    expect(resolveProject(repo, ['pull', '--project', 'annad'])).toEqual({ slug: 'annad' })
  })

  it('throws the Icelandic error with no file and no --project', () => {
    const lone = join(root, 'lone')
    mkdirSync(lone, { recursive: true })
    expect(() => resolveProject(lone, ['pull'])).toThrow(
      'Ekkert verkefni fundið, keyrðu í repoi með .huginn-project eða gefðu --project',
    )
  })

  it('throws when the file has no slug line', () => {
    const repo = join(root, 'noslug')
    mkdirSync(repo, { recursive: true })
    writeFileSync(join(repo, '.huginn-project'), 'nafn=metta\n')
    expect(() => resolveProject(repo, [])).toThrow('slug=')
  })
})

describe('redact', () => {
  it('removes password keys at any depth and leaves the rest', () => {
    const input = { url: 'u', password: 'leyndo', nested: { Password: 'x', keep: 1 }, list: [{ password: 'y' }] }
    expect(redact(input)).toEqual({ url: 'u', nested: { keep: 1 }, list: [{}] })
    expect(input.password).toBe('leyndo')
  })

  it('masks secret values inside strings', () => {
    expect(redact('villa: leyndo12345 hafnað', ['leyndo12345'])).toBe('villa: *** hafnað')
    expect(redact({ msg: 'leyndo12345' }, ['leyndo12345'])).toEqual({ msg: '***' })
  })
})

describe('loadCredentials', () => {
  it('reads the credentials file', () => {
    const home = join(root, 'home-ok')
    mkdirSync(join(home, '.huginn'), { recursive: true })
    const creds = { url: 'https://x.supabase.co', anonKey: 'anon', email: 'a@b.is', password: 'leyndo12345' }
    writeFileSync(join(home, '.huginn', 'credentials.json'), JSON.stringify(creds))
    expect(loadCredentials(home)).toEqual(creds)
  })

  it('throws in Icelandic when the file is missing', () => {
    expect(() => loadCredentials(join(root, 'home-none'))).toThrow('credentials.json fannst ekki')
  })

  it('names missing fields without echoing values', () => {
    const home = join(root, 'home-partial')
    mkdirSync(join(home, '.huginn'), { recursive: true })
    writeFileSync(join(home, '.huginn', 'credentials.json'), JSON.stringify({ url: 'u', password: 'leyndo12345' }))
    let message = ''
    try {
      loadCredentials(home)
    } catch (e) {
      message = e.message
    }
    expect(message).toContain('anonKey')
    expect(message).toContain('email')
    expect(message).not.toContain('leyndo12345')
  })
})
