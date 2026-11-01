import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const TOTAL = 7

class Fail extends Error {}
const must = (r, what) => {
  if (r.error) throw new Fail(`${what}: ${r.error.message}`)
  return r.data
}
const expect = (cond, msg) => {
  if (!cond) throw new Fail(msg)
}

let passed = 0
let scenario = 'setup'
let itemId = null
let extraItems = []
let projectId = null
let failure = null
let sb = null

const countKinds = (evs) => {
  const counts = {}
  for (const e of evs) counts[e.kind] = (counts[e.kind] ?? 0) + 1
  return counts
}

try {
  const env = {}
  let raw
  try {
    raw = readFileSync(new URL('../.env', import.meta.url), 'utf8')
  } catch {
    throw new Fail('.env not found next to package.json')
  }
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
  const missing = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'HG_SMOKE_EMAIL', 'HG_SMOKE_PASSWORD'].filter(
    (k) => !env[k],
  )
  if (missing.length) throw new Fail(`missing in .env: ${missing.join(', ')}`)

  sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
  const auth = await sb.auth.signInWithPassword({
    email: env.HG_SMOKE_EMAIL,
    password: env.HG_SMOKE_PASSWORD,
  })
  if (auth.error) throw new Fail(`sign in: ${auth.error.message}`)
  const me = auth.data.user.id

  const project = must(await sb.from('hg_projects').select('id').eq('slug', 'metta').single(), 'project')
  projectId = project.id
  const parts = must(
    await sb.from('hg_participants').select('user_id, short, is_service').eq('project_id', projectId),
    'participants',
  )
  const heimir = parts.find((p) => p.short === 'H')
  const arni = parts.find((p) => p.short === 'Á')
  const claude = parts.find((p) => p.is_service)
  expect(heimir && arni && claude, 'participants H, Á and service user not found')

  const readItem = async () =>
    must(
      await sb
        .from('hg_items')
        .select('status, waiting_on, closed_at, updated_at, updated_by')
        .eq('id', itemId)
        .single(),
      'read item',
    )
  const readEvents = async () =>
    must(await sb.from('hg_events').select('kind, data').eq('item_id', itemId).order('created_at'), 'events')
  const ask = async (bodies) =>
    must(
      await sb
        .from('hg_questions')
        .insert(
          bodies.map((b) => ({
            project_id: projectId,
            item_id: itemId,
            body: b,
            asked_by: me,
            asked_to: arni.user_id,
          })),
        )
        .select('id'),
      'insert questions',
    )
  const answer = (id) =>
    sb
      .from('hg_questions')
      .update({ answer: 'yes', answered_by: me, answered_at: new Date().toISOString() })
      .eq('id', id)

  try {
    scenario = '1 questions'
    const item = must(
      await sb
        .from('hg_items')
        .insert({ project_id: projectId, title: 'smoke test item', created_by: me })
        .select('id')
        .single(),
      'insert item',
    )
    itemId = item.id
    const qs = await ask(['q1', 'q2'])
    must(await answer(qs[0].id), 'answer q1')
    let it = await readItem()
    expect(it.waiting_on === null, `waiting_on after first answer is ${it.waiting_on}, expected null`)
    expect(it.status !== 'waiting', 'status after first answer is waiting, expected unchanged')
    // the item now waits on Árni, so answering the last question is a ball move with status already waiting
    must(
      await sb.from('hg_items').update({ status: 'waiting', waiting_on: arni.user_id }).eq('id', itemId),
      'wait on Árni',
    )
    must(await answer(qs[1].id), 'answer q2')
    it = await readItem()
    expect(it.status === 'waiting', `status is ${it.status}, expected waiting`)
    expect(it.waiting_on === claude.user_id, 'waiting_on is not the service user')
    const evs = await readEvents()
    const counts = countKinds(evs)
    const want = { 'item.created': 1, 'question.asked': 2, 'question.answered': 2, 'item.status': 2 }
    for (const [k, n] of Object.entries(want))
      expect(counts[k] === n, `event ${k} count ${counts[k] ?? 0}, expected ${n}`)
    expect(evs.length === 7, `item has ${evs.length} events, expected 7`)
    const move = evs.filter((e) => e.kind === 'item.status').at(-1)
    expect(
      move.data.from === 'waiting' &&
        move.data.to === 'waiting' &&
        move.data.waiting_on === claude.user_id &&
        move.data.waiting_on_from === arni.user_id,
      `ball move event data is ${JSON.stringify(move.data)}`,
    )
    passed++

    scenario = '2 done item'
    must(await sb.from('hg_items').update({ status: 'done' }).eq('id', itemId), 'mark item done')
    const before = await readItem()
    expect(before.closed_at, 'closed_at not set on done')
    const [q3] = await ask(['q3'])
    must(await answer(q3.id), 'answer q3')
    const after = await readItem()
    expect(after.status === 'done', `status after answer on done item is ${after.status}, expected done`)
    expect(after.closed_at === before.closed_at, `closed_at changed from ${before.closed_at} to ${after.closed_at}`)
    passed++

    scenario = '3 actions'
    const act = must(
      await sb
        .from('hg_actions')
        .insert({ project_id: projectId, item_id: itemId, body: 'do it', owner: heimir.user_id })
        .select('id')
        .single(),
      'insert action',
    )
    must(await sb.from('hg_actions').update({ done_at: new Date().toISOString() }).eq('id', act.id), 'mark done')
    const a = must(await sb.from('hg_actions').select('done_at, done_by').eq('id', act.id).single(), 'read action')
    expect(a.done_at, 'done_at not set')
    expect(a.done_by === me, `done_by is ${a.done_by}, expected signed-in user`)
    const pre = must(
      await sb
        .from('hg_actions')
        .insert({
          project_id: projectId,
          item_id: itemId,
          body: 'already done',
          owner: heimir.user_id,
          done_at: new Date().toISOString(),
          done_by: heimir.user_id,
        })
        .select('done_by')
        .single(),
      'insert done action',
    )
    expect(pre.done_by === me, `done_by on done insert is ${pre.done_by}, expected signed-in user`)
    const ac = countKinds(await readEvents())
    expect(ac['action.added'] === 2, `event action.added count ${ac['action.added'] ?? 0}, expected 2`)
    expect(ac['action.done'] === 2, `event action.done count ${ac['action.done'] ?? 0}, expected 2`)
    passed++

    scenario = '4 drag'
    const still = await readItem()
    const nEvents = (await readEvents()).length
    must(await sb.from('hg_items').update({ pos_x: 120, pos_y: 80 }).eq('id', itemId), 'move item')
    const moved = await readItem()
    expect(moved.updated_at === still.updated_at, `updated_at changed on drag: ${still.updated_at} to ${moved.updated_at}`)
    expect(moved.updated_by === still.updated_by, 'updated_by changed on drag')
    const nAfter = (await readEvents()).length
    expect(nAfter === nEvents, `drag wrote ${nAfter - nEvents} events, expected 0`)
    passed++

    scenario = '5 reads'
    // The first upsert inserts, the second hits the conflict and updates. A
    // supplied read_at far in the past must be replaced by the server clock
    // on both paths (hg_reads_stamp_trg, migration 0006).
    for (let n = 0; n < 2; n++) {
      const rows = must(
        await sb
          .from('hg_reads')
          .upsert(
            { project_id: projectId, item_id: itemId, user_id: me, read_at: '2000-01-01T00:00:00Z' },
            { onConflict: 'item_id,user_id' },
          )
          .select('read_at'),
        `upsert read ${n + 1}`,
      )
      const at = Date.parse(rows[0]?.read_at ?? '')
      expect(at > Date.parse('2020-01-01T00:00:00Z'), `upsert read ${n + 1} kept the client read_at ${rows[0]?.read_at}`)
    }
    passed++
    scenario = '7 plan moves item'
    const newItem = async (over = {}) => {
      const row = must(
        await sb
          .from('hg_items')
          .insert({ project_id: projectId, title: 'smoke plan item', created_by: me, ...over })
          .select('id')
          .single(),
        'insert plan item',
      )
      extraItems.push(row.id)
      return row.id
    }
    const readOne = async (id) =>
      must(await sb.from('hg_items').select('status, waiting_on, closed_at, updated_at').eq('id', id).single(), 'read plan item')
    const addPlan = async (id, status = 'todo') =>
      must(
        await sb.from('hg_plans').insert({ project_id: projectId, item_id: id, name: 'p', status }).select('id').single(),
        'insert plan',
      ).id
    const setPlan = async (pid, status) => must(await sb.from('hg_plans').update({ status }).eq('id', pid), `plan ${status}`)
    const statusEvents = async (id) =>
      must(await sb.from('hg_events').select('data').eq('item_id', id).eq('kind', 'item.status').order('created_at'), 'status events')

    // a. a plan in todo moves nothing
    const pItem = await newItem({ status: 'parked' })
    const p1 = await addPlan(pItem)
    let s = await readOne(pItem)
    expect(s.status === 'parked', `after todo plan status is ${s.status}, expected parked`)

    // b. plan building moves a parked item to building
    await setPlan(p1, 'building')
    s = await readOne(pItem)
    expect(s.status === 'building' && s.waiting_on === null, `after plan building: ${s.status}, ${s.waiting_on}`)

    // c. plan done while another plan is todo puts the item in ready
    const p2 = await addPlan(pItem)
    await setPlan(p1, 'done')
    s = await readOne(pItem)
    expect(s.status === 'ready', `after first plan done with a todo plan: ${s.status}, expected ready`)

    // d. plan done beside a building plan leaves a waiting item alone (waiting on Árni)
    await setPlan(p2, 'building')
    must(await sb.from('hg_items').update({ status: 'waiting', waiting_on: arni.user_id }).eq('id', pItem), 'item to waiting')
    await setPlan(p1, 'todo')
    await setPlan(p1, 'done')
    s = await readOne(pItem)
    expect(
      s.status === 'waiting' && s.waiting_on === arni.user_id,
      `plan done beside a building plan moved the item: ${s.status}, ${s.waiting_on}`,
    )

    // e. last plan done with an open action waits on its owner
    const act7 = must(
      await sb
        .from('hg_actions')
        .insert({ project_id: projectId, item_id: pItem, body: 'verify', owner: heimir.user_id })
        .select('id')
        .single(),
      'insert action 7',
    )
    await setPlan(p2, 'done')
    s = await readOne(pItem)
    expect(s.status === 'waiting' && s.waiting_on === heimir.user_id, `last plan done with open action: ${s.status}, ${s.waiting_on}`)

    // f. with the action done and a question open, waits on the question's recipient
    must(await sb.from('hg_actions').update({ done_at: new Date().toISOString() }).eq('id', act7.id), 'done action 7')
    const q7 = must(
      await sb
        .from('hg_questions')
        .insert({ project_id: projectId, item_id: pItem, body: 'q7', asked_by: me, asked_to: arni.user_id })
        .select('id')
        .single(),
      'ask q7',
    )
    await setPlan(p2, 'todo')
    s = await readOne(pItem)
    expect(s.status === 'waiting' && s.waiting_on === heimir.user_id, `plan back to todo moved the item: ${s.status}, ${s.waiting_on}`)
    await setPlan(p2, 'done')
    s = await readOne(pItem)
    expect(s.status === 'waiting' && s.waiting_on === arni.user_id, `last plan done with open question: ${s.status}, ${s.waiting_on}`)

    // i. a no change plan update moves nothing and writes no event
    const nBefore = (await statusEvents(pItem)).length
    const updBefore = s.updated_at
    await setPlan(p2, 'done')
    const sAfter = await readOne(pItem)
    expect((await statusEvents(pItem)).length === nBefore, 'a no change plan update wrote an item.status event')
    expect(sAfter.updated_at === updBefore, 'a no change plan update touched the item updated_at')

    // g. nothing open: the item is done with closed_at
    must(await sb.from('hg_questions').update({ answer: 'ok' }).eq('id', q7.id), 'answer q7')
    await setPlan(p2, 'todo')
    await setPlan(p2, 'done')
    s = await readOne(pItem)
    expect(s.status === 'done' && s.closed_at !== null, `last plan done with nothing open: ${s.status}, closed_at ${s.closed_at}`)

    // h. a done item is never touched
    await setPlan(p2, 'building')
    s = await readOne(pItem)
    expect(s.status === 'done', `plan building on a done item: ${s.status}, expected done`)

    // j. a plan inserted directly as building moves a new item
    const iItem = await newItem()
    await addPlan(iItem, 'building')
    s = await readOne(iItem)
    expect(s.status === 'building', `plan inserted as building: ${s.status}, expected building`)

    // k. the history carries the moves with the signed in user as actor
    const evs7 = must(
      await sb.from('hg_events').select('kind, actor, data').eq('item_id', pItem).eq('kind', 'item.status').order('created_at'),
      'events 7',
    )
    expect(evs7.length >= 6, `item.status events ${evs7.length}, expected at least 6`)
    expect(evs7.every((e) => e.actor === me), 'an item.status event has another actor than the signed in user')
    expect(evs7[0].data.from === 'parked' && evs7[0].data.to === 'building', `first move is ${JSON.stringify(evs7[0].data)}`)
    passed++
  } finally {
    // runs even on failure so nothing is left behind
    if (itemId) {
      const d = await sb.from('hg_items').delete().eq('id', itemId).select('id')
      if (d.error) console.error(`cleanup failed, leaked hg_items id ${itemId}: ${d.error.message}`)
      else if (!d.data?.length) console.error(`cleanup deleted nothing, leaked hg_items id ${itemId}`)
    }
    for (const id of extraItems) {
      const d = await sb.from('hg_items').delete().eq('id', id).select('id')
      if (d.error) console.error(`cleanup failed, leaked hg_items id ${id}: ${d.error.message}`)
      else if (!d.data?.length) console.error(`cleanup deleted nothing, leaked hg_items id ${id}`)
    }
  }

  scenario = '6 cascade'
  for (const t of ['hg_items', 'hg_questions', 'hg_actions', 'hg_reads', 'hg_events']) {
    const col = t === 'hg_items' ? 'id' : 'item_id'
    const r = must(await sb.from(t).select('*').eq(col, itemId), `check ${t}`)
    expect(r.length === 0, `${t} still has ${r.length} rows`)
  }
  passed++
} catch (e) {
  failure = e
}

if (sb) await sb.auth.signOut()
if (failure) {
  console.log(`FAIL ${scenario}: ${failure.message}`)
  process.exit(1)
}
console.log(`ok ${passed}/${TOTAL}`)
