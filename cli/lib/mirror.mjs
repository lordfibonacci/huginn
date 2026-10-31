import { createHash } from 'node:crypto'
import { oneLine, shortId, statusMarkdown } from './format.mjs'
import { PLAN_NAMES, STATUS_NAMES, isOnBoard } from './status.mjs'

// Pure side of huginn sync: which items and files go into docs/huginn, under
// which names, what item.md says and what needs writing. No fs and no
// Supabase here; cli/lib/sync.mjs reads the folder and writes the plan.
//
// Rulings R6, R7, R8 and R18 of plan 3:
// - Storage objects never change (no storage UPDATE policy, unique paths), so a
//   copied file with the same size on disk is skipped without a download.
//   Rendered markdown compares sha256, a pointer compares its storage_path.
// - Size only decides: under MIRROR_MAX_BYTES a file is copied, otherwise it
//   gets <name>.pointer.json and stays in Storage.
// - Files with repo_path already live in the repo and are only listed.
// - Board items plus done items closed in the last DONE_WINDOW_DAYS days.
//   Dropped items are not mirrored. Nothing is ever deleted.

export const MIRROR_MAX_BYTES = 10 * 1024 * 1024
export const DONE_WINDOW_DAYS = 30
export const STATUS_FILE = 'STATUS.md'
export const ITEM_FILE = 'item.md'
export const POINTER_SUFFIX = '.pointer.json'

const SLUG_MAX = 60
const NAME_MAX = 100
const ID_SUFFIX = 6
const DAY_MS = 24 * 60 * 60 * 1000

const SLUG_MAP = { á: 'a', ð: 'd', é: 'e', í: 'i', ó: 'o', ú: 'u', ý: 'y', þ: 'th', æ: 'ae', ö: 'o' }
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g
// Windows refuses these in a file name, and / and \ are separators.
const RESERVED_CHARS = /[<>:"/\\|?*]/g
// Windows device names, also with an extension (con.txt).
const DEVICE_NAMES = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(\.|$)/i

// ---------- small helpers ----------

export function sha256(data) {
  return createHash('sha256').update(data).digest('hex')
}

function stampValue(stamp) {
  const ms = Date.parse(stamp ?? '')
  return Number.isNaN(ms) ? 0 : ms
}

function iso(stamp) {
  const ms = Date.parse(stamp ?? '')
  return Number.isNaN(ms) ? oneLine(stamp) : new Date(ms).toISOString()
}

function byId(a, b) {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

function byCreated(a, b) {
  return stampValue(a.created_at) - stampValue(b.created_at) || byId(a, b)
}

// Lowercase letters and digits of the id, so the suffix is safe in a path.
function idPart(id, length = ID_SUFFIX) {
  return String(id ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, length)
}

// Text that keeps its line breaks: CRLF and CR become LF, tabs four spaces,
// every other control character is removed, trailing blank space trimmed.
function multiLine(text) {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, '    ')
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/g, '')
    .replace(/[ \n]+$/, '')
    .replace(/^\n+/, '')
}

