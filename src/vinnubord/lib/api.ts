import { supabase } from '../../shared/lib/supabase'
import { storageSafeName, validateUpload } from './upload'
import { CLOSED_HISTORY_DAYS, EVENTS_LIMIT } from './boardWindow'
import {
  moduleDeleteBlock,
  participantErrorMessage,
  participantRemoveBlock,
  type PositionChange,
  type ProjectPatch,
} from './settings'
import type {
  Action,
  BoardData,
  Comment,
  Event,
  FileRow,
  Item,
  Module,
  Package,
  Participant,
  Plan,
  Project,
  Question,
  Read,
  Ruling,
} from './types'

// Data layer for the vinnubord. Every function throws an Error with a short
// Icelandic message, followed by the Supabase message after a colon.

export const FILES_BUCKET = 'hg-files'
const SIGNED_URL_SECONDS = 3600

type DbError = { message: string } | null

function fail(message: string, error: DbError): never {
  throw new Error(error ? `${message}: ${error.message}` : message)
}

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession()
  const id = data.session?.user.id
  if (error || !id) fail('Þú ert ekki innskráð(ur).', error)
  return id
}

export async function loadBoard(projectId: string): Promise<BoardData> {
  const since = new Date(Date.now() - CLOSED_HISTORY_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const byProject = (table: string) => supabase.from(table).select('*').eq('project_id', projectId)

  const [
    project,
    participants,
    packages,
    modules,
    items,
    plans,
    files,
    questions,
    actions,
    rulings,
    comments,
    events,
    reads,
  ] = await Promise.all([
    supabase.from('hg_projects').select('*').eq('id', projectId).maybeSingle(),
    byProject('hg_participants').order('created_at'),
    byProject('hg_packages').order('position'),
    byProject('hg_modules').order('position'),
    // Open items, plus items closed in the last 90 days for the module history.
    byProject('hg_items')
      .or(`status.not.in.(done,dropped),closed_at.gte."${since}"`)
      .order('created_at'),
    byProject('hg_plans').order('position'),
    byProject('hg_files').order('created_at'),
    byProject('hg_questions').order('created_at'),
    byProject('hg_actions').order('created_at'),
    byProject('hg_rulings').order('created_at'),
    byProject('hg_comments').order('created_at'),
    // Newest first so the row cap drops old events, reversed below.
    byProject('hg_events').order('created_at', { ascending: false }).limit(EVENTS_LIMIT),
    byProject('hg_reads'),
  ])

  const results = [
    project,
    participants,
    packages,
    modules,
    items,
    plans,
    files,
    questions,
    actions,
    rulings,
    comments,
    events,
    reads,
  ]
  const failed = results.find((r) => r.error)
  if (failed) fail('Gat ekki sótt borðið.', failed.error)
  if (!project.data) fail('Verkefnið fannst ekki.', null)

  return {
    project: project.data as Project,
    participants: (participants.data ?? []) as Participant[],
    packages: (packages.data ?? []) as Package[],
    modules: (modules.data ?? []) as Module[],
    items: (items.data ?? []) as Item[],
    plans: (plans.data ?? []) as Plan[],
    files: (files.data ?? []) as FileRow[],
    questions: (questions.data ?? []) as Question[],
    actions: (actions.data ?? []) as Action[],
    rulings: (rulings.data ?? []) as Ruling[],
    comments: (comments.data ?? []) as Comment[],
    events: ((events.data ?? []) as Event[]).reverse(),
    reads: (reads.data ?? []) as Read[],
    unread: [],
  }
}

export async function loadProjectBySlug(slug: string): Promise<Project | null> {
  const { data, error } = await supabase.from('hg_projects').select('*').eq('slug', slug).maybeSingle()
  if (error) fail('Gat ekki sótt verkefnið.', error)
  return (data ?? null) as Project | null
}

export type Membership = { participant: Participant; project: Project }

// The signed in user's participant rows, each with its project.
export async function listMyMemberships(): Promise<Membership[]> {
  const userId = await currentUserId()
  const { data, error } = await supabase
    .from('hg_participants')
    .select('*, project:hg_projects(*)')
    .eq('user_id', userId)
  if (error) fail('Gat ekki sótt verkefnin þín.', error)

  const rows = (data ?? []) as Array<Participant & { project: Project | null }>
  return rows
    .filter((row) => row.project !== null)
    .map(({ project, ...participant }) => ({ participant, project: project as Project }))
    .sort((a, b) => a.project.name.localeCompare(b.project.name, 'is'))
}

export async function listMyProjects(): Promise<Project[]> {
  const memberships = await listMyMemberships()
  return memberships.map((m) => m.project)
}

export async function updateItemPosition(id: string, x: number, y: number): Promise<void> {
  const { error } = await supabase
    .from('hg_items')
    .update({ pos_x: Math.round(x), pos_y: Math.round(y) })
    .eq('id', id)
  if (error) fail('Gat ekki fært verkið.', error)
}

export async function createItem(input: {
  projectId: string
  title: string
  body?: string
  moduleId?: string | null
  tags?: string[]
  // Where the card lands on the board; the column default is used without it.
  pos?: { x: number; y: number }
}): Promise<Item> {
  const userId = await currentUserId()
  const { data, error } = await supabase
    .from('hg_items')
    .insert({
      project_id: input.projectId,
      title: input.title,
      body: input.body ?? null,
      module_id: input.moduleId ?? null,
      tags: input.tags ?? [],
      created_by: userId,
      ...(input.pos ? { pos_x: Math.round(input.pos.x), pos_y: Math.round(input.pos.y) } : {}),
    })
    .select('*')
    .single()
  if (error || !data) fail('Gat ekki stofnað verkið.', error)
  return data as Item
}

export type ItemPatch = Partial<
  Pick<Item, 'title' | 'summary' | 'body' | 'module_id' | 'tags' | 'status' | 'waiting_on' | 'next_step' | 'next_prompt'>
>

export async function updateItem(id: string, patch: ItemPatch): Promise<void> {
  const userId = await currentUserId()
  const { error } = await supabase
    .from('hg_items')
    .update({ ...patch, updated_by: userId })
    .eq('id', id)
  if (error) fail('Gat ekki vistað verkið.', error)
}

export async function addComment(input: {
  projectId: string
  itemId?: string
  moduleId?: string
  body: string
}): Promise<void> {
  if (!input.itemId && !input.moduleId) fail('Athugasemd vantar verk eða módúl.', null)
  const userId = await currentUserId()
  const { error } = await supabase.from('hg_comments').insert({
    project_id: input.projectId,
    item_id: input.itemId ?? null,
    module_id: input.moduleId ?? null,
    body: input.body,
    user_id: userId,
  })
  if (error) fail('Gat ekki vistað athugasemdina.', error)
}

export async function answerQuestion(id: string, answer: string): Promise<void> {
  const userId = await currentUserId()
  const { error } = await supabase
    .from('hg_questions')
    .update({ answer, answered_by: userId, answered_at: new Date().toISOString() })
    .eq('id', id)
  if (error) fail('Gat ekki vistað svarið.', error)
}

export async function markActionDone(id: string, done: boolean): Promise<void> {
  const userId = await currentUserId()
  const patch = done
    ? { done_at: new Date().toISOString(), done_by: userId }
    : { done_at: null, done_by: null }
  const { error } = await supabase.from('hg_actions').update(patch).eq('id', id)
  if (error) fail('Gat ekki uppfært aðgerðina.', error)
}

// read_at is stamped by the database (hg_reads_stamp_trg, migration 0006), so
// a device clock behind the server cannot write a mark older than the change.
export async function markRead(itemId: string): Promise<void> {
  const userId = await currentUserId()
  const { data: item, error: itemError } = await supabase
    .from('hg_items')
    .select('project_id')
    .eq('id', itemId)
    .maybeSingle()
  if (itemError || !item) fail('Gat ekki merkt verkið lesið.', itemError)

  const { error } = await supabase.from('hg_reads').upsert(
    {
      project_id: (item as { project_id: string }).project_id,
      item_id: itemId,
      user_id: userId,
    },
    { onConflict: 'item_id,user_id' },
  )
  if (error) fail('Gat ekki merkt verkið lesið.', error)
}

export async function uploadFile(input: { projectId: string; itemId: string; file: File }): Promise<FileRow> {
  const check = validateUpload(input.file)
  if (!check.ok) throw new Error(check.reason)

  const userId = await currentUserId()
  const path = `${input.projectId}/${input.itemId}/${crypto.randomUUID()}_${storageSafeName(input.file.name)}`

  const { error: uploadError } = await supabase.storage
    .from(FILES_BUCKET)
    .upload(path, input.file, { contentType: input.file.type || undefined, upsert: false })
  if (uploadError) fail('Gat ekki hlaðið skránni upp.', uploadError)

  const { data, error } = await supabase
    .from('hg_files')
    .insert({
      project_id: input.projectId,
      item_id: input.itemId,
      name: input.file.name,
      storage_path: path,
      size: input.file.size,
      mime: input.file.type || null,
      uploaded_by: userId,
    })
    .select('*')
    .single()
  if (error || !data) {
    // Do not leave an orphan object in the bucket when the row insert fails.
    await supabase.storage.from(FILES_BUCKET).remove([path])
    fail('Gat ekki skráð skrána.', error)
  }
  return data as FileRow
}

export async function fileUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from(FILES_BUCKET).createSignedUrl(storagePath, SIGNED_URL_SECONDS)
  if (error || !data) fail('Gat ekki opnað skrána.', error)
  return data.signedUrl
}

