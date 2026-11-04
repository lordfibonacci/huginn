import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { putFile, setFileNote } from '../cli/lib/ops.mjs'

const TOTAL = 13

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
let viewId = null
let extraItems = []
let smokeObjects = []
let smokeTags = []
let tagViewId = null
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
      must(
        await sb.from('hg_items').select('status, waiting_on, closed_at, updated_at, next_step, next_prompt').eq('id', id).single(),
        'read plan item',
      )
    const setNext = async (id) => must(await sb.from('hg_items').update({ next_step: 'n', next_prompt: 'p' }).eq('id', id), 'set next')
    const hasNext = (row) => row.next_step === 'n' && row.next_prompt === 'p'
    const noNext = (row) => row.next_step === null && row.next_prompt === null
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

    // b. plan building moves a parked item to building and keeps its next step and prompt
    await setNext(pItem)
    await setPlan(p1, 'building')
    s = await readOne(pItem)
    expect(s.status === 'building' && s.waiting_on === null, `after plan building: ${s.status}, ${s.waiting_on}`)
    expect(hasNext(s), `plan building cleared next: ${s.next_step}, ${s.next_prompt}`)

    // c. plan done while another plan is todo puts the item in ready and clears next (0009)
    const p2 = await addPlan(pItem)
    await setPlan(p1, 'done')
    s = await readOne(pItem)
    expect(s.status === 'ready', `after first plan done with a todo plan: ${s.status}, expected ready`)
    expect(noNext(s), `plan done to ready kept next: ${s.next_step}, ${s.next_prompt}`)

    // d. plan done beside a building plan leaves a waiting item alone (waiting on Árni), next too
    await setPlan(p2, 'building')
    must(await sb.from('hg_items').update({ status: 'waiting', waiting_on: arni.user_id }).eq('id', pItem), 'item to waiting')
    await setNext(pItem)
    await setPlan(p1, 'todo')
    await setPlan(p1, 'done')
    s = await readOne(pItem)
    expect(
      s.status === 'waiting' && s.waiting_on === arni.user_id,
      `plan done beside a building plan moved the item: ${s.status}, ${s.waiting_on}`,
    )
    expect(hasNext(s), `plan done beside a building plan cleared next: ${s.next_step}, ${s.next_prompt}`)

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
    expect(noNext(s), `last plan done with open action kept next: ${s.next_step}, ${s.next_prompt}`)

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
    await setNext(pItem)
    await setPlan(p2, 'done')
    s = await readOne(pItem)
    expect(s.status === 'done' && s.closed_at !== null, `last plan done with nothing open: ${s.status}, closed_at ${s.closed_at}`)
    expect(noNext(s), `last plan done with nothing open kept next: ${s.next_step}, ${s.next_prompt}`)

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

    scenario = '8 unread'
    // a: the signed in user's own events are never unread for them, with or without a read mark
    must(await sb.from('hg_reads').delete().eq('item_id', itemId).eq('user_id', me), 'drop read mark')
    const own = must(await sb.rpc('hg_unread', { p_project: projectId }), 'hg_unread')
    expect(!own.some((r) => r.item_id === itemId), `own events reported unread: ${JSON.stringify(own.filter((r) => r.item_id === itemId))}`)
    // b: created_by is stamped from auth.uid() on insert and cannot be rewritten
    const stamped = must(
      await sb
        .from('hg_actions')
        .insert({ project_id: projectId, item_id: itemId, body: 'stamp me', owner: heimir.user_id, created_by: heimir.user_id })
        .select('id, created_by')
        .single(),
      'insert action 8',
    )
    expect(stamped.created_by === me, `created_by is ${stamped.created_by}, expected signed in user`)
    must(await sb.from('hg_actions').update({ created_by: heimir.user_id }).eq('id', stamped.id), 'rewrite created_by')
    const kept = must(await sb.from('hg_actions').select('created_by').eq('id', stamped.id).single(), 'read action 8')
    expect(kept.created_by === me, 'created_by was rewritten on update')
    // c: hg_mark_all_read skips done items (itemId is done since scenario 2), so no mark appears
    must(await sb.rpc('hg_mark_all_read', { p_project: projectId }), 'hg_mark_all_read')
    const none = must(await sb.from('hg_reads').select('read_at').eq('item_id', itemId).eq('user_id', me).maybeSingle(), 'read mark 8 done')
    expect(none === null, 'a done item got a read mark')
    // once reopened the item is open and hg_mark_all_read writes a server stamped read mark
    must(await sb.from('hg_items').update({ status: 'parked' }).eq('id', itemId), 'reopen item 8')
    must(await sb.rpc('hg_mark_all_read', { p_project: projectId }), 'hg_mark_all_read again')
    const mark = must(await sb.from('hg_reads').select('read_at').eq('item_id', itemId).eq('user_id', me).single(), 'read mark 8')
    expect(Date.now() - Date.parse(mark.read_at) < 60_000, `read_at ${mark.read_at} is not fresh`)
    passed++
    scenario = '9 views'
    const posBefore = must(await sb.from('hg_items').select('pos_x, pos_y, updated_at').eq('id', itemId).single(), 'item pos')
    const view = must(
      await sb
        .from('hg_views')
        .insert({ project_id: projectId, name: 'smoke view', filter: { tones: ['gold'], packages: [], tags: [] }, created_by: heimir.user_id })
        .select('id, created_by')
        .single(),
      'insert view',
    )
    viewId = view.id
    expect(view.created_by === me, `view created_by is ${view.created_by}, expected signed in user`)
    must(
      await sb.from('hg_view_positions').upsert({ project_id: projectId, view_id: view.id, item_id: itemId, pos_x: 999, pos_y: 888 }, { onConflict: 'view_id,item_id' }),
      'upsert view position',
    )
    const posAfter = must(await sb.from('hg_items').select('pos_x, pos_y, updated_at').eq('id', itemId).single(), 'item pos after')
    expect(posAfter.pos_x === posBefore.pos_x && posAfter.pos_y === posBefore.pos_y, 'a view position changed the item position')
    expect(posAfter.updated_at === posBefore.updated_at, 'a view position touched the item updated_at')
    // a pack column position in the view (0013) leaves hg_packages alone and goes with the view
    const pack = must(await sb.from('hg_packages').select('id, pos_x, pos_y').eq('project_id', projectId).order('position').limit(1).single(), 'first package')
    must(
      await sb.from('hg_view_pack_positions').upsert({ project_id: projectId, view_id: view.id, package_id: pack.id, pos_x: 777, pos_y: 666 }, { onConflict: 'view_id,package_id' }),
      'upsert view pack position',
    )
    const packAfter = must(await sb.from('hg_packages').select('pos_x, pos_y').eq('id', pack.id).single(), 'package pos after')
    expect(packAfter.pos_x === pack.pos_x && packAfter.pos_y === pack.pos_y, 'a view pack position changed the package position')
    must(await sb.from('hg_views').delete().eq('id', view.id), 'delete view')
    viewId = null
    const left = must(await sb.from('hg_view_positions').select('item_id').eq('view_id', view.id), 'positions after delete')
    expect(left.length === 0, `${left.length} view positions survived the view delete`)
    const packLeft = must(await sb.from('hg_view_pack_positions').select('package_id').eq('view_id', view.id), 'pack positions after delete')
    expect(packLeft.length === 0, `${packLeft.length} view pack positions survived the view delete`)
    passed++
    scenario = '10 action edits'
    // a: a new action has no edit stamp
    const a10 = must(
      await sb.from('hg_actions').insert({ project_id: projectId, item_id: itemId, body: 'first text', owner: heimir.user_id }).select('id, updated_at, updated_by').single(),
      'insert action 10',
    )
    expect(a10.updated_at === null && a10.updated_by === null, 'new action carries an edit stamp')
    // b: changing body stamps updated_at and updated_by and logs action.updated with fields
    must(await sb.from('hg_actions').update({ body: 'second text', owner: arni.user_id }).eq('id', a10.id), 'edit action')
    const e10 = must(await sb.from('hg_actions').select('updated_at, updated_by, done_at').eq('id', a10.id).single(), 'read edited')
    expect(e10.updated_by === me && e10.updated_at !== null && e10.done_at === null, 'edit stamp missing or done_at touched')
    const upd = (await readEvents()).filter((e) => e.kind === 'action.updated')
    expect(upd.length === 1 && JSON.stringify(upd[0].data.fields) === JSON.stringify(['body', 'owner']), `action.updated events ${JSON.stringify(upd)}`)
    // c: marking done after an edit works and logs action.done, not action.updated
    must(await sb.from('hg_actions').update({ done_at: new Date().toISOString() }).eq('id', a10.id).is('done_at', null), 'done after edit')
    const afterDone = await readEvents()
    expect(afterDone.filter((e) => e.kind === 'action.updated').length === 1, 'done_at change logged action.updated')
    expect(afterDone.filter((e) => e.kind === 'action.done').length >= 3, 'action.done missing after edit')
    // d: cancelling an open action sets done_at, cancelled, reason and logs action.cancelled
    const c10 = must(
      await sb.from('hg_actions').insert({ project_id: projectId, item_id: itemId, body: 'to cancel', owner: heimir.user_id }).select('id').single(),
      'insert cancel target',
    )
    must(
      await sb.from('hg_actions').update({ done_at: new Date().toISOString(), cancelled: true, cancel_reason: 'planið breyttist' }).eq('id', c10.id).is('done_at', null),
      'cancel action',
    )
    const cRow = must(await sb.from('hg_actions').select('done_at, done_by, cancelled, cancel_reason').eq('id', c10.id).single(), 'read cancelled')
    expect(cRow.done_at && cRow.done_by === me && cRow.cancelled === true && cRow.cancel_reason === 'planið breyttist', `cancel row ${JSON.stringify(cRow)}`)
    const canc = (await readEvents()).filter((e) => e.kind === 'action.cancelled')
    expect(canc.length === 1 && canc[0].data.reason === 'planið breyttist', `action.cancelled events ${JSON.stringify(canc)}`)
    // e: cancelled cannot be flipped back by an update that keeps done_at
    must(await sb.from('hg_actions').update({ cancelled: false, cancel_reason: null }).eq('id', c10.id), 'flip cancelled')
    const kept10 = must(await sb.from('hg_actions').select('cancelled, cancel_reason').eq('id', c10.id).single(), 'read flipped')
    expect(kept10.cancelled === true && kept10.cancel_reason === 'planið breyttist', 'cancelled was flipped on a closed action')
    // f: a plan going done with only a cancelled action left closes the item (cancelled is closed)
    const fItem = must(
      await sb.from('hg_items').insert({ project_id: projectId, title: 'smoke 10 f', status: 'waiting', waiting_on: heimir.user_id, created_by: me }).select('id').single(),
      'insert item f',
    )
    extraItems.push(fItem.id)
    const fAct = must(await sb.from('hg_actions').insert({ project_id: projectId, item_id: fItem.id, body: 'gone', owner: heimir.user_id }).select('id').single(), 'insert action f')
    must(await sb.from('hg_actions').update({ done_at: new Date().toISOString(), cancelled: true }).eq('id', fAct.id), 'cancel action f')
    const fPlan = must(await sb.from('hg_plans').insert({ project_id: projectId, item_id: fItem.id, name: 'p', status: 'building' }).select('id').single(), 'insert plan f')
    must(await sb.from('hg_plans').update({ status: 'done' }).eq('id', fPlan.id), 'plan f done')
    const fRow = must(await sb.from('hg_items').select('status, closed_at').eq('id', fItem.id).single(), 'read item f')
    expect(fRow.status === 'done' && fRow.closed_at !== null, `item f is ${fRow.status}, expected done`)
    passed++
    scenario = '11 file replace'
    const put = (bytes, repoPath, id = itemId) =>
      putFile(sb, { projectId, itemId: id, userId: me, name: 'plan.md', bytes: Buffer.from(bytes), mime: 'text/markdown', repoPath })
    // a: first add, path normalised by the caller (the CLI), stored as given
    const a11 = await put('v1', 'docs/plan.md')
    smokeObjects.push(a11.file.storage_path)
    expect(a11.outcome === 'added' && a11.file.updated_at === null && a11.file.updated_by === null, `first add ${JSON.stringify(a11)}`)
    // b: other bytes replace in place: same id, new object, stamp, old object gone
    const b11 = await put('v2', 'docs/plan.md')
    smokeObjects.push(b11.file.storage_path)
    expect(b11.outcome === 'replaced' && b11.file.id === a11.file.id && b11.file.storage_path !== a11.file.storage_path, `replace ${JSON.stringify(b11)}`)
    expect(b11.file.updated_by === me && b11.file.updated_at !== null, 'replace stamp missing')
    const gone = await sb.storage.from('hg-files').download(a11.file.storage_path)
    expect(gone.error !== null, 'old object still in storage')
    // c: same bytes again write nothing
    const c11 = await put('v2', 'docs/plan.md')
    expect(c11.outcome === 'unchanged' && c11.file.storage_path === b11.file.storage_path, `unchanged ${JSON.stringify(c11)}`)
    // d: same size, other bytes: the compare reads bytes, not size
    const d11 = await put('v3', 'docs/plan.md')
    smokeObjects.push(d11.file.storage_path)
    expect(d11.outcome === 'replaced' && d11.file.storage_path !== b11.file.storage_path, 'same size other bytes was not replaced')
    expect((await sb.storage.from('hg-files').download(b11.file.storage_path)).error !== null, 'replaced object still in storage')
    // e: old object already gone by hand: the row is still updated
    must(await sb.storage.from('hg-files').remove([d11.file.storage_path]), 'remove by hand')
    const e11 = await put('v4', 'docs/plan.md')
    smokeObjects.push(e11.file.storage_path)
    expect(e11.outcome === 'replaced' && e11.file.id === a11.file.id, 'replace after a missing old object failed')
    // f: events: one file.added and three file.updated, all with this file_id
    const fe = (await readEvents()).filter((e) => e.data?.file_id === a11.file.id)
    expect(fe.filter((e) => e.kind === 'file.added').length === 1 && fe.filter((e) => e.kind === 'file.updated').length === 3, `file events ${JSON.stringify(countKinds(fe))}`)
    expect(fe.every((e) => e.data.name === 'plan.md'), 'file event without name')
    // g: a second row at the same path is refused by the index
    const dup = await sb.from('hg_files').insert({ project_id: projectId, item_id: itemId, name: 'plan.md', storage_path: `${projectId}/${itemId}/dup_plan.md`, size: 2, repo_path: 'docs/plan.md', uploaded_by: me })
    expect(dup.error?.code === '23505', `duplicate insert gave ${JSON.stringify(dup.error)}`)
    // h: the same path on another item is its own file, and files without a path still pile up
    const hItem = must(await sb.from('hg_items').insert({ project_id: projectId, title: 'smoke 11 h', status: 'parked', created_by: me }).select('id').single(), 'insert item h')
    extraItems.push(hItem.id)
    const h11 = await put('v1', 'docs/plan.md', hItem.id)
    smokeObjects.push(h11.file.storage_path)
    expect(h11.outcome === 'added' && h11.file.id !== a11.file.id, 'same path on another item was treated as the same file')
    const n1 = await put('x', null)
    smokeObjects.push(n1.file.storage_path)
    const n2 = await put('x', null)
    smokeObjects.push(n2.file.storage_path)
    expect(n1.outcome === 'added' && n2.outcome === 'added' && n1.file.id !== n2.file.id, 'files without a path were merged')
    passed++
    scenario = '12 file note'
    const putN = (bytes, note) =>
      putFile(sb, { projectId, itemId, userId: me, name: 'note.md', bytes: Buffer.from(bytes), mime: 'text/markdown', repoPath: 'docs/note.md', note })
    // a: add with a note
    const a12 = await putN('v1', 'Fyrsta lýsing')
    smokeObjects.push(a12.file.storage_path)
    expect(a12.outcome === 'added' && a12.file.note === 'Fyrsta lýsing', `add with note ${JSON.stringify(a12)}`)
    // b: replace without --note keeps it
    const b12 = await putN('v2', undefined)
    smokeObjects.push(b12.file.storage_path)
    expect(b12.outcome === 'replaced' && b12.file.note === 'Fyrsta lýsing', 'replace lost the note')
    // b2: replace with another note writes it
    const r12 = await putN('v3', 'Ný lýsing')
    smokeObjects.push(r12.file.storage_path)
    expect(r12.outcome === 'replaced' && r12.file.note === 'Ný lýsing' && r12.noteUpdated === true, `replace with note ${JSON.stringify(r12)}`)
    expect(r12.file.updated_at !== b12.file.updated_at, 'replace with a note did not move the stamp')
    // c: unchanged bytes with a new note write the note and nothing else
    const c12 = await putN('v3', 'Önnur lýsing')
    expect(c12.outcome === 'unchanged' && c12.noteUpdated === true && c12.file.note === 'Önnur lýsing', `unchanged note ${JSON.stringify(c12)}`)
    expect(c12.file.updated_at === r12.file.updated_at && c12.file.storage_path === r12.file.storage_path, 'a note write moved the stamp or the object')
    // d: setFileNote writes, no event, no stamp
    const ev12Before = (await readEvents()).filter((e) => e.data?.file_id === a12.file.id).length
    const d12 = await setFileNote(sb, a12.file.id, 'Þriðja lýsing')
    expect(d12.note === 'Þriðja lýsing' && d12.updated_at === r12.file.updated_at && d12.storage_path === r12.file.storage_path, 'setFileNote changed more than the note')
    const ev12After = (await readEvents()).filter((e) => e.data?.file_id === a12.file.id).length
    expect(ev12After === ev12Before, `a note write logged ${ev12After - ev12Before} events`)
    passed++
    scenario = '13 tags and keywords'
    const addTag13 = async (name) => {
      const row = must(await sb.from('hg_tags').insert({ project_id: projectId, name, created_by: me }).select('id, name').single(), `insert tag ${name}`)
      smokeTags.push(row.id)
      return row
    }
    const ta = await addTag13('smoke tag')
    const tb = await addTag13('smoke tag b')
    // a: canonical spelling and dedupe on write
    must(await sb.from('hg_items').update({ tags: ['Smoke Tag', 'SMOKE TAG', 'smoke tag b'] }).eq('id', itemId), 'set tags')
    let row13 = must(await sb.from('hg_items').select('tags, updated_at').eq('id', itemId).single(), 'read tags')
    expect(JSON.stringify(row13.tags) === JSON.stringify(['smoke tag', 'smoke tag b']), `tags after write ${JSON.stringify(row13.tags)}`)
    // b: a tag off the list is refused with 22023
    const bad13 = await sb.from('hg_items').update({ tags: ['smoke tag', 'ekki til'] }).eq('id', itemId)
    expect(bad13.error?.code === '22023' && /ekki til/.test(bad13.error.message), `off list tag gave ${JSON.stringify(bad13.error)}`)
    // c: rename moves no stamp and logs nothing
    const ev13Before = (await readEvents()).length
    const stamp13 = row13.updated_at
    must(await sb.rpc('hg_tag_rename', { p_tag: ta.id, p_name: 'smoke tag renamed' }), 'rename')
    row13 = must(await sb.from('hg_items').select('tags, updated_at').eq('id', itemId).single(), 'read after rename')
    expect(row13.tags[0] === 'smoke tag renamed' && row13.updated_at === stamp13, `rename ${JSON.stringify(row13)}`)
    expect((await readEvents()).length === ev13Before, 'rename logged an event')
    // d: a view with this tag alone blocks delete
    const view13 = must(
      await sb.from('hg_views').insert({ project_id: projectId, name: 'smoke tag view', filter: { tones: [], packages: [], tags: ['smoke tag renamed'] }, created_by: me }).select('id').single(),
      'insert tag view',
    )
    tagViewId = view13.id
    const blocked13 = await sb.rpc('hg_tag_delete', { p_tag: ta.id })
    expect(blocked13.error?.code === '22023' && /smoke tag view/.test(blocked13.error.message), `delete with a view gave ${JSON.stringify(blocked13.error)}`)
    // e: merge rewrites the item and the view, drops the from row
    must(await sb.rpc('hg_tag_merge', { p_from: ta.id, p_into: tb.id }), 'merge')
    smokeTags = smokeTags.filter((id) => id !== ta.id)
    row13 = must(await sb.from('hg_items').select('tags, updated_at').eq('id', itemId).single(), 'read after merge')
    expect(JSON.stringify(row13.tags) === JSON.stringify(['smoke tag b']) && row13.updated_at === stamp13, `merge ${JSON.stringify(row13)}`)
    const view13After = must(await sb.from('hg_views').select('filter').eq('id', view13.id).single(), 'view after merge')
    expect(JSON.stringify(view13After.filter.tags) === JSON.stringify(['smoke tag b']), `view after merge ${JSON.stringify(view13After.filter)}`)
    const gone13 = must(await sb.from('hg_tags').select('id').eq('id', ta.id), 'from row')
    expect(gone13.length === 0, 'merge kept the from row')
    // f: delete once the view has another tag
    must(await sb.from('hg_views').update({ filter: { tones: [], packages: [], tags: ['smoke tag b', 'smokes'] } }).eq('id', view13.id), 'widen view')
    must(await sb.rpc('hg_tag_delete', { p_tag: tb.id }), 'delete')
    smokeTags = []
    row13 = must(await sb.from('hg_items').select('tags, updated_at').eq('id', itemId).single(), 'read after delete')
    expect(row13.tags.length === 0 && row13.updated_at === stamp13, `delete ${JSON.stringify(row13)}`)
    // g: review focus 2, a rename that collides ignoring case is refused
    const tc = await addTag13('smoke tag c')
    const td = await addTag13('smoke tag d')
    const dup13 = await sb.rpc('hg_tag_rename', { p_tag: tc.id, p_name: 'SMOKE TAG D' })
    expect(dup13.error?.code === '23505', `case collision gave ${JSON.stringify(dup13.error)}`)
    void td
    // h: review focus 3, keywords move no stamp and log nothing
    must(await sb.from('hg_items').update({ keywords: ['social media', 'efni'] }).eq('id', itemId), 'set keywords')
    row13 = must(await sb.from('hg_items').select('keywords, updated_at').eq('id', itemId).single(), 'read keywords')
    expect(row13.keywords.length === 2 && row13.updated_at === stamp13, `keywords ${JSON.stringify(row13)}`)
    expect((await readEvents()).length === ev13Before, 'keywords logged an event')
    passed++
  } finally {
    // runs even on failure so nothing is left behind
    if (smokeTags.length) {
      const d = await sb.from('hg_tags').delete().in('id', smokeTags).select('id')
      if (d.error) console.error(`cleanup failed, leaked hg_tags ids ${smokeTags.join(', ')}: ${d.error.message}`)
      else {
        const left = smokeTags.filter((id) => !d.data?.some((r) => r.id === id))
        if (left.length) console.error(`cleanup deleted nothing for hg_tags ids ${left.join(', ')}, leaked`)
      }
    }
    if (tagViewId) {
      const d = await sb.from('hg_views').delete().eq('id', tagViewId).select('id')
      if (d.error) console.error(`cleanup failed, leaked hg_views id ${tagViewId}: ${d.error.message}`)
      else if (!d.data?.length) console.error(`cleanup deleted nothing, leaked hg_views id ${tagViewId}`)
    }
    if (viewId) {
      const d = await sb.from('hg_views').delete().eq('id', viewId).select('id')
      if (d.error) console.error(`cleanup failed, leaked hg_views id ${viewId}: ${d.error.message}`)
      else if (!d.data?.length) console.error(`cleanup deleted nothing, leaked hg_views id ${viewId}`)
    }
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
    if (smokeObjects.length) {
      const r = await sb.storage.from('hg-files').remove(smokeObjects)
      if (r.error) console.error(`cleanup failed, leaked hg-files objects ${smokeObjects.join(', ')}: ${r.error.message}`)
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
