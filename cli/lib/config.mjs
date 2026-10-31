import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export const NO_PROJECT = 'Ekkert verkefni fundið, keyrðu í repoi með .huginn-project eða gefðu --project'
const PROJECT_FILE = '.huginn-project'
const CREDENTIAL_FIELDS = ['url', 'anonKey', 'email', 'password']

// Flags that never take a value. Any other flag takes the next word as its
// value unless that word is itself a flag. The write commands parse their own
// flags strictly (parseCommand in write.mjs); this list only keeps main from
// reading a positional after --force or --dropped as a flag value.
const BOOLEAN_FLAGS = new Set(['json', 'debug', 'help', 'force', 'dropped', 'dry-run'])

export function huginnDir(home = homedir()) {
  return join(home, '.huginn')
}

export function parseArgs(argv) {
  const positional = []
  const flags = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith('--') || arg === '--') {
      positional.push(arg)
      continue
    }
    const body = arg.slice(2)
    const eq = body.indexOf('=')
    if (eq >= 0) {
      flags[body.slice(0, eq)] = body.slice(eq + 1)
      continue
    }
    const next = argv[i + 1]
    if (BOOLEAN_FLAGS.has(body) || next === undefined || next.startsWith('--')) {
      flags[body] = true
    } else {
      flags[body] = next
      i++
    }
  }
  return { positional, flags }
}

export function loadCredentials(home = homedir()) {
  const path = join(huginnDir(home), 'credentials.json')
  let raw
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    throw new Error(`Innskráningu vantar: ${path} fannst ekki. Sjá cli/README.md.`)
  }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`${path} er ekki gilt JSON.`)
  }
  const missing = CREDENTIAL_FIELDS.filter((k) => typeof parsed?.[k] !== 'string' || parsed[k] === '')
  if (missing.length) throw new Error(`Í ${path} vantar: ${missing.join(', ')}.`)
  return { url: parsed.url, anonKey: parsed.anonKey, email: parsed.email, password: parsed.password }
}

function readSlug(file) {
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (t.startsWith('slug=')) {
      const slug = t.slice(5).trim()
      if (slug) return slug
    }
  }
  throw new Error(`${file} vantar línuna slug=<verkefni>.`)
}

// The nearest .huginn-project in cwd or a parent: { dir, slug }, or null.
export function findProjectFile(cwd) {
  let dir = cwd
  for (;;) {
    const file = join(dir, PROJECT_FILE)
    if (existsSync(file)) return { dir, slug: readSlug(file) }
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

// Order: --project, then .huginn-project in cwd or the nearest parent.
export function resolveProject(cwd, argv) {
  const { flags } = parseArgs(argv)
  if (flags.project !== undefined) {
    if (typeof flags.project !== 'string' || !flags.project.trim()) throw new Error('--project vantar gildi.')
    return { slug: flags.project.trim() }
  }
  const found = findProjectFile(cwd)
  if (found) return { slug: found.slug }
  throw new Error(NO_PROJECT)
}

// Default folder for huginn sync (ruling R8): docs/huginn in the folder that
// holds .huginn-project, or in cwd when --project is given and there is none.
// A --project that names another project than .huginn-project needs --out,
// so one project's mirror never lands in another project's repo.
export function defaultMirrorDir(cwd, projectFlag) {
  const found = findProjectFile(cwd)
  if (!found) return join(cwd, 'docs', 'huginn')
  const wanted = typeof projectFlag === 'string' ? projectFlag.trim() : undefined
  if (wanted && wanted !== found.slug) {
    throw new Error(`--project ${wanted} passar ekki við .huginn-project (${found.slug}) í ${found.dir}. Gefðu --out.`)
  }
  return join(found.dir, 'docs', 'huginn')
}

function maskString(text, secrets) {
  let out = text
  for (const s of secrets) {
    if (s) out = out.split(s).join('***')
  }
  return out
}

// Returns a copy without any key named password (any case), and with every
// secret value masked inside strings.
export function redact(value, secrets = []) {
  if (typeof value === 'string') return maskString(value, secrets)
  if (Array.isArray(value)) return value.map((v) => redact(v, secrets))
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      if (k.toLowerCase() === 'password') continue
      out[k] = redact(v, secrets)
    }
    return out
  }
  return value
}