// Text of a stored file, for the markdown reader in the panel.
export async function fileText(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from(FILES_BUCKET).download(storagePath)
  if (error || !data) fail('Gat ekki lesið skrána.', error)
  return data.text()
}

// Marks a ruling as one to reverse ("snúa við"), or clears the mark.
export async function setRulingReversed(id: string, reversed: boolean): Promise<void> {
  const { error } = await supabase.from('hg_rulings').update({ reversed }).eq('id', id)
  if (error) fail('Gat ekki uppfært úrskurðinn.', error)
}

// ---------- Project settings ----------

export async function updateProject(id: string, patch: ProjectPatch): Promise<void> {
  if (Object.keys(patch).length === 0) return
  const { error } = await supabase.from('hg_projects').update(patch).eq('id', id)
  if (error) fail('Gat ekki vistað verkefnið.', error)
}

export type PackageInput = { id?: string; projectId: string; name: string; position: number; pos_x: number; pos_y: number }

// Inserts a package without id, updates it with one.
export async function upsertPackage(input: PackageInput): Promise<Package> {
  const fields = { name: input.name.trim(), position: input.position, pos_x: input.pos_x, pos_y: input.pos_y }
  const query = input.id
    ? supabase.from('hg_packages').update(fields).eq('id', input.id)
    : supabase.from('hg_packages').insert({ ...fields, project_id: input.projectId })
  const { data, error } = await query.select('*').single()
  if (error || !data) fail('Gat ekki vistað pakkann.', error)
  return data as Package
}

