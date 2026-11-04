import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { getClient, getProject, getUser, loadBoard } from './client.mjs'
import { resolveProject } from './config.mjs'
import { oneLine, shortId } from './format.mjs'
import {
  addAction,
  addComment,
  addPlan,
  addRuling,
  addTag,
  answerQuestion,
  askQuestion,
  cancelAction,
  createItem,
  downloadFile,
  findById,
  listModules,
  listParticipants,
  markActionDone,
  openWork,
  pushBundle,
  putFile,
  setFileNote,
  setPlanStatus,
  updateAction,
  updateItem,
  uploadFile,
} from './ops.mjs'
import { PLAN_NAMES, STATUS_NAMES } from './status.mjs'
import {
  CREATE_STATUSES,
  PLAN_STATUSES,
  guardClose,
  mimeFor,
  normalizeNote,
  normalizeRepoPath,
  normalizeTag,
  parseCommand,
  parseKeywords,
  parseTags,
  placeItem,
  resolveModule,
  resolveShort,
  statusPatch,
  validateUpload,
} from './write.mjs'

// The write commands. Each returns { json, text }: json is { ok, id } (plus a
// few extras), text is one Icelandic line. huginn.mjs prints one of them.

async function context(flags) {
  const { slug } = resolveProject(process.cwd(), flags.project !== undefined ? ['--project', flags.project] : [])
  const client = await getClient()
  const user = await getUser(client)
  const project = await getProject(client, slug)
  return { client, user, project }
}

// A value flag that must have a non blank value.
function need(flags, name) {
  const value = flags[name]
  if (value === undefined || String(value).trim() === '') throw new Error(`--${name} vantar.`)
  return value
}

// '' from the command line clears a text field.
function textOrNull(value) {
  return String(value).trim() === '' ? null : value
}

function readText(path) {
  try {
    return readFileSync(resolve(process.cwd(), path), 'utf8')
  } catch {
    throw new Error(`Gat ekki lesið ${path}.`)
  }
}

// A local file for upload, checked against the web's rules before anything is written.
function readLocal(path) {
  const full = resolve(process.cwd(), path)
  let stat
  try {
    stat = statSync(full)
  } catch {
    throw new Error(`Skráin ${path} fannst ekki.`)
  }
  if (!stat.isFile()) throw new Error(`${path} er ekki skrá.`)
  const name = basename(full)
  const check = validateUpload({ name, size: stat.size })
  if (!check.ok) throw new Error(`${name}: ${check.reason}`)
  return { name, bytes: readFileSync(full), mime: mimeFor(name) }
}

function checkStatus(status, allowed, what) {
  if (status !== undefined && !allowed.includes(status)) {
    throw new Error(`${what} getur verið: ${allowed.join(', ')}.`)
  }
}

async function guardedUpdate(client, item, patch, force) {
  if (patch.status === 'done' || patch.status === 'dropped') {
    const work = await openWork(client, item.id)
    const guard = guardClose(item, work.questions, work.actions, force)
    if (!guard.ok) throw new Error(guard.reason)
  }
  return updateItem(client, item.id, patch)
}

// The 0016b trigger refuses a tag off the list; say where the list is.
async function withTagHint(fn) {
  try {
    return await fn()
  } catch (error) {
    if (/taggalista verkefnisins/.test(error.message)) {
      error.message += ' huginn tag list sýnir hann, huginn tag add bætir við.'
    }
    throw error
  }
}

function itemText(verb, item) {
  return `${verb} #${shortId(item.id)}: ${oneLine(item.title)}, ${STATUS_NAMES[item.status] ?? oneLine(item.status)}`
}

