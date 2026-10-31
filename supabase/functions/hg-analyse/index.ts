// hg-analyse: the first quick analysis of a new item on the board.
//
// The pg_net triggers of migration 0007 post { item_id } here when an item is
// created with status new and when a file lands on an item that is still new.
// The request is answered with 202 at once and the work runs in the
// background: wait 20 s so files uploaded right after the item are included,
// sign in as the Claude service user (RLS and the author triggers apply), take
// the lock, read the item, its text files, the context bundle, the modules and
// the participants, ask Claude, and write the analysis onto the item with
// status waiting on Heimir, its questions and an analysis.done event. A failed
// run logs analysis.failed, releases the lock and leaves the status alone.
//
// Deployed with verify_jwt false: the bearer secret is the only gate.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.103.0'
import Anthropic from 'npm:@anthropic-ai/sdk@1.3.0'
import {
  ANALYSIS_TOOL_NAME,
  SYSTEM_PROMPT,
  analysisTool,
  applyAnalysis,
  buildUserMessage,
  clipText,
  isItemFilePath,
  mergeIntoItem,
  selectTextFiles,
  type MessageFile,
} from './lib.ts'

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void }

const MODEL = 'claude-opus-5-5'
const DEBOUNCE_MS = 20_000
const API_TIMEOUT_MS = 90_000
const MAX_TOKENS = 16_000
const EFFORT = 'medium'
const BUCKET = 'hg-files'
const MAX_ERROR_CHARS = 500
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Item = {
  id: string
  project_id: string
  title: string
  body: string | null
  status: string
  module_id: string | null
  tags: string[]
}

type FileRecord = { name: string; size: number; mime: string | null; storage_path: string }

type Participant = { user_id: string; short: string; display_name: string; is_service: boolean }

type Session = { db: SupabaseClient; serviceUserId: string }

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`${name} vantar í umhverfið`)
  return value
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function messageOf(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err)
  return text.slice(0, MAX_ERROR_CHARS)
}

function sameShort(a: string, b: string): boolean {
  return a.normalize('NFC').trim() === b.normalize('NFC').trim()
}

async function signIn(): Promise<Session> {
  const db = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await db.auth.signInWithPassword({
    email: requireEnv('HG_SERVICE_EMAIL'),
    password: requireEnv('HG_SERVICE_PASSWORD'),
  })
  if (error || !data.user) throw new Error(`Innskráning þjónustunotanda mistókst: ${error?.message ?? 'enginn notandi'}`)
  return { db, serviceUserId: data.user.id }
}

async function readItem(db: SupabaseClient, itemId: string): Promise<Item | null> {
  const { data, error } = await db
    .from('hg_items')
    .select('id, project_id, title, body, status, module_id, tags')
    .eq('id', itemId)
    .maybeSingle()
  if (error) throw new Error(`Gat ekki lesið verkið: ${error.message}`)
  return data as Item | null
}

async function claim(db: SupabaseClient, itemId: string): Promise<boolean> {
  const { data, error } = await db.rpc('hg_claim_analysis', { p_item: itemId })
  if (error) throw new Error(`Gat ekki tekið lásinn: ${error.message}`)
  return data === true
}

// Files in upload order. Text files are downloaded and clipped, the rest go
// in by name and size only. Returns the names that were sent with text too.
// A path that is not exactly this item's own file path is never downloaded
// (the service user may see other projects' files), it goes in by name and
// size only.
async function readFiles(
  db: SupabaseClient,
  item: Pick<Item, 'id' | 'project_id'>,
): Promise<{ files: MessageFile[]; sent: string[] }> {
  const { data, error } = await db
    .from('hg_files')
    .select('name, size, mime, storage_path')
    .eq('item_id', item.id)
    .order('created_at')
  if (error) throw new Error(`Gat ekki lesið skrárnar: ${error.message}`)
  const rows = (data ?? []) as FileRecord[]
  const { send } = selectTextFiles(rows)
  const toSend = new Set(send)

  const files: MessageFile[] = []
  const sent: string[] = []
  for (const row of rows) {
    if (!toSend.has(row)) {
      files.push({ name: row.name, size: row.size })
      continue
    }
    if (!isItemFilePath(row.storage_path, item.project_id, item.id)) {
      console.warn(`hg-analyse ${item.id}: ${row.name} has an unexpected storage path, not read`)
      files.push({ name: row.name, size: row.size })
      continue
    }
    const { data: blob, error: dlError } = await db.storage.from(BUCKET).download(row.storage_path)
    if (dlError || !blob) throw new Error(`Gat ekki sótt ${row.name}: ${dlError?.message ?? 'tómt svar'}`)
    files.push({ name: row.name, size: row.size, text: clipText(await blob.text()) })
    sent.push(row.name)
  }
  return { files, sent }
}

