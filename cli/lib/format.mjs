import { STATUS_NAMES, isOpen, toneOf, waitsFor } from './status.mjs'

// Readable output of the CLI. Everything here is deterministic: the same data
// gives the same string byte for byte (ISO dates, stable sorts, no "today").

// Genitive names for the "Bíður <X>" headings, keyed by participant short.
const GENITIVE = { C: 'Claude', H: 'Heimis', Á: 'Árna' }

// C0 controls, DEL and C1 controls (ESC, BEL, the CSI byte 0x9b and friends).
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g

// Every database string printed outside --json goes through this: whitespace
// collapsed to single spaces, then control characters removed, so text cannot
// break lines, inject markdown headings or send terminal escapes.
export function oneLine(text) {
  return String(text ?? '')
    .replace(/\s+/g, ' ')
    .replace(CONTROL_CHARS, '')
    .replace(/ {2,}/g, ' ')
    .trim()
}

function iso(stamp) {
  if (!stamp) return '?'
  const ms = Date.parse(stamp)
  return Number.isNaN(ms) ? String(stamp) : new Date(ms).toISOString()
}

function stampValue(stamp) {
  const ms = Date.parse(stamp ?? '')
  return Number.isNaN(ms) ? 0 : ms
}

function byId(a, b) {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

function shortOf(userId, participants) {
  const short = participants.find((p) => p.user_id === userId)?.short
  return short ? oneLine(short) : '?'
}

// The first 8 characters of an id. Write commands take this prefix (ruling R15).
export function shortId(id) {
  return oneLine(String(id ?? '').slice(0, 8))
}

// "[tone] titill, staða, hver, hvenær #id". Who is the participant a waiting item
// waits on, otherwise the creator. When is updated_at.
export function itemLine(item, participants) {
  const who = item.status === 'waiting' && item.waiting_on
    ? `bíður ${shortOf(item.waiting_on, participants)}`
    : `frá ${shortOf(item.created_by, participants)}`
  const status = STATUS_NAMES[item.status] ?? oneLine(item.status)
  return `[${toneOf(item, participants)}] ${oneLine(item.title)}, ${status}, ${who}, ${oneLine(iso(item.updated_at))} #${shortId(item.id)}`
}

function subLines(item, data, participants) {
  const byCreated = (a, b) => stampValue(a.created_at) - stampValue(b.created_at) || byId(a, b)
  const actions = (data.actions ?? [])
    .filter((a) => a.item_id === item.id && a.done_at === null)
    .sort(byCreated)
    .map((a) => {
      const edited = a.updated_at ? `, breytt ${iso(a.updated_at)} af ${shortOf(a.updated_by, participants)}` : ''
      return `  - Handtak, ${shortOf(a.owner, participants)}: ${oneLine(a.body)}${edited} #${shortId(a.id)}`
    })
  const questions = (data.questions ?? [])
    .filter((q) => q.item_id === item.id && q.answered_at === null)
    .sort(byCreated)
    .map((q) =>
      q.asked_to
        ? `  - Spurning til ${shortOf(q.asked_to, participants)}: ${oneLine(q.body)} #${shortId(q.id)}`
        : `  - Spurning: ${oneLine(q.body)} #${shortId(q.id)}`,
    )
  return [...actions, ...questions]
}

function waitingHeading(userId, participants) {
  const p = participants.find((x) => x.user_id === userId)
  if (!p) return `Bíður: ${oneLine(userId)}`
  return GENITIVE[p.short] ? `Bíður ${GENITIVE[p.short]}` : `Bíður: ${oneLine(p.display_name)}`
}

// Text for huginn whoami. Every value comes from the database or auth.
export function whoamiText(user, project, me) {
  const kind = me.is_service ? ', þjónustunotandi' : ''
  return [
    oneLine(user.email),
    `Verkefni: ${oneLine(project.name)} (${oneLine(project.slug)})`,
    `Þátttakandi: ${oneLine(me.display_name)} (${oneLine(me.short)})${kind}`,
  ].join('\n')
}

// Service user first, then by short in Icelandic order, unknown users last.
function waitingOrder(userIds, participants) {
  const rank = (id) => {
    const p = participants.find((x) => x.user_id === id)
    return p ? (p.is_service ? 0 : 1) : 2
  }
  const short = (id) => participants.find((x) => x.user_id === id)?.short ?? ''
  return [...userIds].sort(
    (a, b) => rank(a) - rank(b) || short(a).localeCompare(short(b), 'is') || (a < b ? -1 : a > b ? 1 : 0),
  )
}

// pull --brief (ruling R26): how many open items wait for each participant,
// by the web's waitsFor rule, in the order statusMarkdown lists the
// "Bíður <X>" groups. Every participant is listed, zero included.
export function briefCounts(data, participants) {
  const open = (data.items ?? []).filter(isOpen)
  const actions = data.actions ?? []
  const ids = waitingOrder(participants.map((p) => p.user_id), participants)
  return ids.map((userId) => {
    const p = participants.find((x) => x.user_id === userId)
    return {
      short: p.short,
      display_name: p.display_name,
      count: open.filter((item) => waitsFor(item, actions, userId)).length,
    }
  })
}

// The one line the session start hook prints, e.g.
// "Huginn: 2 bíða Claude, 1 bíða Árna, 0 bíða Heimis".
export function briefLine(counts) {
  if (!counts.length) return 'Huginn: enginn þátttakandi.'
  const parts = counts.map(({ short, display_name, count }) =>
    GENITIVE[short] ? `${count} bíða ${GENITIVE[short]}` : `${count} bíða: ${oneLine(display_name)}`,
  )
  return `Huginn: ${parts.join(', ')}`
}

// Under the STATUS.md title. The groups follow waiting_on only, while the
// session start line (briefCounts) also counts an item for whoever owns an
// open action on it, so the two numbers can differ.
export const STATUS_NOTE =
  'Flokkað eftir því hver á næsta leik (waiting_on). Upphafslína lotunnar telur líka verk þar sem viðkomandi á opið handtak, svo tölurnar þar geta verið hærri.'

// Groups in fixed order (ruling R2), empty groups left out.
export function statusMarkdown(data, participants) {
  const open = (data.items ?? []).filter(isOpen)
  const groups = []
  const add = (heading, items) => {
    if (items.length) groups.push({ heading, items })
  }
  const status = (s) => open.filter((i) => i.status === s)

  add('Nýtt', status('new'))
  const waiting = status('waiting')
  add('Bíður ákvörðunar', waiting.filter((i) => !i.waiting_on))
  const waitedOn = new Set(waiting.filter((i) => i.waiting_on).map((i) => i.waiting_on))
  for (const userId of waitingOrder(waitedOn, participants)) {
    add(waitingHeading(userId, participants), waiting.filter((i) => i.waiting_on === userId))
  }
  add('Tilbúið til byggingar', status('ready'))
  add('Í byggingu', status('building'))
  add('Í bið', status('parked'))

  const lines = [`# Staða: ${oneLine(data.project?.name)}`, '']
  if (!groups.length) {
    lines.push('Ekkert opið verk.', '')
    return lines.join('\n')
  }
  lines.push(STATUS_NOTE, '')
  for (const { heading, items } of groups) {
    lines.push(`## ${heading}`)
    const sorted = [...items].sort((a, b) => stampValue(b.updated_at) - stampValue(a.updated_at) || byId(a, b))
    for (const item of sorted) {
      lines.push(`- ${itemLine(item, participants)}`, ...subLines(item, data, participants))
    }
    lines.push('')
  }
  return lines.join('\n')
}

// pull --since: items changed at or after the stamp, with the rows that hang
// on them. Board structure (project, participants, packages, modules) stays.
export function filterSince(data, since) {
  const from = Date.parse(since)
  const items = data.items.filter((i) => stampValue(i.updated_at) >= from)
  const ids = new Set(items.map((i) => i.id))
  const onItem = (rows) => rows.filter((r) => ids.has(r.item_id))
  const plans = onItem(data.plans)
  const planIds = new Set(plans.map((p) => p.id))
  return {
    ...data,
    items,
    plans,
    files: onItem(data.files),
    questions: onItem(data.questions),
    actions: onItem(data.actions),
    rulings: data.rulings.filter((r) => planIds.has(r.plan_id)),
    comments: data.comments.filter((c) => (c.item_id ? ids.has(c.item_id) : stampValue(c.created_at) >= from)),
    events: data.events.filter((e) => stampValue(e.created_at) >= from),
    reads: onItem(data.reads),
  }
}
