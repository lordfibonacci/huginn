import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { huginnDir, loadCredentials } from './config.mjs'

// Data access for the CLI. Signs in as the user in ~/.huginn/credentials.json
// with the anon key, so RLS decides what the tool sees. The session is cached
// in ~/.huginn/session.json so most runs skip the password sign in.

// Same window as loadBoard in src/vinnubord/lib/api.ts.
const CLOSED_HISTORY_DAYS = 90
const EVENTS_LIMIT = 500
// A cached token this close to expiry is refreshed before use.
const EXPIRY_MARGIN_SECONDS = 60

function fail(message, error) {
  throw new Error(error ? `${message}: ${error.message}` : message)
}

function sessionPath() {
  return join(huginnDir(), 'session.json')
}

function readCachedSession(creds) {
  try {
    const cached = JSON.parse(readFileSync(sessionPath(), 'utf8'))
    if (cached.url !== creds.url || cached.email !== creds.email) return null
    if (!cached.access_token || !cached.refresh_token) return null
    return cached
  } catch {
    return null
  }
}

function saveSession(creds, session) {
  mkdirSync(huginnDir(), { recursive: true })
  const cached = {
    url: creds.url,
    email: creds.email,
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at ?? null,
  }
  writeFileSync(sessionPath(), JSON.stringify(cached, null, 2), { mode: 0o600 })
}

function dropCachedSession() {
  rmSync(sessionPath(), { force: true })
}

async function restore(client, cached) {
  const now = Date.now() / 1000
  const nearExpiry = cached.expires_at && cached.expires_at - now < EXPIRY_MARGIN_SECONDS
  const { data, error } = nearExpiry
    ? await client.auth.refreshSession({ refresh_token: cached.refresh_token })
    : await client.auth.setSession({ access_token: cached.access_token, refresh_token: cached.refresh_token })
  return error || !data.session ? null : data.session
}

// fresh: skip the cache and sign in with the password (huginn login).
export async function getClient({ fresh = false } = {}) {
  const creds = loadCredentials()
  const client = createClient(creds.url, creds.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const cached = fresh ? null : readCachedSession(creds)
  if (cached) {
    const session = await restore(client, cached)
    if (session) {
      saveSession(creds, session)
      return client
    }
    dropCachedSession()
  }

  const { data, error } = await client.auth.signInWithPassword({ email: creds.email, password: creds.password })
  if (error || !data.session) fail(`Innskráning mistókst fyrir ${creds.email}`, error)
  saveSession(creds, data.session)
  return client
}

export async function getUser(client) {
  const { data, error } = await client.auth.getSession()
  const user = data.session?.user
  if (error || !user) fail('Þú ert ekki innskráð(ur).', error)
  return user
}

export async function getProject(client, slug) {
  const { data, error } = await client.from('hg_projects').select('*').eq('slug', slug).maybeSingle()
  if (error) fail('Gat ekki sótt verkefnið', error)
  // RLS hides projects the user is not a participant of, so both cases look the same.
  if (!data) fail(`Verkefnið ${slug} fannst ekki eða þú hefur ekki aðgang að því.`)
  return data
}

export async function getMe(client, projectId) {
  const user = await getUser(client)
  const { data, error } = await client
    .from('hg_participants')
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) fail('Gat ekki sótt þátttakanda', error)
  if (!data) fail('Þú ert ekki þátttakandi í þessu verkefni.')
  return data
}

// Mirror of loadBoard in src/vinnubord/lib/api.ts: same queries, same BoardData shape.
export async function loadBoard(client, projectId) {
  const since = new Date(Date.now() - CLOSED_HISTORY_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const byProject = (table) => client.from(table).select('*').eq('project_id', projectId)

  const results = await Promise.all([
    client.from('hg_projects').select('*').eq('id', projectId).maybeSingle(),
    byProject('hg_participants').order('created_at'),
    byProject('hg_packages').order('position'),
    byProject('hg_modules').order('position'),
    byProject('hg_items')
      .or(`status.not.in.(done,dropped),closed_at.gte."${since}"`)
      .order('created_at'),
    byProject('hg_plans').order('position'),
    byProject('hg_files').order('created_at'),
    byProject('hg_questions').order('created_at'),
    byProject('hg_actions').order('created_at'),
    byProject('hg_rulings').order('created_at'),
    byProject('hg_comments').order('created_at'),
    byProject('hg_events').order('created_at', { ascending: false }).limit(EVENTS_LIMIT),
    byProject('hg_reads'),
  ])
  const failed = results.find((r) => r.error)
  if (failed) fail('Gat ekki sótt borðið', failed.error)
  const [project, participants, packages, modules, items, plans, files, questions, actions, rulings, comments, events, reads] =
    results
  if (!project.data) fail('Verkefnið fannst ekki.')

  return {
    project: project.data,
    participants: participants.data ?? [],
    packages: packages.data ?? [],
    modules: modules.data ?? [],
    items: items.data ?? [],
    plans: plans.data ?? [],
    files: files.data ?? [],
    questions: questions.data ?? [],
    actions: actions.data ?? [],
    rulings: rulings.data ?? [],
    comments: comments.data ?? [],
    events: (events.data ?? []).reverse(),
    reads: reads.data ?? [],
  }
}