export type ModuleInput = {
  id?: string
  projectId: string
  packageId: string | null
  slug: string
  name: string
  statusLine: string | null
  color: string
  isGhost: boolean
  position: number
}

// Inserts a module without id, updates it with one.
export async function upsertModule(input: ModuleInput): Promise<Module> {
  const fields = {
    package_id: input.packageId,
    slug: input.slug,
    name: input.name.trim(),
    status_line: input.statusLine?.trim() ? input.statusLine.trim() : null,
    color: input.color,
    is_ghost: input.isGhost,
    position: input.position,
  }
  const query = input.id
    ? supabase.from('hg_modules').update(fields).eq('id', input.id)
    : supabase.from('hg_modules').insert({ ...fields, project_id: input.projectId })
  const { data, error } = await query.select('*').single()
  if (error || !data) fail('Gat ekki vistað módulinn.', error)
  return data as Module
}

// Writes new positions after a move up or down in a list (see reorder).
export async function setPositions(table: 'hg_packages' | 'hg_modules', changes: PositionChange[]): Promise<void> {
  const results = await Promise.all(
    changes.map((c) => supabase.from(table).update({ position: c.position }).eq('id', c.id)),
  )
  const failed = results.find((r) => r.error)
  if (failed) fail('Gat ekki vistað röðina.', failed.error)
}

// Only a module without items and without comments can go (ruling R24):
// comments would be removed with it by the cascade. Closed items count too,
// so both counts are asked of the database, not taken from the loaded board.
export async function deleteModule(id: string): Promise<void> {
  const head = { count: 'exact' as const, head: true }
  const [items, comments] = await Promise.all([
    supabase.from('hg_items').select('id', head).eq('module_id', id),
    supabase.from('hg_comments').select('id', head).eq('module_id', id),
  ])
  if (items.error || items.count === null) fail('Gat ekki athugað verk módulsins.', items.error)
  if (comments.error || comments.count === null) fail('Gat ekki athugað athugasemdir módulsins.', comments.error)
  const block = moduleDeleteBlock(items.count, comments.count)
  if (block) throw new Error(block)
  const { error } = await supabase.from('hg_modules').delete().eq('id', id)
  if (error) fail('Gat ekki eytt módulnum.', error)
}

export async function addParticipantByEmail(
  projectId: string,
  email: string,
  short: string,
  displayName: string,
): Promise<Participant> {
  const { data, error } = await supabase.rpc('hg_add_participant', {
    p_project: projectId,
    p_email: email.trim(),
    p_short: short.trim(),
    p_name: displayName.trim(),
  })
  const known = error ? participantErrorMessage(error.code, error.message) : null
  if (known) throw new Error(known)
  if (error || !data) fail('Gat ekki bætt þátttakandanum við.', error)
  return data as Participant
}

// Never yourself and never the service user (ruling R24).
export async function removeParticipant(participant: Participant, viewerId: string): Promise<void> {
  const block = participantRemoveBlock(participant, viewerId)
  if (block) throw new Error(block)
  const { error } = await supabase.from('hg_participants').delete().eq('id', participant.id)
  if (error) fail('Gat ekki fjarlægt þátttakandann.', error)
}
