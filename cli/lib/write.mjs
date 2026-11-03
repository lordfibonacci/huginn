import { isOnBoard } from './status.mjs'

// Pure helpers behind the write commands: flag parsing, id prefixes, who and
// which module a short or slug means, the close guard, upload rules copied
// from the web and card placement without a DOM. No Supabase here; the
// database calls live in ops.mjs.

// ---------- flags ----------

const GLOBAL_SPEC = { project: 'value', json: 'bool', debug: 'bool', help: 'bool' }

// spec maps a flag name to 'value', 'multi' (repeatable value) or 'bool'.
// Unknown flags are refused (ruling R17). A value flag never takes a word that
// starts with --, so a missing value cannot swallow the next flag; use
// --name=value for a value that starts with --.
export function parseCommand(argv, spec, label) {
  const known = { ...GLOBAL_SPEC, ...spec }
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
    const name = eq >= 0 ? body.slice(0, eq) : body
    const kind = Object.hasOwn(known, name) ? known[name] : undefined
    if (!kind) throw new Error(`Óþekktur rofi --${name} fyrir huginn ${label}. Sjá huginn --help.`)
    let value
    if (kind === 'bool') {
      if (eq >= 0) throw new Error(`--${name} tekur ekki gildi.`)
      value = true
    } else if (eq >= 0) {
      value = body.slice(eq + 1)
    } else {
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) throw new Error(`--${name} vantar gildi.`)
      value = next
      i++
    }
    if (kind === 'multi') {
      ;(flags[name] ??= []).push(value)
    } else {
      if (Object.hasOwn(flags, name)) throw new Error(`--${name} er gefinn oftar en einu sinni.`)
      flags[name] = value
    }
  }
  return { positional, flags }
}

// ---------- values ----------

export const ITEM_STATUSES = ['new', 'waiting', 'ready', 'building', 'parked', 'done', 'dropped']
export const CREATE_STATUSES = ['new', 'waiting', 'ready', 'building', 'parked']
export const PLAN_STATUSES = ['todo', 'building', 'done']

function isNone(value) {
  return String(value).trim().toLowerCase() === 'none'
}

// User id of the participant with this short, case insensitive (shorts are
// unique per project that way, migration 0006). 'none' gives null.
export function resolveShort(participants, short) {
  if (isNone(short)) return null
  const want = String(short).trim().toLocaleLowerCase('is')
  const hit = participants.find((p) => String(p.short).toLocaleLowerCase('is') === want)
  if (!hit) {
    const known = participants.map((p) => p.short).join(', ')
    throw new Error(`Enginn þátttakandi með skammstöfunina ${short}. Í boði: ${known}.`)
  }
  return hit.user_id
}

// Module id for a slug. 'none' gives null.
export function resolveModule(modules, slug) {
  if (isNone(slug)) return null
  const want = String(slug).trim()
  const hit = modules.find((m) => m.slug === want)
  if (!hit) throw new Error(`Enginn módúll með slug ${slug}. Slug módúla sjást í huginn pull --json.`)
  return hit.id
}

