import { randomUUID } from 'node:crypto'
import { idRange, pickOne, storagePath, validateUpload } from './write.mjs'

// Database and storage writes of the CLI (ruling R5): item create and the seed
// script call the same functions. Every function takes a signed in client from
// getClient(), so RLS applies, and throws an Error with a short Icelandic
// message followed by the Supabase message after a colon.
//
// Triggers (migrations 0003, 0004) stamp authors from auth.uid(), set
// updated_at and closed_at, log hg_events and move an item to waiting on the
// service user when its last question is answered. These functions do not
// repeat that work. The not null author columns (created_by, asked_by,
// uploaded_by, user_id) are sent on insert like the web does; the trigger
// overwrites them with auth.uid() anyway.

export const FILES_BUCKET = 'hg-files'
const SIGNED_URL_SECONDS = 600

const TABLE = {
  item: 'hg_items',
  question: 'hg_questions',
  action: 'hg_actions',
  plan: 'hg_plans',
  file: 'hg_files',
}

function fail(message, error) {
  throw new Error(error ? `${message}: ${error.message}` : message)
}

// One row of a project by full uuid or unique prefix (ruling R15).
export async function findById(client, kind, projectId, input, columns = '*') {
  const { lo, hi } = idRange(input)
  const { data, error } = await client
    .from(TABLE[kind])
    .select(columns)
    .eq('project_id', projectId)
    .gte('id', lo)
    .lte('id', hi)
    .limit(2)
  if (error) fail('Gat ekki flett upp auðkenninu', error)
  return pickOne(data ?? [], input, kind)
}

export async function listParticipants(client, projectId) {
  const { data, error } = await client.from('hg_participants').select('*').eq('project_id', projectId)
  if (error) fail('Gat ekki sótt þátttakendur', error)
  return data ?? []
}

export async function listModules(client, projectId) {
  const { data, error } = await client.from('hg_modules').select('*').eq('project_id', projectId)
  if (error) fail('Gat ekki sótt módúla', error)
  return data ?? []
}

// Unanswered questions and open actions of one item, for guardClose.
export async function openWork(client, itemId) {
  const [questions, actions] = await Promise.all([
    client.from('hg_questions').select('id, item_id, answer').eq('item_id', itemId).is('answer', null),
    client.from('hg_actions').select('id, item_id, done_at').eq('item_id', itemId).is('done_at', null),
  ])
  if (questions.error) fail('Gat ekki sótt spurningar verksins', questions.error)
  if (actions.error) fail('Gat ekki sótt handtök verksins', actions.error)
  return { questions: questions.data ?? [], actions: actions.data ?? [] }
}

// input: projectId, userId, title, and optionally body, summary, moduleId,
// tags, status, waitingOn, pos {x, y}, sourceRef, nextStep, nextPrompt.
export async function createItem(client, input) {
  const row = {
    project_id: input.projectId,
    title: input.title,
    body: input.body ?? null,
    summary: input.summary ?? null,
    module_id: input.moduleId ?? null,
    tags: input.tags ?? [],
    status: input.status ?? 'new',
    waiting_on: input.waitingOn ?? null,
    source_ref: input.sourceRef ?? null,
    next_step: input.nextStep ?? null,
    next_prompt: input.nextPrompt ?? null,
    created_by: input.userId,
    ...(input.pos ? { pos_x: Math.round(input.pos.x), pos_y: Math.round(input.pos.y) } : {}),
  }
  const { data, error } = await client.from('hg_items').insert(row).select('*').single()
  if (error || !data) fail('Gat ekki stofnað verkið', error)
  return data
}

export async function updateItem(client, id, patch) {
  const { data, error } = await client.from('hg_items').update(patch).eq('id', id).select('*')
  if (error) fail('Gat ekki vistað verkið', error)
  if (!data?.length) fail('Verkið fannst ekki eða þú hefur ekki aðgang að því.')
  return data[0]
}

export async function askQuestion(client, { projectId, itemId, userId, askedTo, body }) {
  const { data, error } = await client
    .from('hg_questions')
    .insert({ project_id: projectId, item_id: itemId, body, asked_to: askedTo ?? null, asked_by: userId })
    .select('*')
    .single()
  if (error || !data) fail('Gat ekki vistað spurninguna', error)
  return data
}

// Only an unanswered question takes an answer; the web keeps answered ones
// read only. The trigger stamps answered_by and answered_at.
export async function answerQuestion(client, id, answer) {
  const { data, error } = await client
    .from('hg_questions')
    .update({ answer })
    .eq('id', id)
    .is('answer', null)
    .select('*')
  if (error) fail('Gat ekki vistað svarið', error)
  if (!data?.length) fail('Spurningunni hefur þegar verið svarað.')
  return data[0]
}