async function readProject(db: SupabaseClient, projectId: string) {
  const [project, modules, participants] = await Promise.all([
    db.from('hg_projects').select('context_bundle').eq('id', projectId).single(),
    db.from('hg_modules').select('id, slug, name, status_line').eq('project_id', projectId).order('position'),
    db.from('hg_participants').select('user_id, short, display_name, is_service').eq('project_id', projectId),
  ])
  if (project.error) throw new Error(`Gat ekki lesið verkefnið: ${project.error.message}`)
  if (modules.error) throw new Error(`Gat ekki lesið módúlana: ${modules.error.message}`)
  if (participants.error) throw new Error(`Gat ekki lesið þátttakendur: ${participants.error.message}`)
  return {
    bundle: (project.data as { context_bundle: string | null }).context_bundle,
    modules: (modules.data ?? []) as Array<{ id: string; slug: string; name: string; status_line: string | null }>,
    participants: (participants.data ?? []) as Participant[],
  }
}

async function askClaude(userMessage: string) {
  const apiKey = Deno.env.get('HG_ANTHROPIC_API_KEY') || Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY vantar í umhverfið')
  const client = new Anthropic({ apiKey })
  const message = await client.messages.create(
    {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      output_config: { effort: EFFORT },
      system: SYSTEM_PROMPT,
      tools: [analysisTool],
      tool_choice: { type: 'auto' },
      messages: [{ role: 'user', content: userMessage }],
    },
    { timeout: API_TIMEOUT_MS, maxRetries: 0 },
  )
  if (message.stop_reason === 'refusal') throw new Error('Claude neitaði að greina verkið')
  if (message.stop_reason === 'max_tokens') throw new Error('Greiningin fór yfir max_tokens')
  const block = message.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === ANALYSIS_TOOL_NAME,
  )
  if (!block) throw new Error('Claude skilaði engri greiningu')
  return { input: block.input, usage: message.usage }
}

async function logAnalysis(db: SupabaseClient, itemId: string, kind: string, data: Record<string, unknown>) {
  const { error } = await db.rpc('hg_log_analysis', { p_item: itemId, p_kind: kind, p_data: data })
  if (error) throw new Error(`Gat ekki skráð ${kind}: ${error.message}`)
}

