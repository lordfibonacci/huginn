#!/usr/bin/env node
// huginn: command line tool for the Huginn whiteboard. See cli/README.md.
import { getClient, getMe, getProject, getUser, loadBoard } from './lib/client.mjs'
import { loadCredentials, parseArgs, redact, resolveProject } from './lib/config.mjs'
import { filterSince, statusMarkdown } from './lib/format.mjs'

const USAGE = `Notkun: huginn <skipun> [rofar]

Skipanir:
  login                 Prófar innskráningu úr ~/.huginn/credentials.json
  whoami                Sýnir notanda og þátttakanda í verkefninu
  pull [--since ISO]    Sækir borðið og prentar stöðuna

Rofar:
  --project <slug>      Verkefni, annars úr .huginn-project í möppunni eða foreldri
  --json                JSON í stað texta
  --debug               Prentar stack við villu
  --help                Þessi texti
`

// Every secret we know of, masked in all output. Never throws.
function knownSecrets() {
  try {
    return [loadCredentials().password]
  } catch {
    return []
  }
}

function out(value, flags) {
  const secrets = knownSecrets()
  const text = flags.json ? JSON.stringify(redact(value, secrets), null, 2) : redact(String(value), secrets)
  process.stdout.write(text.endsWith('\n') ? text : `${text}\n`)
}

async function login(argv, flags) {
  const client = await getClient({ fresh: true })
  const user = await getUser(client)
  out(flags.json ? { ok: true, email: user.email, user_id: user.id } : `Innskráð(ur) sem ${user.email}.`, flags)
}

async function whoami(argv, flags) {
  const { slug } = resolveProject(process.cwd(), argv)
  const client = await getClient()
  const user = await getUser(client)
  const project = await getProject(client, slug)
  const me = await getMe(client, project.id)
  if (flags.json) {
    out(
      {
        email: user.email,
        user_id: user.id,
        project: { id: project.id, slug: project.slug, name: project.name },
        participant: { id: me.id, display_name: me.display_name, short: me.short, is_service: me.is_service },
      },
      flags,
    )
    return
  }
  const kind = me.is_service ? ', þjónustunotandi' : ''
  out(
    [`${user.email}`, `Verkefni: ${project.name} (${project.slug})`, `Þátttakandi: ${me.display_name} (${me.short})${kind}`].join(
      '\n',
    ),
    flags,
  )
}

async function pull(argv, flags) {
  const { slug } = resolveProject(process.cwd(), argv)
  if (flags.since !== undefined && (typeof flags.since !== 'string' || Number.isNaN(Date.parse(flags.since)))) {
    throw new Error('--since þarf ISO dagsetningu, t.d. 2026-10-31T00:00:00Z.')
  }
  const client = await getClient()
  const project = await getProject(client, slug)
  let data = await loadBoard(client, project.id)
  if (flags.since) data = filterSince(data, flags.since)
  out(flags.json ? data : statusMarkdown(data, data.participants), flags)
}

const COMMANDS = { login, whoami, pull }

async function main(argv) {
  const { positional, flags } = parseArgs(argv)
  const name = positional[0]
  if (flags.help || !name || name === 'help') {
    process.stdout.write(USAGE)
    return
  }
  const command = COMMANDS[name]
  if (!command) throw new Error(`Óþekkt skipun: ${name}. Keyrðu huginn --help.`)
  await command(argv, flags)
}

const argv = process.argv.slice(2)
try {
  await main(argv)
} catch (error) {
  const secrets = knownSecrets()
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`Villa: ${redact(message, secrets).replace(/\s*\n\s*/g, ' ')}\n`)
  if (parseArgs(argv).flags.debug && error instanceof Error && error.stack) {
    process.stderr.write(`${redact(error.stack, secrets)}\n`)
  }
  process.exitCode = 1
}