export function parseTags(text) {
  const tags = String(text ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
  return [...new Set(tags)]
}

// The status and waiting_on part of an item patch. waitingOn is undefined when
// --waiting-on was not given, null for none, else a user id. Like the web
// (statusPatch in panel.ts), any status other than waiting clears waiting_on.
// Unlike the web, waiting with nobody to wait on is allowed. A person given
// without a status means the item now waits on them.
export function statusPatch(status, waitingOn) {
  if (status !== undefined && !ITEM_STATUSES.includes(status)) {
    throw new Error(`Óþekkt staða: ${status}. Í boði: ${ITEM_STATUSES.join(', ')}.`)
  }
  if (status === undefined) {
    if (waitingOn === undefined) return {}
    return waitingOn === null ? { waiting_on: null } : { status: 'waiting', waiting_on: waitingOn }
  }
  if (status === 'waiting') return waitingOn === undefined ? { status } : { status, waiting_on: waitingOn }
  if (waitingOn) throw new Error('--waiting-on á aðeins við þegar verkið bíður (--status waiting).')
  return { status, waiting_on: null }
}

function countWord(n, one, many) {
  return `${n} ${n % 10 === 1 && n % 100 !== 11 ? one : many}`
}

// Review focus 3: an item with an unanswered question or an open action is not
// closed (done or dropped) unless forced.
export function guardClose(item, questions, actions, force) {
  if (force) return { ok: true }
  const openQ = questions.filter((q) => q.item_id === item.id && q.answer == null).length
  const openA = actions.filter((a) => a.item_id === item.id && a.done_at == null).length
  if (openQ === 0 && openA === 0) return { ok: true }
  const parts = []
  if (openQ) parts.push(countWord(openQ, 'ósvaraða spurningu', 'ósvaraðar spurningar'))
  if (openA) parts.push(countWord(openA, 'opið handtak', 'opin handtök'))
  return {
    ok: false,
    reason: `Verkið á ${parts.join(' og ')} eftir. Svaraðu og kláraðu fyrst, eða notaðu --force til að loka samt.`,
  }
}

// ---------- ids (ruling R15) ----------

const KIND_NONE = {
  item: 'neitt verk',
  question: 'neina spurningu',
  action: 'neitt handtak',
  plan: 'neitt plan',
  file: 'neina skrá',
}

function uuidOf(hex) {
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

// A full uuid or a prefix of at least 8 hex characters (a leading # and dashes
// allowed), as the range of uuids it covers. uuid order in Postgres is byte
// order, the same as the order of the hex text, so lo..hi finds the prefix.
export function idRange(input) {
  const raw = String(input ?? '').trim().toLowerCase().replace(/^#/, '')
  const hex = raw.replace(/-/g, '')
  if (!/^[0-9a-f-]+$/.test(raw) || !/^[0-9a-f]{8,32}$/.test(hex)) {
    throw new Error(`Auðkennið ${input} er ógilt. Gefðu heilt uuid eða að minnsta kosti 8 fyrstu stafi þess.`)
  }
  return { prefix: hex, lo: uuidOf(hex.padEnd(32, '0')), hi: uuidOf(hex.padEnd(32, 'f')) }
}

export function pickOne(rows, input, kind) {
  const { prefix } = idRange(input)
  const hits = rows.filter((r) => String(r.id).replace(/-/g, '').toLowerCase().startsWith(prefix))
  if (hits.length === 0) throw new Error(`Auðkennið ${input} passar ekki við ${KIND_NONE[kind] ?? 'neitt'} í verkefninu.`)
  if (hits.length > 1) throw new Error(`Auðkennið ${input} passar við fleiri en eitt atriði, gefðu lengra auðkenni.`)
  return hits[0]
}

// ---------- uploads: copies of src/vinnubord/lib/upload.ts (ruling R3) ----------

export const MAX_UPLOAD_BYTES = 52428800
export const MAX_NAME_LENGTH = 180

export function validateUpload(file) {
  if (file.size <= 0) return { ok: false, reason: 'Skráin er tóm.' }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: 'Skráin er stærri en 50 MB. Stærri skrár bíða Pro-áskriftar.' }
  }
  if (file.name.length > MAX_NAME_LENGTH) {
    return { ok: false, reason: 'Nafn skrárinnar er of langt. Hámark er 180 stafir.' }
  }
  return { ok: true }
}

export function storageSafeName(name) {
  const safe = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
  return safe.length > 0 ? safe : 'skra'
}

// Same key as uploadFile in src/vinnubord/lib/api.ts.
export function storagePath(projectId, itemId, uuid, name) {
  return `${projectId}/${itemId}/${uuid}_${storageSafeName(name)}`
}

// The key of "same path is the same file" (0014): variants of one repo path
// (backslashes, a leading ./, doubled slashes, spaces around it) are one key.
export function normalizeRepoPath(input) {
  let path = String(input).trim().replace(/\\/g, '/').replace(/\/{2,}/g, '/')
  while (path.startsWith('./')) path = path.slice(2)
  if (path === '') throw new Error('Slóðin er tóm.')
  return path
}

// The browser fills File.type for the web; the CLI guesses from the extension.
const MIME = {
  md: 'text/markdown',
  txt: 'text/plain',
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  csv: 'text/csv',
  js: 'text/javascript',
  json: 'application/json',
  sql: 'application/sql',
  yaml: 'application/yaml',
  yml: 'application/yaml',
  pdf: 'application/pdf',
  zip: 'application/zip',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  heic: 'image/heic',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
}

export function mimeFor(name) {
  const dot = name.lastIndexOf('.')
  if (dot < 0) return null
  return MIME[name.slice(dot + 1).toLowerCase()] ?? null
}

// ---------- placement (ruling R14) ----------

// Copy of src/vinnubord/lib/placement.ts, checked by parity.test.mjs.
export const NEW_CARD_GAP = 40
const MAX_STEPS = 12

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export function placeNewCard(opts) {
  const { anchor, center, size, obstacles } = opts
  const stepY = size.h + NEW_CARD_GAP
  const candidates = []
  if (anchor) {
    const left = anchor.x - NEW_CARD_GAP - size.w
    const right = anchor.x + anchor.w + NEW_CARD_GAP
    for (let k = 0; k < MAX_STEPS; k++) {
      const y = anchor.y + k * stepY
      candidates.push({ x: left, y }, { x: right, y })
    }
  } else {
    const x = center.x - size.w / 2
    const y = center.y - size.h / 2
    const stepX = size.w + NEW_CARD_GAP
    for (let k = 0; k < MAX_STEPS; k++) {
      const dy = k * stepY
      candidates.push({ x, y: y + dy }, { x: x + stepX, y: y + dy }, { x: x - stepX, y: y + dy })
    }
  }
  const round = (p) => ({ x: Math.round(p.x), y: Math.round(p.y) })
  const free = candidates.find((p) => !obstacles.some((o) => overlaps({ ...p, ...size }, o)))
  return round(free ?? candidates[0])
}

// Sizes from the --hg-* tokens in src/vinnubord/vinnubord.css and NEW_CARD_SIZE
// in Board.tsx, checked by parity.test.mjs. CSS_TOKENS names the token behind
// each plain px value.
export const CSS_TOKENS = {
  packW: 'pack-w',
  packPadTop: 'pack-pad-top',
  packTitleGap: 'pack-title-gap',
  packTitleSize: 'pack-title-size',
  moduleIndent: 'module-indent',
  moduleGap: 'module-gap',
  moduleNameSize: 'module-name-size',
  moduleCountSize: 'module-count-size',
  moduleRowGap: 'module-row-gap',
  moduleLineSize: 'module-line-size',
  moduleLineGap: 'module-line-gap',
  touch: 'touch',
  cardW: 'card-w',
  cardStSize: 'card-st-size',
  cardStGap: 'card-st-gap',
  cardTitleSize: 'card-title-size',
  avSize: 'av-size',
  cardChipsGap: 'card-chips-gap',
  cardChipGap: 'card-chip-gap',
  chipSize: 'chip-size',
  cardPlansGap: 'card-plans-gap',
  barH: 'bar-h',
  cardPlanLabelGap: 'card-plan-label-gap',
  cardPlanLabelSize: 'card-plan-label-size',
}

// line-height normal for Manrope, and the 1.3 the card rows set.
const LH_NORMAL = 1.37
const LH_CARD = 1.3
// Average glyph width as a share of the font size, on the wide side so an
// estimate errs toward a taller box.
const GLYPH_BOLD = 0.62
const GLYPH_REGULAR = 0.56
// Room the open count ("3 opin") takes beside a module name.
const MODULE_COUNT_CHARS = 7
const BORDER = 2

const base = {
  packW: 440,
  packPadTop: 14,
  packTitleGap: 16,
  packTitleSize: 30,
  moduleIndent: 8,
  moduleGap: 12,
  modulePadY: 48,
  modulePadX: 56,
  moduleNameSize: 26,
  moduleCountSize: 15,
  moduleRowGap: 10,
  moduleLineSize: 15,
  moduleLineGap: 3,
  touch: 44,
  cardW: 250,
  cardPadY: 29,
  cardPadX: 34,
  cardStSize: 12,
  cardStGap: 8,
  cardTitleSize: 17,
  avSize: 20,
  cardChipsGap: 10,
  cardChipGap: 5,
  chipPadY: 6,
  chipPadX: 16,
  chipSize: 11,
  cardPlansGap: 11,
  barH: 5,
  cardPlanLabelGap: 6,
  cardPlanLabelSize: 11.5,
  newCardH: 120,
  gap: NEW_CARD_GAP,
}

export const BOARD_SIZES = {
  ...base,
  // Pack padding, title line and title gap: where the first module starts.
  // The title is a button at least --hg-touch tall, which beats its text line.
  packHead: Math.round(base.packPadTop + Math.max(base.touch, base.packTitleSize * LH_NORMAL) + base.packTitleGap),
}

const S = BOARD_SIZES

function lines(text, width, fontSize, glyph) {
  const len = String(text ?? '').length
  return Math.max(1, Math.ceil((len * fontSize * glyph) / width))
}

export function estimateModuleHeight(module) {
  const inner = S.packW - S.moduleIndent - S.modulePadX - BORDER
  const nameWidth = inner - S.moduleRowGap - MODULE_COUNT_CHARS * S.moduleCountSize * GLYPH_REGULAR
  let h = BORDER + S.modulePadY + lines(module.name, nameWidth, S.moduleNameSize, GLYPH_BOLD) * S.moduleNameSize * LH_NORMAL
  if (module.status_line) {
    h += S.moduleLineGap + lines(module.status_line, inner, S.moduleLineSize, GLYPH_REGULAR) * S.moduleLineSize * LH_NORMAL
  }
  return Math.ceil(Math.max(S.touch, h))
}

// Estimated height of an item card: status row, title, mover row, chips and
// plan bars as ItemCard draws them. Never less than the size the web assumes
// for a card it has not drawn yet. A new card (no id) may carry fileCount.
export function estimateCardHeight(item, board = {}) {
  const inner = S.cardW - S.cardPadX - BORDER
  const mine = (rows) => (item.id ? (rows ?? []).filter((r) => r.item_id === item.id) : [])
  const fileCount = item.fileCount ?? mine(board.files).length
  const actionsOpen = mine(board.actions).filter((a) => a.done_at == null).length
  const plans = mine(board.plans).length

  let h = BORDER + S.cardPadY
  h += S.cardStSize * LH_CARD + S.cardStGap
  h += lines(item.title, inner, S.cardTitleSize, GLYPH_BOLD) * S.cardTitleSize * LH_CARD
  h += S.cardStGap + S.avSize

  const chips = [...(item.tags ?? [])]
  if (fileCount > 0) chips.push(`${fileCount} skrár`)
  if (actionsOpen > 0) chips.push(`${actionsOpen} handtök`)
  if (chips.length) {
    const width = chips.reduce((sum, c) => sum + c.length * S.chipSize * GLYPH_REGULAR + S.chipPadX + S.cardChipGap, 0)
    const rows = Math.max(1, Math.ceil(width / inner))
    const rowH = S.chipSize * LH_NORMAL + S.chipPadY
    h += S.cardChipsGap + rows * rowH + (rows - 1) * S.cardChipGap
  }
  if (plans > 0) h += S.cardPlansGap + S.barH + S.cardPlanLabelGap + S.cardPlanLabelSize * LH_NORMAL

  return Math.ceil(Math.max(S.newCardH, h))
}

// Pack columns and module cards as world rects, laid out like PackColumn:
// packages by position, each pack's modules by position under its title.
// Modules in no pack are not drawn, so they get no rect.
export function boardRects(board) {
  const packs = []
  const modules = new Map()
  const pkgs = [...(board.packages ?? [])].sort((a, b) => a.position - b.position)
  for (const pkg of pkgs) {
    const mods = (board.modules ?? [])
      .filter((m) => m.package_id === pkg.id)
      .sort((a, b) => a.position - b.position)
    let y = pkg.pos_y + S.packHead
    for (const m of mods) {
      const h = estimateModuleHeight(m)
      modules.set(m.id, { x: pkg.pos_x + S.moduleIndent, y, w: S.packW - S.moduleIndent, h })
      y += h + S.moduleGap
    }
    packs.push({ x: pkg.pos_x, y: pkg.pos_y, w: S.packW, h: y - pkg.pos_y })
  }
  return { packs, modules }
}

// Where a new card lands, the CLI's stand in for Board.placeNew. With a module
// in a pack: beside the module, as on the web. Without one: the web uses the
// centre of the view; the CLI has no view and starts at the top left corner of
// what is on the board (the origin on an empty board). Obstacles are pack
// columns and open cards. When every spot placeNewCard tries is taken, the
// card goes straight below everything in that column, so it never overlaps.
export function placeItem(board, moduleId, card = { title: '', tags: [] }) {
  const { packs, modules } = boardRects(board)
  const cards = (board.items ?? [])
    .filter(isOnBoard)
    .map((i) => ({ x: i.pos_x, y: i.pos_y, w: S.cardW, h: estimateCardHeight(i, board) }))
  const obstacles = [...packs, ...cards]
  const size = { w: S.cardW, h: estimateCardHeight(card, board) }
  const anchor = (moduleId && modules.get(moduleId)) || null

  let origin = { x: 0, y: 0 }
  if (obstacles.length) {
    origin = { x: Math.min(...obstacles.map((o) => o.x)), y: Math.min(...obstacles.map((o) => o.y)) }
  }
  const center = { x: origin.x + size.w / 2, y: origin.y + size.h / 2 }

  const pos = placeNewCard({ anchor, center, size, obstacles })
  if (!obstacles.some((o) => overlaps({ ...pos, ...size }, o))) return pos

  let y = pos.y
  for (const o of obstacles) {
    if (o.x < pos.x + size.w && o.x + o.w > pos.x) y = Math.max(y, o.y + o.h + NEW_CARD_GAP)
  }
  return { x: pos.x, y: Math.ceil(y) }
}