// Runs with the lock held. Throws on any failure, the caller logs it.
async function runAnalysis({ db, serviceUserId }: Session, item: Item): Promise<void> {
  const { files, sent } = await readFiles(db, item)
  const { bundle, modules, participants } = await readProject(db, item.project_id)

  const heimir = participants.find((p) => sameShort(p.short, 'H'))
  if (!heimir) throw new Error('Enginn þátttakandi með stutta nafnið H')

  const { input, usage } = await askClaude(
    buildUserMessage({
      item: { title: item.title, body: item.body },
      files,
      bundle,
      modules,
      participants: participants.map((p) => ({ short: p.short, name: p.display_name })),
    }),
  )

  const analysis = applyAnalysis(input, modules)
  if (analysis.summary === '') throw new Error('Greiningin skilaði tómri samantekt')
  if (analysis.body === '') throw new Error('Greiningin skilaði tómum texta')
  const fields = mergeIntoItem(item, analysis)

  // The status gate: the update lands only while the item is still new. If
  // someone moved it meanwhile, nothing more is written.
  const { data: updated, error: updateError } = await db
    .from('hg_items')
    .update({
      ...fields,
      status: 'waiting',
      waiting_on: heimir.user_id,
      analysed_at: new Date().toISOString(),
      analyse_lock_until: null,
    })
    .eq('id', item.id)
    .eq('status', 'new')
    .select('id')
  if (updateError) throw new Error(`Gat ekki vistað greininguna: ${updateError.message}`)
  if (!updated || updated.length === 0) {
    console.log(`hg-analyse skipped ${item.id}: no longer new when the analysis was ready`)
    return
  }

  const questions = analysis.questions.flatMap((q) => {
    const to = participants.find((p) => sameShort(p.short, q.to))
    if (!to) return []
    return [{ project_id: item.project_id, item_id: item.id, body: q.body, asked_to: to.user_id, asked_by: serviceUserId }]
  })
  if (questions.length > 0) {
    const { error } = await db.from('hg_questions').insert(questions)
    if (error) throw new Error(`Gat ekki vistað spurningarnar: ${error.message}`)
  }

  await logAnalysis(db, item.id, 'analysis.done', {
    model: MODEL,
    input_files: sent,
    unmatchedModule: analysis.unmatchedModule,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
  })
  console.log(`hg-analyse done ${item.id}`)
}

async function reportFailure(db: SupabaseClient, itemId: string, err: unknown): Promise<void> {
  const error = messageOf(err)
  console.error(`hg-analyse failed ${itemId}: ${error}`)
  try {
    await logAnalysis(db, itemId, 'analysis.failed', { model: MODEL, error })
  } catch (logErr) {
    console.error(`hg-analyse could not log the failure of ${itemId}: ${messageOf(logErr)}`)
  }
  // Only an item still new is touched. One that left new keeps its lock
  // until it expires, which is harmless there.
  const { error: unlockError } = await db
    .from('hg_items')
    .update({ analyse_lock_until: null })
    .eq('id', itemId)
    .eq('status', 'new')
  if (unlockError) console.error(`hg-analyse could not release the lock on ${itemId}: ${unlockError.message}`)
}

// Reads the item and takes the lock. Errors here are only logged to the
// console: without the lock there is no run to report on the board.
async function claimItem(db: SupabaseClient, itemId: string): Promise<Item | null> {
  const item = await readItem(db, itemId)
  if (!item || item.status !== 'new') {
    console.log(`hg-analyse skipped ${itemId}: ${item ? `status ${item.status}` : 'not found'}`)
    return null
  }
  if (!(await claim(db, itemId))) {
    console.log(`hg-analyse skipped ${itemId}: locked or no longer new`)
    return null
  }
  return item
}

// Never throws: it runs in the background after the response has gone.
async function analyse(itemId: string): Promise<void> {
  await sleep(DEBOUNCE_MS)
  let session: Session
  try {
    session = await signIn()
  } catch (err) {
    console.error(`hg-analyse could not start on ${itemId}: ${messageOf(err)}`)
    return
  }

  try {
    const item = await claimItem(session.db, itemId)
    if (!item) return
    try {
      await runAnalysis(session, item)
    } catch (err) {
      await reportFailure(session.db, itemId, err)
    }
  } catch (err) {
    console.error(`hg-analyse broke on ${itemId}: ${messageOf(err)}`)
  } finally {
    // Ends this run's session so refresh tokens do not pile up.
    await session.db.auth.signOut({ scope: 'local' }).catch(() => {})
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' })

  const secret = Deno.env.get('HG_ANALYSE_SECRET')
  if (!secret) return json(500, { error: 'HG_ANALYSE_SECRET is not set' })
  if (req.headers.get('Authorization') !== `Bearer ${secret}`) return json(401, { error: 'unauthorized' })

  let itemId: unknown
  try {
    const body = await req.json()
    itemId = body !== null && typeof body === 'object' ? (body as Record<string, unknown>).item_id : undefined
  } catch {
    return json(400, { error: 'body must be JSON' })
  }
  if (typeof itemId !== 'string' || !UUID.test(itemId)) return json(400, { error: 'item_id must be a uuid' })

  EdgeRuntime.waitUntil(analyse(itemId))
  return json(202, { queued: true })
})