const WRITE = {
  item: {
    create: {
      usage:
        'item create --title T [--body-file f.md] [--module slug] [--tags a,b] [--keywords a,b] [--file path ...] [--status new|waiting|ready|building|parked] [--waiting-on short]',
      args: 0,
      spec: {
        title: 'value',
        'body-file': 'value',
        module: 'value',
        tags: 'value',
        keywords: 'value',
        file: 'multi',
        status: 'value',
        'waiting-on': 'value',
      },
      async run(flags) {
        const title = need(flags, 'title').trim()
        checkStatus(flags.status, CREATE_STATUSES, 'Staða nýs verks')
        const body = flags['body-file'] !== undefined ? readText(flags['body-file']) : null
        const files = (flags.file ?? []).map(readLocal)
        const tags = flags.tags !== undefined ? parseTags(flags.tags) : []

        const { client, user, project } = await context(flags)
        const board = await loadBoard(client, project.id)
        const moduleId = flags.module !== undefined ? resolveModule(board.modules, flags.module) : null
        const waitingOn =
          flags['waiting-on'] !== undefined ? resolveShort(board.participants, flags['waiting-on']) : undefined
        const sp = statusPatch(flags.status, waitingOn)
        const pos = placeItem(board, moduleId, { title, tags, fileCount: files.length })

        const item = await withTagHint(() =>
          createItem(client, {
            projectId: project.id,
            userId: user.id,
            title,
            body,
            moduleId,
            tags,
            keywords: parseKeywords(flags.keywords),
            status: sp.status ?? 'new',
            waitingOn: sp.waiting_on ?? null,
            pos,
          }),
        )
        const uploaded = []
        for (const f of files) {
          try {
            uploaded.push(await uploadFile(client, { projectId: project.id, itemId: item.id, userId: user.id, ...f }))
          } catch (error) {
            throw new Error(`Verkið #${shortId(item.id)} var stofnað en skrá fór ekki upp. ${error.message}`)
          }
        }
        const fileNote = uploaded.length ? `, ${uploaded.length} skrá(r)` : ''
        return {
          json: { ok: true, id: item.id, ...(uploaded.length ? { files: uploaded.map((f) => f.id) } : {}) },
          text: `${itemText('Verk stofnað', item)}${fileNote}`,
        }
      },
    },

    set: {
      usage:
        'item set <id> [--status ..] [--waiting-on short|none] [--summary ".."] [--body-file f.md] [--module slug|none] [--tags a,b] [--keywords a,b] [--next-step ".."] [--next-prompt-file f.txt] [--source-ref ".."] [--force]',
      args: 1,
      spec: {
        status: 'value',
        'waiting-on': 'value',
        summary: 'value',
        'body-file': 'value',
        module: 'value',
        tags: 'value',
        keywords: 'value',
        'next-step': 'value',
        'next-prompt-file': 'value',
        'source-ref': 'value',
        force: 'bool',
      },
      async run(flags, [id]) {
        const body = flags['body-file'] !== undefined ? readText(flags['body-file']) : undefined
        const nextPrompt = flags['next-prompt-file'] !== undefined ? readText(flags['next-prompt-file']) : undefined
        const { client, project } = await context(flags)
        const item = await findById(client, 'item', project.id, id)

        const waitingOn =
          flags['waiting-on'] !== undefined
            ? resolveShort(await listParticipants(client, project.id), flags['waiting-on'])
            : undefined
        const patch = { ...statusPatch(flags.status, waitingOn) }
        if (flags.summary !== undefined) patch.summary = textOrNull(flags.summary)
        if (body !== undefined) patch.body = textOrNull(body)
        if (flags.module !== undefined) patch.module_id = resolveModule(await listModules(client, project.id), flags.module)
        if (flags.tags !== undefined) patch.tags = parseTags(flags.tags)
        if (flags.keywords !== undefined) patch.keywords = parseKeywords(flags.keywords)
        if (flags['next-step'] !== undefined) patch.next_step = textOrNull(flags['next-step'])
        if (nextPrompt !== undefined) patch.next_prompt = textOrNull(nextPrompt)
        if (flags['source-ref'] !== undefined) patch.source_ref = textOrNull(flags['source-ref'])
        if (Object.keys(patch).length === 0) throw new Error('Ekkert að breyta. Sjá huginn --help.')

        const updated = await withTagHint(() => guardedUpdate(client, item, patch, flags.force === true))
        return { json: { ok: true, id: updated.id }, text: itemText('Verk uppfært', updated) }
      },
    },

    close: {
      usage: 'item close <id> [--dropped] [--force]',
      args: 1,
      spec: { dropped: 'bool', force: 'bool' },
      async run(flags, [id]) {
        const { client, project } = await context(flags)
        const item = await findById(client, 'item', project.id, id)
        const patch = statusPatch(flags.dropped ? 'dropped' : 'done', undefined)
        const updated = await guardedUpdate(client, item, patch, flags.force === true)
        return { json: { ok: true, id: updated.id }, text: itemText('Verki lokað', updated) }
      },
    },
  },

  question: {
    ask: {
      usage: 'question ask <item> --to short|none --body ".."',
      args: 1,
      spec: { to: 'value', body: 'value' },
      async run(flags, [itemId]) {
        const to = need(flags, 'to')
        const body = need(flags, 'body')
        const { client, user, project } = await context(flags)
        const item = await findById(client, 'item', project.id, itemId)
        const askedTo = resolveShort(await listParticipants(client, project.id), to)
        const q = await askQuestion(client, { projectId: project.id, itemId: item.id, userId: user.id, askedTo, body })
        return { json: { ok: true, id: q.id }, text: `Spurning skráð #${shortId(q.id)} á verk #${shortId(item.id)}.` }
      },
    },

    answer: {
      usage: 'question answer <qid> --body ".."',
      args: 1,
      spec: { body: 'value' },
      async run(flags, [qid]) {
        const body = need(flags, 'body')
        const { client, project } = await context(flags)
        const q = await findById(client, 'question', project.id, qid)
        const answered = await answerQuestion(client, q.id, body)
        return {
          json: { ok: true, id: answered.id },
          text: `Svar skráð við spurningu #${shortId(answered.id)} á verk #${shortId(answered.item_id)}.`,
        }
      },
    },
  },

  action: {
    add: {
      usage: 'action add <item> --owner short --body ".." [--payload-file f.sql]',
      args: 1,
      spec: { owner: 'value', body: 'value', 'payload-file': 'value' },
      async run(flags, [itemId]) {
        const ownerShort = need(flags, 'owner')
        const body = need(flags, 'body')
        const payload = flags['payload-file'] !== undefined ? readText(flags['payload-file']) : null
        const { client, project } = await context(flags)
        const item = await findById(client, 'item', project.id, itemId)
        const owner = resolveShort(await listParticipants(client, project.id), ownerShort)
        if (!owner) throw new Error('Handtak þarf eiganda, --owner none gengur ekki.')
        const a = await addAction(client, { projectId: project.id, itemId: item.id, owner, body, payload })
        return { json: { ok: true, id: a.id }, text: `Handtak skráð #${shortId(a.id)} á verk #${shortId(item.id)}.` }
      },
    },

    done: {
      usage: 'action done <aid>',
      args: 1,
      spec: {},
      async run(flags, [aid]) {
        const { client, project } = await context(flags)
        const a = await findById(client, 'action', project.id, aid)
        const done = await markActionDone(client, a.id)
        return { json: { ok: true, id: done.id }, text: `Handtak #${shortId(done.id)} merkt lokið.` }
      },
    },

    set: {
      usage: 'action set <aid> [--body ".."] [--owner short] [--payload-file f.sql]',
      args: 1,
      spec: { body: 'value', owner: 'value', 'payload-file': 'value' },
      async run(flags, [aid]) {
        if (flags.body === undefined && flags.owner === undefined && flags['payload-file'] === undefined) {
          throw new Error('Gefðu --body, --owner eða --payload-file.')
        }
        const patch = {}
        if (flags.body !== undefined) patch.body = need(flags, 'body')
        if (flags['payload-file'] !== undefined) patch.payload = readText(flags['payload-file'])
        const { client, project } = await context(flags)
        const a = await findById(client, 'action', project.id, aid)
        if (flags.owner !== undefined) {
          const owner = resolveShort(await listParticipants(client, project.id), flags.owner)
          if (!owner) throw new Error('Handtak þarf eiganda, --owner none gengur ekki.')
          patch.owner = owner
        }
        const updated = await updateAction(client, a.id, patch)
        return { json: { ok: true, id: updated.id }, text: `Handtak #${shortId(updated.id)} breytt.` }
      },
    },

    cancel: {
      usage: 'action cancel <aid> [--reason ".."]',
      args: 1,
      spec: { reason: 'value' },
      async run(flags, [aid]) {
        const reason = flags.reason !== undefined ? textOrNull(flags.reason) : null
        const { client, project } = await context(flags)
        const a = await findById(client, 'action', project.id, aid)
        const cancelled = await cancelAction(client, a.id, reason)
        return { json: { ok: true, id: cancelled.id }, text: `Handtak #${shortId(cancelled.id)} fellt niður.` }
      },
    },
  },

  plan: {
    add: {
      usage: 'plan add <item> --name "Plan A" [--path docs/..] [--status todo|building|done]',
      args: 1,
      spec: { name: 'value', path: 'value', status: 'value' },
      async run(flags, [itemId]) {
        const name = need(flags, 'name')
        checkStatus(flags.status, PLAN_STATUSES, 'Staða plans')
        const { client, project } = await context(flags)
        const item = await findById(client, 'item', project.id, itemId)
        const plan = await addPlan(client, {
          projectId: project.id,
          itemId: item.id,
          name,
          path: flags.path !== undefined ? textOrNull(flags.path) : null,
          status: flags.status,
        })
        return { json: { ok: true, id: plan.id }, text: `Plan skráð #${shortId(plan.id)} á verk #${shortId(item.id)}.` }
      },
    },

    set: {
      usage: 'plan set <pid> --status todo|building|done',
      args: 1,
      spec: { status: 'value' },
      async run(flags, [pid]) {
        const status = need(flags, 'status')
        checkStatus(status, PLAN_STATUSES, 'Staða plans')
        const { client, project } = await context(flags)
        const plan = await findById(client, 'plan', project.id, pid)
        const updated = await setPlanStatus(client, plan.id, status)
        return {
          json: { ok: true, id: updated.id },
          text: `Plan #${shortId(updated.id)}: ${oneLine(updated.name)}, ${PLAN_NAMES[updated.status]}.`,
        }
      },
    },
  },

  ruling: {
    add: {
      usage: 'ruling add <plan> --code R1 --body ".." [--cost ".."]',
      args: 1,
      spec: { code: 'value', body: 'value', cost: 'value' },
      async run(flags, [planId]) {
        const code = need(flags, 'code')
        const body = need(flags, 'body')
        const { client, project } = await context(flags)
        const plan = await findById(client, 'plan', project.id, planId)
        const r = await addRuling(client, {
          projectId: project.id,
          planId: plan.id,
          code,
          body,
          cost: flags.cost !== undefined ? textOrNull(flags.cost) : null,
        })
        return { json: { ok: true, id: r.id }, text: `Úrskurður ${oneLine(code)} skráður #${shortId(r.id)} á plan #${shortId(plan.id)}.` }
      },
    },
  },

  file: {
    add: {
      usage: 'file add <item> <path> [--repo-path docs/..] [--note ".."]',
      args: 2,
      spec: { 'repo-path': 'value', note: 'value' },
      async run(flags, [itemId, path]) {
        const local = readLocal(path)
        const repoPath = flags['repo-path'] !== undefined ? normalizeRepoPath(flags['repo-path']) : null
        // No --note leaves a replaced file's note as it is; a blank --note is refused.
        const n = flags.note !== undefined ? normalizeNote(flags.note) : { ok: true, note: undefined }
        if (!n.ok) throw new Error(n.reason)
        if (n.note === null) throw new Error('--note vantar.')
        const { client, user, project } = await context(flags)
        const item = await findById(client, 'item', project.id, itemId)
        const { file: f, outcome, noteUpdated } = await putFile(client, {
          projectId: project.id,
          itemId: item.id,
          userId: user.id,
          repoPath,
          note: n.note,
          ...local,
        })
        const at = `#${shortId(f.id)} á verk #${shortId(item.id)}`
        const text =
          outcome === 'replaced'
            ? `Skjal ${oneLine(f.name)} uppfært ${at}${noteUpdated ? ', lýsing uppfærð' : ''}.`
            : outcome === 'unchanged'
              ? `Skjal ${oneLine(f.name)} óbreytt ${at}, ${noteUpdated ? 'lýsing uppfærð' : 'ekkert skrifað'}.`
              : `Skrá ${oneLine(f.name)} hlaðið upp ${at}.`
        return {
          json: { ok: true, id: f.id, outcome, replaced: outcome === 'replaced', unchanged: outcome === 'unchanged', noteUpdated },
          text,
        }
      },
    },

    set: {
      usage: 'file set <fileid> --note ".."',
      args: 1,
      spec: { note: 'value' },
      async run(flags, [fileId]) {
        const n = normalizeNote(need(flags, 'note'))
        if (!n.ok) throw new Error(n.reason)
        if (n.note === null) throw new Error('--note vantar.')
        const { client, project } = await context(flags)
        const f = await findById(client, 'file', project.id, fileId)
        await setFileNote(client, f.id, n.note)
        return { json: { ok: true, id: f.id }, text: `Lýsing skjals #${shortId(f.id)} uppfærð.` }
      },
    },

    get: {
      usage: 'file get <fileid> --out <path> [--force]',
      args: 1,
      spec: { out: 'value', force: 'bool' },
      async run(flags, [fileId]) {
        const out = resolve(process.cwd(), need(flags, 'out'))
        const { client, project } = await context(flags)
        const f = await findById(client, 'file', project.id, fileId)
        const bytes = await downloadFile(client, f.storage_path)
        mkdirSync(dirname(out), { recursive: true })
        try {
          // wx fails when the file exists, so nothing is overwritten by a race either.
          writeFileSync(out, bytes, { flag: flags.force ? 'w' : 'wx' })
        } catch (error) {
          if (error.code === 'EEXIST') throw new Error(`${out} er þegar til. Notaðu --force til að skrifa yfir.`)
          throw new Error(`Gat ekki skrifað ${out}: ${error.message}`)
        }
        return { json: { ok: true, id: f.id, path: out }, text: `Skráin ${oneLine(f.name)} vistuð í ${out}.` }
      },
    },
  },

  comment: {
    add: {
      usage: 'comment add <item> --body ".."',
      args: 1,
      spec: { body: 'value' },
      async run(flags, [itemId]) {
        const body = need(flags, 'body')
        const { client, user, project } = await context(flags)
        const item = await findById(client, 'item', project.id, itemId)
        const c = await addComment(client, { projectId: project.id, itemId: item.id, userId: user.id, body })
        return { json: { ok: true, id: c.id }, text: `Athugasemd skráð #${shortId(c.id)} á verk #${shortId(item.id)}.` }
      },
    },
  },

  tag: {
    list: {
      usage: 'tag list',
      args: 0,
      spec: {},
      async run(flags) {
        const { client, project } = await context(flags)
        const board = await loadBoard(client, project.id)
        const rows = board.tags
          .map((tg) => ({ id: tg.id, name: tg.name, count: board.items.filter((i) => (i.tags ?? []).includes(tg.name)).length }))
          .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'is'))
        return {
          json: rows,
          text: rows.length ? rows.map((r) => `${oneLine(r.name)} (${r.count})`).join('\n') : 'Engin tögg á listanum.',
        }
      },
    },
    add: {
      usage: 'tag add <name>',
      args: 1,
      spec: {},
      async run(flags, [raw]) {
        const check = normalizeTag(raw)
        if (!check.ok) throw new Error(check.reason)
        const { client, user, project } = await context(flags)
        const tag = await addTag(client, { projectId: project.id, userId: user.id, name: check.name })
        return { json: { ok: true, id: tag.id }, text: `Tagg bætt við: ${oneLine(tag.name)}` }
      },
    },
  },

  bundle: {
    push: {
      usage: 'bundle push --file bundle.md',
      args: 0,
      spec: { file: 'value' },
      async run(flags) {
        const text = readText(need(flags, 'file'))
        if (!text.trim()) throw new Error('Samhengisskráin er tóm.')
        const { client, project } = await context(flags)
        const saved = await pushBundle(client, project.id, text)
        return { json: { ok: true, id: saved.id }, text: `Samhengi verkefnisins ${oneLine(project.slug)} vistað.` }
      },
    },
  },
}

export const WRITE_GROUPS = Object.keys(WRITE)

export function writeUsage() {
  return Object.values(WRITE)
    .flatMap((subs) => Object.values(subs).map((s) => `  ${s.usage}`))
    .join('\n')
}

// argv is the whole command line; argv's first two words are group and sub.
export async function runWrite(group, sub, argv) {
  const command = WRITE[group]?.[sub]
  if (!command) {
    const subs = Object.keys(WRITE[group] ?? {}).join(', ')
    throw new Error(`Óþekkt skipun: ${group} ${sub ?? ''}. Í boði: ${subs}.`)
  }
  const { positional, flags } = parseCommand(argv, command.spec, `${group} ${sub}`)
  const args = positional.slice(2)
  if (positional[0] !== group || positional[1] !== sub || args.length !== command.args) {
    throw new Error(`Notkun: huginn ${command.usage}`)
  }
  const result = await command.run(flags, args)
  return { result, flags }
}
