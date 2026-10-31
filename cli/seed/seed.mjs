#!/usr/bin/env node
// First fill of a Huginn project from a seed file (plan 3 Task 5).
//   node cli/seed/seed.mjs --project metta --file cli/seed/metta-2026-10-31.json [--dry-run]
// Writes through the same functions as `huginn item create` (cli/lib/ops.mjs),
// signed in as the CLI user, so RLS and the triggers apply. Positions come from
// placeItem, one card at a time, each new card an obstacle for the next.
// One time: metta was seeded on 2026-10-31. A real run refuses when the project
// already has items other than "Prófun: " test items (seedRefusal), because an
// item renamed on the web would be created again. --again overrides that.
// Within a run, an entry whose exact title already exists in the project is
// skipped. It never deletes; a failed entry is reported and the run goes on.
// An entry partly created (createItem worked, then a plan, ruling or action
// insert failed) is skipped by a rerun too, because idempotence goes by title.
// Finish it by hand with the CLI write commands, using the id the run printed.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getClient, getProject, getUser, loadBoard } from '../lib/client.mjs'
import { shortId } from '../lib/format.mjs'
import { addAction, addPlan, addRuling, createItem } from '../lib/ops.mjs'
import { resolveShort } from '../lib/write.mjs'
import { describeEntry, itemInput, placeEntry, seedRefusal, splitSeed, validateSeed } from './seedlib.mjs'

function args(argv) {
  const out = { dryRun: false, again: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') out.dryRun = true
    else if (a === '--again') out.again = true
    else if (a === '--project') out.project = argv[++i]
    else if (a === '--file') out.file = argv[++i]
    else throw new Error(`Óþekktur rofi: ${a}`)
  }
  if (!out.project || !out.file) throw new Error('Notkun: seed.mjs --project <slug> --file <seed.json> [--dry-run] [--again]')
  return out
}

async function allTitles(client, projectId) {
  const { data, error } = await client.from('hg_items').select('title').eq('project_id', projectId)
  if (error) throw new Error(`Gat ekki sótt titla verka: ${error.message}`)
  return (data ?? []).map((r) => r.title.trim())
}

async function main() {
  const opts = args(process.argv.slice(2))
  const data = JSON.parse(readFileSync(resolve(process.cwd(), opts.file), 'utf8'))

  const client = await getClient()
  const user = await getUser(client)
  const project = await getProject(client, opts.project)
  const board = await loadBoard(client, project.id)
  const ctx = { projectId: project.id, userId: user.id, modules: board.modules, participants: board.participants }

  const errors = validateSeed(data, ctx)
  if (errors.length) {
    for (const e of errors) console.error(e)
    throw new Error(`Seed skráin stenst ekki (${errors.length} villur), ekkert skrifað.`)
  }

  const titles = await allTitles(client, project.id)
  const asOf = data.as_of ?? opts.file.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null
  const refusal = seedRefusal(titles, { dryRun: opts.dryRun, again: opts.again, asOf })
  if (refusal) throw new Error(refusal)

  const { create, skip } = splitSeed(data.items, titles)
  console.log(`${opts.dryRun ? 'Prufukeyrsla' : 'Keyrsla'}: ${data.items.length} verk í skránni, ${create.length} ný, ${skip.length} þegar til.\n`)

  const created = []
  const failed = []
  let fake = 0
  for (const entry of create) {
    const input = itemInput(entry, ctx)
    const pos = placeEntry(board, input, entry)

    if (opts.dryRun) {
      console.log(describeEntry(entry, pos) + '\n')
      const id = `dry-${++fake}`
      board.items.push({ id, ...input, module_id: input.moduleId, status: input.status, pos_x: pos.x, pos_y: pos.y })
      for (const p of entry.plans ?? []) board.plans.push({ item_id: id, status: p.status })
      for (const _ of entry.actions ?? []) board.actions.push({ item_id: id, done_at: null })
      continue
    }

    let item = null
    try {
      item = await createItem(client, { ...input, pos })
      board.items.push(item)
      for (const p of entry.plans ?? []) {
        const plan = await addPlan(client, {
          projectId: project.id,
          itemId: item.id,
          name: p.name,
          path: p.path ?? null,
          status: p.status,
        })
        board.plans.push(plan)
        for (const r of p.rulings ?? []) {
          await addRuling(client, { projectId: project.id, planId: plan.id, code: r.code, body: r.body, cost: r.cost ?? null })
        }
      }
      for (const a of entry.actions ?? []) {
        const action = await addAction(client, {
          projectId: project.id,
          itemId: item.id,
          owner: resolveShort(board.participants, a.owner),
          body: a.body,
          payload: a.payload ?? null,
        })
        board.actions.push(action)
      }
      created.push(item)
      console.log(`+ #${shortId(item.id)} ${item.title} (${item.status}, ${pos.x},${pos.y})`)
    } catch (error) {
      failed.push({ title: entry.title, id: item?.id ?? null, error: error.message })
      console.error(`! ${entry.title}${item ? ` #${shortId(item.id)} stofnað en ekki klárað` : ''}: ${error.message}`)
    }
  }

  for (const entry of skip) console.log(`= ${entry.title} (til fyrir, sleppt)`)
  console.log(`\nStofnuð: ${opts.dryRun ? 0 : created.length}${opts.dryRun ? ` (prufa: ${create.length} yrðu stofnuð)` : ''}, sleppt: ${skip.length}, mistókst: ${failed.length}`)
  for (const f of failed) console.log(`  mistókst: ${f.title}${f.id ? ` #${f.id}` : ''}: ${f.error}`)
  if (failed.length) process.exitCode = 1
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