export async function addAction(client, { projectId, itemId, owner, body, payload }) {
  const { data, error } = await client
    .from('hg_actions')
    .insert({ project_id: projectId, item_id: itemId, owner, body, payload: payload ?? null })
    .select('*')
    .single()
  if (error || !data) fail('Gat ekki vistað handtakið', error)
  return data
}

// The trigger stamps done_by.
export async function markActionDone(client, id) {
  const { data, error } = await client
    .from('hg_actions')
    .update({ done_at: new Date().toISOString() })
    .eq('id', id)
    .is('done_at', null)
    .select('*')
  if (error) fail('Gat ekki merkt handtakið lokið', error)
  if (!data?.length) fail('Handtakið er þegar merkt lokið.')
  return data[0]
}

// A new plan goes after the item's other plans.
export async function addPlan(client, { projectId, itemId, name, path, status }) {
  const { data: last, error: lastError } = await client
    .from('hg_plans')
    .select('position')
    .eq('item_id', itemId)
    .order('position', { ascending: false })
    .limit(1)
  if (lastError) fail('Gat ekki sótt plön verksins', lastError)
  const position = last?.length ? last[0].position + 1 : 0
  const { data, error } = await client
    .from('hg_plans')
    .insert({ project_id: projectId, item_id: itemId, name, path: path ?? null, status: status ?? 'todo', position })
    .select('*')
    .single()
  if (error || !data) fail('Gat ekki vistað planið', error)
  return data
}

export async function setPlanStatus(client, id, status) {
  const { data, error } = await client.from('hg_plans').update({ status }).eq('id', id).select('*')
  if (error) fail('Gat ekki vistað planið', error)
  if (!data?.length) fail('Planið fannst ekki eða þú hefur ekki aðgang að því.')
  return data[0]
}

export async function addRuling(client, { projectId, planId, code, body, cost }) {
  const { data, error } = await client
    .from('hg_rulings')
    .insert({ project_id: projectId, plan_id: planId, code, body, cost: cost ?? null })
    .select('*')
    .single()
  if (error || !data) fail('Gat ekki vistað úrskurðinn', error)
  return data
}

export async function addComment(client, { projectId, itemId, userId, body }) {
  const { data, error } = await client
    .from('hg_comments')
    .insert({ project_id: projectId, item_id: itemId, body, user_id: userId })
    .select('*')
    .single()
  if (error || !data) fail('Gat ekki vistað athugasemdina', error)
  return data
}

// Same rules as uploadFile in src/vinnubord/lib/api.ts: validateUpload, a
// unique key under <project>/<item>/, upsert false (there is no storage UPDATE
// policy), and the object is removed again if the hg_files row fails.
export async function uploadFile(client, { projectId, itemId, userId, name, bytes, mime, repoPath }) {
  const check = validateUpload({ name, size: bytes.length })
  if (!check.ok) throw new Error(`${name}: ${check.reason}`)

  const path = storagePath(projectId, itemId, randomUUID(), name)
  const { error: uploadError } = await client.storage
    .from(FILES_BUCKET)
    .upload(path, bytes, { contentType: mime ?? 'application/octet-stream', upsert: false })
  if (uploadError) fail(`Gat ekki hlaðið ${name} upp`, uploadError)

  const { data, error } = await client
    .from('hg_files')
    .insert({
      project_id: projectId,
      item_id: itemId,
      name,
      storage_path: path,
      size: bytes.length,
      mime: mime ?? null,
      repo_path: repoPath ?? null,
      uploaded_by: userId,
    })
    .select('*')
    .single()
  if (error || !data) {
    await client.storage.from(FILES_BUCKET).remove([path])
    fail(`Gat ekki skráð ${name}`, error)
  }
  return data
}

// Bytes of a stored file through a short lived signed URL.
export async function downloadFile(client, storagePath) {
  const { data, error } = await client.storage.from(FILES_BUCKET).createSignedUrl(storagePath, SIGNED_URL_SECONDS)
  if (error || !data) fail('Gat ekki opnað skrána', error)
  const res = await fetch(data.signedUrl)
  if (!res.ok) fail(`Gat ekki sótt skrána (HTTP ${res.status}).`)
  return Buffer.from(await res.arrayBuffer())
}

export async function pushBundle(client, projectId, text) {
  const { data, error } = await client
    .from('hg_projects')
    .update({ context_bundle: text, context_bundle_at: new Date().toISOString() })
    .eq('id', projectId)
    .select('id, context_bundle_at')
  if (error) fail('Gat ekki vistað samhengið', error)
  if (!data?.length) fail('Verkefnið fannst ekki eða þú hefur ekki aðgang að því.')
  return data[0]
}