// A fenced block whose fence is longer than any backtick run in the text, so
// the text cannot close it.
function fenced(text) {
  const body = multiLine(text)
  const longest = Math.max(0, ...(body.match(/`+/g) ?? []).map((run) => run.length))
  const fence = '`'.repeat(Math.max(3, longest + 1))
  return `${fence}text\n${body}\n${fence}`
}

function person(userId, participants) {
  const p = participants.find((x) => x.user_id === userId)
  return p ? `${oneLine(p.display_name)} (${oneLine(p.short)})` : '?'
}

// ---------- names ----------

// Lowercase, Icelandic letters mapped, anything else a dash, at most 60
// characters, then the first 6 characters of the id so the slug is unique.
export function itemSlug(item) {
  let base = ''
  for (const ch of String(item.title ?? '').toLowerCase()) {
    if (SLUG_MAP[ch]) base += SLUG_MAP[ch]
    else if (/[a-z0-9]/.test(ch)) base += ch
    else base += '-'
  }
  base = base.replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, SLUG_MAX).replace(/-$/, '')
  const id = idPart(item.id)
  return base ? `${base}-${id}` : id
}

// A file name from the database made safe to write: no separators, no parent
// references, no Windows reserved characters or device names, no leading dot
// (a .gitignore from Huginn must not steer git), no trailing dot or space.
export function safeFileName(name) {
  let safe = String(name ?? '')
    .normalize('NFC')
    .replace(CONTROL_CHARS, '')
    .replace(RESERVED_CHARS, '_')
    .trim()
    .replace(/[. ]+$/, '')
    .replace(/^\.+/, (dots) => '_'.repeat(dots.length))
  if (!safe) safe = 'skra'
  if (DEVICE_NAMES.test(safe)) safe = `_${safe}`
  if (safe.length > NAME_MAX) {
    const dot = safe.lastIndexOf('.')
    const ext = dot > 0 && safe.length - dot <= 20 ? safe.slice(dot) : ''
    safe = safe.slice(0, NAME_MAX - ext.length).replace(/[. ]+$/, '') + ext
  }
  return safe
}

// "mynd.png" becomes "mynd-abcdef.png", "README" becomes "README-abcdef".
function withSuffix(name, suffix) {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? `${name.slice(0, dot)}-${suffix}${name.slice(dot)}` : `${name}-${suffix}`
}

// ---------- what is mirrored ----------

export function itemsToMirror(data, now) {
  const from = now - DONE_WINDOW_DAYS * DAY_MS
  return (data.items ?? []).filter(
    (i) => isOnBoard(i) || (i.status === 'done' && i.closed_at && stampValue(i.closed_at) >= from),
  )
}

// Where each file of an item goes. kind: 'copy' (written next to item.md),
// 'pointer' (name is the pointer file) or 'repo' (already in the repo, only
// listed). The earlier file by created_at keeps a name; a later one that
// clashes with it or with item.md, ignoring case, gets the id suffix.
export function fileTargets(itemId, files) {
  const used = new Set([ITEM_FILE])
  const out = []
  for (const file of files.filter((f) => f.item_id === itemId).sort(byCreated)) {
    if (file.repo_path) {
      out.push({ file, kind: 'repo', name: null })
      continue
    }
    const kind = file.size < MIRROR_MAX_BYTES ? 'copy' : 'pointer'
    const local = (n) => (kind === 'pointer' ? `${n}${POINTER_SUFFIX}` : n)
    let name = safeFileName(file.name)
    for (const suffix of [idPart(file.id), idPart(file.id, Infinity)]) {
      if (!used.has(local(name).toLowerCase())) break
      name = withSuffix(safeFileName(file.name), suffix)
    }
    used.add(local(name).toLowerCase())
    out.push({ file, kind, name: local(name) })
  }
  return out
}

// ---------- item.md ----------

function fileLine({ file, kind, name }) {
  const head = `- ${oneLine(file.name)}, ${Number(file.size) || 0} bæti`
  if (kind === 'repo') return `${head}: í repoinu, ${oneLine(file.repo_path)}`
  if (kind === 'pointer') return `${head}: í Storage, bendiskrá ${name}`
  return `${head}: afrit í möppunni, ${name}`
}

// Rows may be the whole board's arrays; they are filtered to this item. extra
// carries the module row and the file targets from fileTargets.
export function renderItemMd(item, plans, actions, questions, rulings, participants, extra = {}) {
  const { module = null, files = [] } = extra
  const lines = [`# ${oneLine(item.title)}`, '']
  const meta = [`Auðkenni: ${oneLine(item.id)}`, `Staða: ${STATUS_NAMES[item.status] ?? oneLine(item.status)}`]
  if (item.status === 'waiting' && item.waiting_on) meta.push(`Bíður eftir: ${person(item.waiting_on, participants)}`)
  if (module) meta.push(`Módúll: ${oneLine(module.name)} (${oneLine(module.slug)})`)
  const tags = (item.tags ?? []).map(oneLine).filter(Boolean)
  if (tags.length) meta.push(`Merki: ${tags.join(', ')}`)
  if (item.created_at) meta.push(`Stofnað: ${iso(item.created_at)}, af ${person(item.created_by, participants)}`)
  if (item.updated_at) meta.push(`Uppfært: ${iso(item.updated_at)}`)
  if (item.closed_at) meta.push(`Lokað: ${iso(item.closed_at)}`)
  if (item.source_ref) meta.push(`Uppruni: ${oneLine(item.source_ref)}`)
  lines.push(...meta.map((m) => `- ${m}`), '')

  const section = (heading, text) => {
    const body = multiLine(text)
    if (body) lines.push(`## ${heading}`, '', body, '')
  }
  section('Hvar erum við', item.summary)
  section('Lýsing', item.body)
  section('Næsta skref', item.next_step)
  if (multiLine(item.next_prompt)) lines.push('## Prompt fyrir næsta skref', '', fenced(item.next_prompt), '')

  const itemPlans = plans
    .filter((p) => p.item_id === item.id)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || byId(a, b))
  if (itemPlans.length) {
    lines.push('## Plön', '')
    for (const plan of itemPlans) {
      lines.push(`### ${oneLine(plan.name)}`, '', `- Staða: ${PLAN_NAMES[plan.status] ?? oneLine(plan.status)}`)
      if (plan.path) lines.push(`- Slóð: ${oneLine(plan.path)}`)
      lines.push('')
      const planRulings = rulings.filter((r) => r.plan_id === plan.id).sort(byCreated)
      if (planRulings.length) {
        lines.push('Úrskurðir:', '')
        for (const r of planRulings) {
          const notes = []
          if (r.cost) notes.push(`kostnaður: ${oneLine(r.cost)}`)
          if (r.reversed) notes.push('snúið við')
          const note = notes.length ? ` (${notes.join(', ')})` : ''
          lines.push(`- ${oneLine(r.code)}${note}: ${oneLine(r.body)}`)
        }
        lines.push('')
      }
    }
  }

  const itemActions = actions.filter((a) => a.item_id === item.id)
  const ordered = [...itemActions.filter((a) => !a.done_at).sort(byCreated), ...itemActions.filter((a) => a.done_at).sort(byCreated)]
  if (ordered.length) {
    lines.push('## Handtök', '')
    for (const a of ordered) {
      lines.push(`### Handtak #${shortId(a.id)}, ${a.done_at ? 'lokið' : 'opið'}`, '')
      lines.push(`- Eigandi: ${person(a.owner, participants)}`)
      if (a.created_at) lines.push(`- Stofnað: ${iso(a.created_at)}`)
      if (a.done_at) lines.push(`- Lokið: ${iso(a.done_at)}, af ${person(a.done_by, participants)}`)
      lines.push('')
      if (multiLine(a.body)) lines.push(multiLine(a.body), '')
      if (multiLine(a.payload)) lines.push(fenced(a.payload), '')
    }
  }

  const itemQuestions = questions.filter((q) => q.item_id === item.id).sort(byCreated)
  if (itemQuestions.length) {
    lines.push('## Spurningar', '')
    for (const q of itemQuestions) {
      const answered = q.answer !== null && q.answer !== undefined
      lines.push(`### Spurning #${shortId(q.id)}, ${answered ? 'svarað' : 'ósvöruð'}`, '')
      lines.push(`- Frá: ${person(q.asked_by, participants)}`)
      if (q.asked_to) lines.push(`- Til: ${person(q.asked_to, participants)}`)
      if (q.created_at) lines.push(`- Spurt: ${iso(q.created_at)}`)
      lines.push('')
      if (multiLine(q.body)) lines.push(multiLine(q.body), '')
      if (answered) {
        const when = q.answered_at ? `, ${iso(q.answered_at)}` : ''
        lines.push(`Svar frá ${person(q.answered_by, participants)}${when}:`, '')
        if (multiLine(q.answer)) lines.push(multiLine(q.answer), '')
      }
    }
  }

  if (files.length) lines.push('## Skrár', '', ...files.map(fileLine), '')

  return `${lines.join('\n').replace(/\n+$/, '')}\n`
}

// ---------- pointer ----------

export function pointerJson(file, hash) {
  const pointer = {
    name: file.name,
    size: file.size,
    mime: file.mime ?? null,
    storage_path: file.storage_path,
    sha256: hash,
  }
  return `${JSON.stringify(pointer, null, 2)}\n`
}

// ---------- the plan ----------

// Every path sync may write, relative to the out folder with / separators:
// { path, kind: 'md', source: 'item.md' | 'STATUS.md', content, files? }
// { path, kind: 'copy' | 'pointer', source: FileRow }.
// Item folders in board order of creation, STATUS.md last.
export function mirrorTargets(data, now) {
  const participants = data.participants ?? []
  const targets = []
  const seen = new Set()
  for (const item of itemsToMirror(data, now).sort(byCreated)) {
    let slug = itemSlug(item)
    // Two items whose first 6 id characters agree and whose titles map to the
    // same slug: the later one gets the whole id.
    if (seen.has(slug)) slug = slug.slice(0, slug.length - idPart(item.id).length) + idPart(item.id, Infinity)
    seen.add(slug)
    const files = fileTargets(item.id, data.files ?? [])
    const module = (data.modules ?? []).find((m) => m.id === item.module_id) ?? null
    const content = renderItemMd(item, data.plans ?? [], data.actions ?? [], data.questions ?? [], data.rulings ?? [], participants, {
      module,
      files,
    })
    targets.push({ path: `${slug}/${ITEM_FILE}`, kind: 'md', source: ITEM_FILE, content, files })
    for (const f of files) {
      if (f.kind !== 'repo') targets.push({ path: `${slug}/${f.name}`, kind: f.kind, source: f.file })
    }
  }
  targets.push({ path: STATUS_FILE, kind: 'md', source: STATUS_FILE, content: statusMarkdown(data, participants) })
  return targets
}

// existing: Map<path, { size, sha256?, pointerStoragePath? }> for files on disk.
// Returns [{ path, action: 'write' | 'skip' | 'pointer', source, content? }].
export function planMirror(data, existing, { now }) {
  return mirrorTargets(data, now).map((t) => {
    const have = existing.get(t.path)
    if (t.kind === 'md') {
      const same = have?.sha256 === sha256(t.content)
      return same ? { path: t.path, action: 'skip', source: t.source } : { path: t.path, action: 'write', source: t.source, content: t.content }
    }
    if (t.kind === 'pointer') {
      return { path: t.path, action: have?.pointerStoragePath === t.source.storage_path ? 'skip' : 'pointer', source: t.source }
    }
    return { path: t.path, action: have && have.size === t.source.size ? 'skip' : 'write', source: t.source }
  })
}
