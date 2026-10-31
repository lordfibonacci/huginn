import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = {}
for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/)) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const i = t.indexOf('=')
  if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
}

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

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
let projectId = null
let failure = null

try {
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
    const qs = must(
      await sb
        .from('hg_questions')
        .insert(
          ['q1', 'q2'].map((b) => ({
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
    must(await answer(qs[0].id), 'answer q1')
    let it = must(await sb.from('hg_items').select('status, waiting_on').eq('id', itemId).single(), 'read item')
    expect(it.waiting_on === null, `waiting_on after first answer is ${it.waiting_on}, expected null`)
    must(await answer(qs[1].id), 'answer q2')
    it = must(await sb.from('hg_items').select('status, waiting_on').eq('id', itemId).single(), 'read item')
    expect(it.status === 'waiting', `status is ${it.status}, expected waiting`)
    expect(it.waiting_on === claude.user_id, 'waiting_on is not the service user')
    const evs = must(await sb.from('hg_events').select('kind').eq('item_id', itemId), 'events')
    const counts = {}
    for (const e of evs) counts[e.kind] = (counts[e.kind] ?? 0) + 1
    const want = { 'item.created': 1, 'question.asked': 2, 'question.answered': 2, 'item.status': 1 }
    for (const [k, n] of Object.entries(want))
      expect(counts[k] === n, `event ${k} count ${counts[k] ?? 0}, expected ${n}`)
    passed++

    scenario = '2 actions'
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
    passed++

    scenario = '3 reads'
    for (let n = 0; n < 2; n++)
      must(
        await sb
          .from('hg_reads')
          .upsert(
            { project_id: projectId, item_id: itemId, user_id: me, read_at: new Date().toISOString() },
            { onConflict: 'item_id,user_id' },
          ),
        `upsert read ${n + 1}`,
      )
    passed++
  } finally {
    // runs even on failure so nothing is left behind
    if (itemId) {
      const d = await sb.from('hg_items').delete().eq('id', itemId)
      if (d.error) console.error(`cleanup failed: ${d.error.message}`)
    }
  }

  scenario = '4 cascade'
  for (const t of ['hg_items', 'hg_questions', 'hg_actions', 'hg_reads', 'hg_events']) {
    const col = t === 'hg_items' ? 'id' : 'item_id'
    const r = must(await sb.from(t).select('*').eq(col, itemId), `check ${t}`)
    expect(r.length === 0, `${t} still has ${r.length} rows`)
  }
  passed++
} catch (e) {
  failure = e
}

await sb.auth.signOut()
if (failure) {
  console.log(`FAIL ${scenario}: ${failure.message}`)
  process.exit(1)
}
console.log(`ok ${passed}/4`)
