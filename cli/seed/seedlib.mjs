import { CREATE_STATUSES, PLAN_STATUSES, placeItem, resolveModule, resolveShort } from '../lib/write.mjs'

// Pure parts of the seed (cli/seed/seed.mjs): checking the seed file against
// the live board, turning an entry into createItem input, and deciding what to
// create or skip. No Supabase here, so vitest covers it.

// A dash used as punctuation: an en, em or figure dash anywhere, or a hyphen
// standing alone between spaces. Hyphens inside words ("Fable-yfirferð") and
// token names ("--mc-ink") are fine.
export function hasDashPunctuation(text) {
  return /[‒–—―]|(^|\s)-{1,2}(\s|$)/.test(String(text ?? ''))
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0
}

// Every problem in the seed file as one Icelandic line each. An empty list
// means the file can run. ctx: { modules, participants } from loadBoard.
export function validateSeed(data, ctx) {
  const errors = []
  if (!data || !Array.isArray(data.items)) return ['Skráin þarf fylkið items.']

  const seen = new Set()
  data.items.forEach((entry, index) => {
    const where = `Verk ${index + 1}${nonEmpty(entry?.title) ? ` (${entry.title})` : ''}`
    const err = (msg) => errors.push(`${where}: ${msg}`)
    const text = (label, value) => {
      if (hasDashPunctuation(value)) err(`bandstrik sem greinarmerki í ${label}`)
    }

    if (!nonEmpty(entry?.title)) {
      err('titil vantar')
      return
    }
    const title = entry.title.trim()
    if (seen.has(title)) err('titill kemur oftar en einu sinni')
    seen.add(title)
    text('titli', entry.title)
    text('samantekt', entry.summary)
    text('lýsingu', entry.body)
    if (!nonEmpty(entry.body)) err('lýsingu vantar')
    if (!nonEmpty(entry.source_ref)) err('heimild (source_ref) vantar')

    if (!CREATE_STATUSES.includes(entry.status)) err(`óþekkt staða ${entry.status}`)
    if (entry.waiting_on != null && entry.status !== 'waiting') err('waiting_on á aðeins við stöðuna waiting')
    if (entry.waiting_on != null) {
      try {
        resolveShort(ctx.participants, entry.waiting_on)
      } catch (e) {
        err(e.message)
      }
    }
    if (entry.module != null) {
      try {
        resolveModule(ctx.modules, entry.module)
      } catch (e) {
        err(e.message)
      }
    }

    if (!Array.isArray(entry.tags ?? [])) err('tags þarf að vera fylki')
    for (const tag of entry.tags ?? []) {
      if (!nonEmpty(tag)) err('tómt merki')
      text('merki', tag)
    }

    const plans = entry.plans ?? []
    if (entry.status === 'building' && !plans.some((p) => p.status === 'building')) {
      err('staðan building þarf plan í byggingu')
    }
    for (const plan of plans) {
      if (!nonEmpty(plan.name)) err('plan án nafns')
      text('nafni plans', plan.name)
      if (!PLAN_STATUSES.includes(plan.status)) err(`óþekkt staða plans ${plan.status}`)
      for (const r of plan.rulings ?? []) {
        if (!nonEmpty(r.code) || !nonEmpty(r.body)) err(`úrskurð á ${plan.name} vantar kóða eða texta`)
        text(`úrskurði ${r.code}`, r.body)
        text(`kostnaði ${r.code}`, r.cost)
      }
    }

    for (const action of entry.actions ?? []) {
      if (!nonEmpty(action.body)) err('handtak án texta')
      text('handtaki', action.body)
      try {
        if (resolveShort(ctx.participants, action.owner) === null) err('handtak þarf eiganda')
      } catch (e) {
        err(e.message)
      }
    }
  })
  return errors
}

// createItem input for one entry (positions come from placeItem at run time).
export function itemInput(entry, ctx) {
  return {
    projectId: ctx.projectId,
    userId: ctx.userId,
    title: entry.title.trim(),
    body: entry.body ?? null,
    summary: entry.summary ?? null,
    moduleId: entry.module != null ? resolveModule(ctx.modules, entry.module) : null,
    tags: [...new Set(entry.tags ?? [])],
    status: entry.status,
    waitingOn: entry.waiting_on != null ? resolveShort(ctx.participants, entry.waiting_on) : null,
    sourceRef: entry.source_ref ?? null,
  }
}

// placeItem estimates a new card's height from its plans and open actions
// only when they are on the board under the card's id, so placeholder rows
// stand in for them while the spot is chosen. Without them a card with plans
// can be put in a gap too small for it.
export function placeEntry(board, input, entry) {
  const id = 'seed-pending'
  const plans = (entry.plans ?? []).map((p) => ({ item_id: id, status: p.status }))
  const actions = (entry.actions ?? []).map(() => ({ item_id: id, done_at: null }))
  board.plans.push(...plans)
  board.actions.push(...actions)
  try {
    return placeItem(board, input.moduleId, { id, title: input.title, tags: input.tags, fileCount: 0 })
  } finally {
    board.plans = board.plans.filter((p) => p.item_id !== id)
    board.actions = board.actions.filter((a) => a.item_id !== id)
  }
}

// Idempotence (ruling R32): an entry whose exact title already exists in the
// project, whatever its status, is skipped.
export function splitSeed(items, existingTitles) {
  const have = new Set(existingTitles)
  const create = []
  const skip = []
  for (const entry of items) (have.has(entry.title.trim()) ? skip : create).push(entry)
  return { create, skip }
}

// One block of the dry run: the item and everything that would be written.
export function describeEntry(entry, pos) {
  const lines = []
  const who = entry.waiting_on ? `, bíður ${entry.waiting_on}` : ''
  lines.push(`${entry.title}`)
  lines.push(`  módúll ${entry.module ?? '(enginn)'}, staða ${entry.status}${who}, staðsetning ${pos.x},${pos.y}`)
  if (entry.tags?.length) lines.push(`  merki: ${entry.tags.join(', ')}`)
  lines.push(`  heimild: ${entry.source_ref}`)
  for (const p of entry.plans ?? []) {
    const n = p.rulings?.length ? `, ${p.rulings.length} úrskurðir` : ''
    lines.push(`  plan: ${p.name} (${p.status})${p.path ? ` ${p.path}` : ''}${n}`)
  }
  for (const a of entry.actions ?? []) {
    lines.push(`  handtak ${a.owner}: ${a.body}${a.payload ? ' [með payload]' : ''}`)
  }
  return lines.join('\n')
}
