import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  BAD_STORAGE_PATH,
  MIRROR_MAX_BYTES,
  itemSlug,
  itemsToMirror,
  mirrorTargets,
  planMirror,
  pointerJson,
  renderItemMd,
  safeFileName,
  storagePathOk,
} from './mirror.mjs'
import { executeMirror, listFolders, readExisting, resolveInside, syncReport } from './sync.mjs'
import { storageSafeName } from './write.mjs'

const NOW = Date.parse('2026-10-31T12:00:00Z')
const MB = 1024 * 1024

const C = { id: 'p-c', user_id: 'u-c', short: 'C', display_name: 'Claude', is_service: true, project_id: 'pr' }
const H = { id: 'p-h', user_id: 'u-h', short: 'H', display_name: 'Heimir', is_service: false, project_id: 'pr' }
const A = { id: 'p-a', user_id: 'u-a', short: 'Á', display_name: 'Árni', is_service: false, project_id: 'pr' }
const participants = [H, A, C]

function item(id, extra = {}) {
  return {
    id,
    created_at: '2026-10-01T09:00:00+00:00',
    project_id: 'pr',
    module_id: null,
    title: `Verk ${id}`,
    summary: null,
    body: null,
    status: 'new',
    waiting_on: null,
    tags: [],
    pos_x: 0,
    pos_y: 0,
    source_ref: null,
    next_step: null,
    next_prompt: null,
    created_by: 'u-h',
    updated_by: null,
    updated_at: '2026-10-30T10:00:00+00:00',
    closed_at: null,
    ...extra,
  }
}

// A stable uuid per file id, so fixture paths look like real uploads.
function uuidFor(id) {
  const h = createHash('md5').update(String(id)).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`
}

function sp(itemId, id, name, project = 'pr') {
  return `${project}/${itemId}/${uuidFor(id)}_${storageSafeName(name)}`
}

function file(id, itemId, name, size, extra = {}) {
  return {
    id,
    created_at: '2026-10-02T09:00:00+00:00',
    project_id: 'pr',
    item_id: itemId,
    name,
    storage_path: sp(itemId, id, name),
    size,
    mime: null,
    repo_path: null,
    uploaded_by: 'u-a',
    ...extra,
  }
}

function board(items, extra = {}) {
  return {
    project: { id: 'pr', slug: 'metta', name: 'Metta' },
    participants,
    packages: [],
    modules: [],
    items,
    plans: [],
    files: [],
    questions: [],
    actions: [],
    rulings: [],
    comments: [],
    events: [],
    reads: [],
    ...extra,
  }
}

function sha(text) {
  return createHash('sha256').update(text).digest('hex')
}

// A full item with every kind of row, for renderItemMd and the fs tests.
const ITEM_ID = 'a1b2c3d4-0000-4000-8000-000000000001'
const PLAN_ID = 'b1000000-0000-4000-8000-000000000001'
function fullBoard() {
  const it = item(ITEM_ID, {
    title: 'Efnaskrá A og B: endurhönnun',
    summary: 'Árni sendi drög.\nClaude greindi.',
    body: 'Lína eitt\r\nLína tvö\u001b[31m rauð\u0007',
    status: 'waiting',
    waiting_on: 'u-h',
    module_id: 'm-1',
    tags: ['efnaskra', 'honnun'],
    source_ref: 'WhatsApp 2026-10-29',
    next_step: 'Heimir velur útgáfu.',
    next_prompt: 'Lestu docs/huginn og ```haltu áfram```',
  })
  return board([it], {
    modules: [{ id: 'm-1', slug: 'efnaskra', name: 'Efnaskrá', project_id: 'pr' }],
    plans: [
      { id: 'b2000000-0000-4000-8000-000000000002', item_id: ITEM_ID, name: 'Plan B', path: null, status: 'todo', position: 1 },
      { id: PLAN_ID, item_id: ITEM_ID, name: 'Plan A', path: 'docs/plan-a.md', status: 'building', position: 0 },
    ],
    rulings: [
      { id: 'r2', plan_id: PLAN_ID, code: 'R2', body: 'Seinni', cost: null, reversed: true, created_at: '2026-10-05T00:00:00Z' },
      { id: 'r1', plan_id: PLAN_ID, code: 'R1', body: 'Engin ný tafla', cost: 'Lítill', reversed: false, created_at: '2026-10-04T00:00:00Z' },
    ],
    actions: [
      { id: 'c2000000-done', item_id: ITEM_ID, body: 'Keyra SQL', owner: 'u-h', payload: 'select 1;', done_at: '2026-10-06T00:00:00Z', done_by: 'u-h', created_at: '2026-10-03T00:00:00Z' },
      { id: 'c1000000-open', item_id: ITEM_ID, body: 'Samþykkja', owner: 'u-h', payload: null, done_at: null, done_by: null, created_at: '2026-10-04T00:00:00Z' },
    ],
    questions: [
      { id: 'd2000000-q', item_id: ITEM_ID, body: 'Hvaða litur?', asked_by: 'u-c', asked_to: 'u-a', answer: 'Blár', answered_by: 'u-a', answered_at: '2026-10-07T00:00:00Z', created_at: '2026-10-06T00:00:00Z' },
      { id: 'd1000000-q', item_id: ITEM_ID, body: 'Hvaða leturgerð?', asked_by: 'u-c', asked_to: 'u-h', answer: null, answered_by: null, answered_at: null, created_at: '2026-10-08T00:00:00Z' },
    ],
    files: [
      file('f1000000-0001', ITEM_ID, 'drog.md', 120),
      file('f2000000-0002', ITEM_ID, 'upptaka.mp4', 12 * MB, { mime: 'video/mp4' }),
      file('f3000000-0003', ITEM_ID, 'skyrsla.pdf', 5000, { repo_path: 'docs/skyrsla.pdf' }),
    ],
    comments: [
      { id: 'k1000000-0001', item_id: ITEM_ID, module_id: null, body: 'Drögin eru komin.\n\nSjá skrána.', user_id: 'u-a', created_at: '2026-10-09T10:00:00Z', project_id: 'pr' },
      { id: 'k2000000-0002', item_id: ITEM_ID, module_id: null, body: 'Takk, les í dag.', user_id: 'u-h', created_at: '2026-10-09T11:00:00Z', project_id: 'pr' },
    ],
  })
}

function renderFull(data) {
  const it = data.items[0]
  const targets = mirrorTargets(data, NOW)
  const t = targets.find((x) => x.source === 'item.md')
  return { md: t.content, it, data }
}

describe('itemSlug', () => {
  it('maps Icelandic letters and ends with the id prefix', () => {
    const slug = itemSlug({ id: 'abcdef123456', title: 'Efnaskrá A og B: endurhönnun' })
    expect(slug.startsWith('efnaskra-a-og-b-endurhonnun-')).toBe(true)
    expect(slug).toBe('efnaskra-a-og-b-endurhonnun-abcdef')
  })

  it('maps þ, æ, ð, ö, ý, é, ú, í and capitals', () => {
    expect(itemSlug({ id: '123456789', title: 'ÞÆÐÖ Ýé úí' })).toBe('thaedo-ye-ui-123456')
  })

  it('collapses and trims dashes, other characters become dashes', () => {
    expect(itemSlug({ id: 'aaaaaa', title: '  --Hæ!! (v2) ü  ' })).toBe('hae-v2-aaaaaa')
  })

  it('caps the base at 60 characters before the suffix', () => {
    const slug = itemSlug({ id: '0123456789', title: 'a'.repeat(59) + ' bbbbbbb' })
    const base = slug.slice(0, -'-012345'.length)
    expect(base.length).toBeLessThanOrEqual(60)
    expect(base.endsWith('-')).toBe(false)
    expect(slug.endsWith('-012345')).toBe(true)
  })

  it('is only the id prefix when the title has no usable characters', () => {
    expect(itemSlug({ id: 'ABCDEF99', title: '!!!' })).toBe('abcdef')
  })
})

describe('safeFileName', () => {
  it('never keeps a path separator or a parent reference', () => {
    for (const bad of ['../../x', 'a/b', 'a\\b', '..', '.', '/etc/passwd', 'C:\\x']) {
      const safe = safeFileName(bad)
      expect(safe).not.toMatch(/[\\/]/)
      expect(safe).not.toBe('..')
      expect(safe).not.toBe('.')
      expect(safe.startsWith('.')).toBe(false)
    }
    expect(safeFileName('a/b')).toBe('a_b')
  })

  it('replaces Windows reserved characters and strips control characters', () => {
    expect(safeFileName('a<b>c:d"e|f?g*h.txt')).toBe('a_b_c_d_e_f_g_h.txt')
    expect(safeFileName('x\u0000y\u001b\u009bz.md')).toBe('xyz.md')
  })

  it('guards Windows device names, trailing dots and leading dots', () => {
    expect(safeFileName('con.txt')).toBe('_con.txt')
    expect(safeFileName('NUL')).toBe('_NUL')
    expect(safeFileName('lpt1.log')).toBe('_lpt1.log')
    expect(safeFileName('console.txt')).toBe('console.txt')
    expect(safeFileName('skra. . ')).toBe('skra')
    expect(safeFileName('.gitignore')).toBe('_gitignore')
  })

  it('keeps Icelandic letters and gives a name for empty input', () => {
    expect(safeFileName('Efnaskrá þróun.pdf')).toBe('Efnaskrá þróun.pdf')
    expect(safeFileName('')).toBe('skra')
    expect(safeFileName('///')).toBe('___')
  })

  it('caps long names and keeps the extension', () => {
    const safe = safeFileName('x'.repeat(300) + '.pdf')
    expect(safe.length).toBeLessThanOrEqual(100)
    expect(safe.endsWith('.pdf')).toBe(true)
  })
})

describe('itemsToMirror', () => {
  it('keeps board items and done items closed in the last 30 days, never dropped', () => {
    const items = [
      item('open', { status: 'building' }),
      item('done-new', { status: 'done', closed_at: '2026-10-20T00:00:00Z' }),
      item('done-old', { status: 'done', closed_at: '2026-09-30T11:59:59Z' }),
      item('dropped', { status: 'dropped', closed_at: '2026-10-30T00:00:00Z' }),
    ]
    expect(itemsToMirror(board(items), NOW).map((i) => i.id)).toEqual(['open', 'done-new'])
  })
})

describe('planMirror', () => {
  it('writes item.md, the small file, a pointer for a 12 MB mp4 and STATUS.md on an empty folder', () => {
    const plan = planMirror(fullBoard(), new Map(), { now: NOW })
    const slug = 'efnaskra-a-og-b-endurhonnun-a1b2c3'
    expect(plan.map((e) => [e.path, e.action])).toEqual([
      [`${slug}/item.md`, 'write'],
      [`${slug}/drog.md`, 'write'],
      [`${slug}/upptaka.mp4.pointer.json`, 'pointer'],
      ['STATUS.md', 'write'],
    ])
    expect(plan[2].source.id).toBe('f2000000-0002')
    // repo_path files are not copied.
    expect(plan.some((e) => e.path.includes('skyrsla'))).toBe(false)
  })

  it('skips rendered files with the same sha, Storage files with the same size and pointers with the same storage_path', () => {
    const data = fullBoard()
    const first = planMirror(data, new Map(), { now: NOW })
    const existing = new Map()
    for (const e of first) {
      if (e.content !== undefined) existing.set(e.path, { size: Buffer.byteLength(e.content), sha256: sha(e.content) })
      else if (e.action === 'pointer') existing.set(e.path, { size: 10, pointerStoragePath: e.source.storage_path })
      else existing.set(e.path, { size: e.source.size })
    }
    const second = planMirror(data, existing, { now: NOW })
    expect(second.map((e) => e.action)).toEqual(['skip', 'skip', 'skip', 'skip'])
  })

  it('rewrites a rendered file whose sha differs and a Storage file whose size differs', () => {
    const data = fullBoard()
    const slug = 'efnaskra-a-og-b-endurhonnun-a1b2c3'
    const existing = new Map([
      [`${slug}/item.md`, { size: 5, sha256: sha('old') }],
      [`${slug}/drog.md`, { size: 119 }],
      [`${slug}/upptaka.mp4.pointer.json`, { size: 10, pointerStoragePath: 'pr/other' }],
    ])
    const plan = planMirror(data, existing, { now: NOW })
    expect(plan.slice(0, 3).map((e) => e.action)).toEqual(['write', 'write', 'pointer'])
  })

  it('uses size only: exactly 10 MB gets a pointer, one byte less is written whatever the type', () => {
    const it = item('i1')
    const data = board([it], {
      files: [file('f-a', 'i1', 'a.zip', MIRROR_MAX_BYTES - 1), file('f-b', 'i1', 'b.txt', MIRROR_MAX_BYTES)],
    })
    const plan = planMirror(data, new Map(), { now: NOW })
    expect(plan.map((e) => [e.path.split('/').pop(), e.action])).toEqual([
      ['item.md', 'write'],
      ['a.zip', 'write'],
      ['b.txt.pointer.json', 'pointer'],
      ['STATUS.md', 'write'],
    ])
  })

  it('gives the later file of a name collision the id suffix, also case insensitively and against item.md', () => {
    const it = item('i1')
    const data = board([it], {
      files: [
        file('bbbbbb-2', 'i1', 'Mynd.png', 10, { created_at: '2026-10-03T00:00:00Z' }),
        file('aaaaaa-1', 'i1', 'mynd.png', 10, { created_at: '2026-10-02T00:00:00Z' }),
        file('cccccc-3', 'i1', 'item.md', 10),
        file('dddddd-4', 'i1', 'a/b', 10),
        file('eeeeee-5', 'i1', 'a_b', 10, { created_at: '2026-10-09T00:00:00Z' }),
      ],
    })
    const names = planMirror(data, new Map(), { now: NOW }).map((e) => e.path)
    expect(names).toEqual([
      'verk-i1-i1/item.md',
      'verk-i1-i1/mynd.png',
      'verk-i1-i1/item-cccccc.md',
      'verk-i1-i1/a_b',
      'verk-i1-i1/Mynd-bbbbbb.png',
      'verk-i1-i1/a_b-eeeeee',
      'STATUS.md',
    ])
  })

  it('keeps every path inside the out folder for hostile names and titles', () => {
    const it = item('../../evil', { title: '../../../etc' })
    const data = board([it], {
      files: [file('f1', '../../evil', '../../x', 10), file('f2', '../../evil', '..', 10), file('f3', '../../evil', 'aux', 10)],
    })
    for (const e of planMirror(data, new Map(), { now: NOW })) {
      expect(e.path).toMatch(/^(STATUS\.md|[a-z0-9-]+\/[^/\\]+)$/)
      expect(e.path.split('/')).not.toContain('..')
    }
  })

  it('accepts only the exact upload shape after the project and item prefix', () => {
    const P = 'd4c3b2a1-1111-4222-8333-444455556666'
    const I = 'a1b2c3d4-0000-4000-8000-000000000001'
    const U = '0f1e2d3c-4b5a-4968-8778-695a4b3c2d1e'
    const ok = (tail) => storagePathOk({ storage_path: `${P}/${I}/${tail}` }, P, I)
    expect(ok(`${U}_Efnaskra_throun_v2.pdf`)).toBe(true)
    expect(ok(`${U}_${storageSafeName('Efnaskrá þróun (lokaútgáfa).pdf')}`)).toBe(true)
    for (const tail of [
      '%2e%2e',
      `${U}_%2e%2e`,
      `${U}_a%2fb`,
      `${U}_x?y`,
      `${U}_x#y`,
      `${U}_a/${U}_b`,
      `${U}/${U}_b`,
      `${U}_a\\b`,
      `${U}_`,
      `${U}_a b`,
      `${U}_á.pdf`,
      `${U}_x\n`,
      'x.pdf',
      '..',
      '',
      `../${U}_x`,
      `${U.slice(0, -1)}_x`,
    ]) {
      expect(ok(tail), tail).toBe(false)
    }
    // The prefix must be this project and this item.
    expect(storagePathOk({ storage_path: `${P}/${U}/${U}_x` }, P, I)).toBe(false)
    expect(storagePathOk({ storage_path: `${U}/${I}/${U}_x` }, P, I)).toBe(false)
  })

  it('never downloads a file whose storage_path is outside the project and item folder', () => {
    const it = item('i1')
    const data = board([it], {
      files: [
        file('f1', 'i1', 'annad.pdf', 10, { storage_path: 'other-project/i1/f1_annad.pdf' }),
        file('f2', 'i1', 'annad-verk.pdf', 10, { storage_path: 'pr/other-item/f2_x.pdf' }),
        file('f3', 'i1', 'upp.pdf', 10, { storage_path: 'pr/i1/../../other-project/x/f3.pdf' }),
        file('f4', 'i1', 'gott.pdf', 10),
        file('f5', 'i1', 'stort.mp4', 12 * MB, { storage_path: 'pr2/i1/f5.mp4' }),
      ],
    })
    expect(storagePathOk({ storage_path: sp('i1', 'x', 'x.pdf') }, 'pr', 'i1')).toBe(true)
    expect(storagePathOk({ storage_path: sp('i10', 'x', 'x.pdf') }, 'pr', 'i1')).toBe(false)
    const plan = planMirror(data, new Map(), { now: NOW })
    expect(plan.map((e) => [e.path.split('/').pop(), e.action])).toEqual([
      ['item.md', 'write'],
      ['annad.pdf', 'fail'],
      ['annad-verk.pdf', 'fail'],
      ['upp.pdf', 'fail'],
      ['gott.pdf', 'write'],
      ['stort.mp4', 'fail'],
      ['STATUS.md', 'write'],
    ])
    expect(plan[1].reason).toBe(BAD_STORAGE_PATH)
    expect(plan[0].content).toContain('- annad.pdf, 10 bæti: ekki sótt, Storage slóðin er utan verksins')
  })

  it('reuses a local folder with the same id suffix after a title change, the slug folder winning, else lexical first', () => {
    const it = item('abcdef99', { title: 'Nýr titill' })
    const data = board([it])
    const paths = (folders) => planMirror(data, new Map(), { now: NOW, folders }).map((e) => e.path)
    expect(paths([])).toEqual(['nyr-titill-abcdef/item.md', 'STATUS.md'])
    expect(paths(['gamall-titill-abcdef'])).toEqual(['gamall-titill-abcdef/item.md', 'STATUS.md'])
    expect(paths(['b-abcdef', 'a-abcdef'])).toEqual(['a-abcdef/item.md', 'STATUS.md'])
    expect(paths(['a-abcdef', 'nyr-titill-abcdef'])).toEqual(['nyr-titill-abcdef/item.md', 'STATUS.md'])
    expect(paths(['abcdef9', 'x-abcdeg'])).toEqual(['nyr-titill-abcdef/item.md', 'STATUS.md'])
  })

  it('renders a last item.md without files for an item that left the mirror set but has a folder', () => {
    const it = item('i1', { status: 'dropped', closed_at: '2026-10-30T00:00:00Z' })
    const old = item('i2', { status: 'done', closed_at: '2026-08-01T00:00:00Z' })
    const data = board([it, old], { files: [file('f1', 'i1', 'mynd.png', 10)] })
    const none = planMirror(data, new Map(), { now: NOW, folders: [] })
    expect(none.map((e) => e.path)).toEqual(['STATUS.md'])
    const plan = planMirror(data, new Map(), { now: NOW, folders: ['verk-i1-i1', 'verk-i2-i2'] })
    expect(plan.map((e) => [e.path, e.action])).toEqual([
      ['verk-i1-i1/item.md', 'write'],
      ['verk-i2-i2/item.md', 'write'],
      ['STATUS.md', 'write'],
    ])
    expect(plan[0].content).toContain('- Staða: Hætt við')
    expect(plan[1].content).toContain('- Staða: Lokið')
  })

  it('mirrors no dropped item and lists STATUS.md last with statusMarkdown content', () => {
    const data = board([item('x', { status: 'dropped', closed_at: '2026-10-30T00:00:00Z' })])
    const plan = planMirror(data, new Map(), { now: NOW })
    expect(plan.map((e) => e.path)).toEqual(['STATUS.md'])
    expect(plan[0].content).toBe('# Staða: Metta\n\nEkkert opið verk.\n')
  })
})

describe('renderItemMd', () => {
  it('renders the chat in time order after the questions and before the files', () => {
    const data = fullBoard()
    data.comments = [
      { id: 'k2', item_id: ITEM_ID, module_id: null, body: 'Já, taktu hann með.', user_id: 'u-h', created_at: '2026-10-31T11:42:00Z', project_id: 'pr' },
      { id: 'k1', item_id: ITEM_ID, module_id: null, body: 'Fyrsta brief\r\nkemur á morgun', user_id: 'u-a', created_at: '2026-10-31T11:20:00Z', project_id: 'pr' },
      { id: 'k3', item_id: 'other', module_id: null, body: 'annað verk', user_id: 'u-a', created_at: '2026-10-31T12:00:00Z', project_id: 'pr' },
    ]
    const { md } = renderFull(data)
    const chat = md.indexOf('## Spjall')
    expect(chat).toBeGreaterThan(md.indexOf('## Spurningar'))
    expect(chat).toBeLessThan(md.indexOf('## Skrár'))
    expect(md).toContain('- 2026-10-31T11:20:00.000Z Árni (Á): Fyrsta brief\n  kemur á morgun\n- 2026-10-31T11:42:00.000Z Heimir (H): Já, taktu hann með.')
    expect(md).not.toContain('annað verk')
  })
  it('has no Spjall section without comments', () => {
    const data = fullBoard()
    data.comments = []
    expect(renderFull(data).md).not.toContain('## Spjall')
  })
  it('writes an empty line, not two spaces, for a blank line inside a message', () => {
    const { md } = renderFull(fullBoard())
    expect(md).toContain('- 2026-10-09T10:00:00.000Z Árni (Á): Drögin eru komin.\n\n  Sjá skrána.\n- 2026-10-09T11:00:00.000Z Heimir (H): Takk, les í dag.')
    expect(md).not.toMatch(/^ +$/m)
  })
  it('a replaced file carries its update stamp, an untouched one is unchanged', () => {
    const data = fullBoard()
    data.files.push(file('f4000000-0004', ITEM_ID, 'plan.md', 300, { repo_path: 'docs/plan.md', updated_at: '2026-11-03T07:55:28.517Z' }))
    const { md } = renderFull(data)
    expect(md).toContain('í repoinu, docs/plan.md (uppfært 2026-11-03T07:55:28.517Z)')
    expect(md).toContain('í repoinu, docs/skyrsla.pdf\n')
    expect(md).not.toMatch(/docs\/skyrsla\.pdf \(uppfært/)
  })

  it('gives the same output twice and for shuffled input rows', () => {
    const data = fullBoard()
    const a = renderFull(data).md
    const b = renderFull(fullBoard()).md
    const shuffled = fullBoard()
    for (const key of ['plans', 'rulings', 'actions', 'questions', 'files', 'comments']) shuffled[key].reverse()
    expect(a).toBe(b)
    expect(renderFull(shuffled).md).toBe(a)
  })

  it('is called with the brief signature and returns the same text as the mirror', () => {
    const data = fullBoard()
    const it = data.items[0]
    const direct = renderItemMd(it, data.plans, data.actions, data.questions, data.rulings, participants, {
      module: data.modules[0],
      files: mirrorTargets(data, NOW).find((t) => t.source === 'item.md').files,
      comments: data.comments,
    })
    expect(direct).toBe(renderFull(data).md)
  })

  it('renders every part with ISO dates, LF endings and no control characters', () => {
    const md = renderFull(fullBoard()).md
    expect(md.endsWith('\n')).toBe(true)
    expect(md).not.toMatch(/\r/)
    expect(md).not.toMatch(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/)
    for (const part of [
      '# Efnaskrá A og B: endurhönnun',
      'Staða: Bíður',
      'Bíður eftir: Heimir (H)',
      'Módúll: Efnaskrá (efnaskra)',
      'Merki: efnaskra, honnun',
      'Stofnað: 2026-10-01T09:00:00.000Z',
      '## Hvar erum við',
      'Árni sendi drög.\nClaude greindi.',
      'Lína eitt\nLína tvö[31m rauð',
      '## Næsta skref',
      'Heimir velur útgáfu.',
      'Uppruni: WhatsApp 2026-10-29',
      '- R1 (kostnaður: Lítill): Engin ný tafla',
      '- R2 (snúið við): Seinni',
      'Spurning #d1000000, ósvöruð',
      'Svar frá Árni (Á), 2026-10-07T00:00:00.000Z:',
      'Blár',
      'drog.md, 120 bæti: afrit í möppunni, drog.md',
      'upptaka.mp4, 12582912 bæti: í Storage, bendiskrá upptaka.mp4.pointer.json',
      'skyrsla.pdf, 5000 bæti: í repoinu, docs/skyrsla.pdf',
    ]) {
      expect(md).toContain(part)
    }
    // Plans by position, open actions before done ones, questions by time.
    expect(md.indexOf('### Plan A')).toBeLessThan(md.indexOf('### Plan B'))
    expect(md.indexOf('#c1000000, opið')).toBeLessThan(md.indexOf('#c2000000, lokið'))
    expect(md.indexOf('#d2000000')).toBeLessThan(md.indexOf('#d1000000'))
  })

  it('shows a cancelled action with who and why, and an edited action after Stofnað', () => {
    const data = fullBoard()
    data.actions.push(
      { id: 'c3000000-gone', item_id: ITEM_ID, body: 'Hætt við', owner: 'u-h', payload: null, done_at: '2026-10-09T00:00:00Z', done_by: 'u-c', cancelled: true, cancel_reason: 'planið\nbreyttist', created_at: '2026-10-05T00:00:00Z' },
      { id: 'c4000000-nore', item_id: ITEM_ID, body: 'Án ástæðu', owner: 'u-h', payload: null, done_at: '2026-10-09T00:00:00Z', done_by: 'u-c', cancelled: true, cancel_reason: null, created_at: '2026-10-05T01:00:00Z' },
    )
    data.actions[1].updated_at = '2026-10-08T00:00:00Z'
    data.actions[1].updated_by = 'u-c'
    const md = renderFull(data).md
    expect(md).toContain('### Handtak #c3000000, fellt niður')
    expect(md).toContain('- Fellt niður: 2026-10-09T00:00:00.000Z, af Claude (C), ástæða: planið breyttist')
    expect(md).not.toContain('- Lokið: 2026-10-09')
    expect(md).toContain('### Handtak #c4000000, fellt niður')
    expect(md).toContain('- Fellt niður: 2026-10-09T00:00:00.000Z, af Claude (C)\n')
    expect(md).toContain('### Handtak #c1000000, opið\n\n- Eigandi: Heimir (H)\n- Stofnað: 2026-10-04T00:00:00.000Z\n- Breytt: 2026-10-08T00:00:00.000Z, af Claude (C)\n')
    expect(md).toContain('- Lokið: 2026-10-06T00:00:00.000Z, af Heimir (H)')
  })

  it('fences the next prompt and payloads with a fence longer than any backtick run inside', () => {
    const md = renderFull(fullBoard()).md
    expect(md).toContain('````text\nLestu docs/huginn og ```haltu áfram```\n````')
    expect(md).toContain('```text\nselect 1;\n```')
  })

  it('cannot be broken by a title with newlines', () => {
    const data = board([item('i1', { title: 'Titill\n# Falskur kafli' })])
    const md = mirrorTargets(data, NOW).find((t) => t.source === 'item.md').content
    expect(md.split('\n')[0]).toBe('# Titill # Falskur kafli')
  })
})

describe('pointerJson', () => {
  it('has the fixed keys in a fixed order and ends with a newline', () => {
    const f = file('f2', 'i1', 'upptaka.mp4', 12 * MB, { mime: 'video/mp4' })
    const text = pointerJson(f, 'ab'.repeat(32))
    expect(text.endsWith('}\n')).toBe(true)
    expect(Object.keys(JSON.parse(text))).toEqual(['name', 'size', 'mime', 'storage_path', 'sha256'])
    expect(pointerJson(f, 'ab'.repeat(32))).toBe(text)
  })
})

describe('sync on disk', () => {
  let out
  const BYTES = {
    [sp(ITEM_ID, 'f1000000-0001', 'drog.md')]: Buffer.from('x'.repeat(120)),
    [sp(ITEM_ID, 'f2000000-0002', 'upptaka.mp4')]: Buffer.from('big video'),
  }
  let downloads
  const download = async (path) => {
    downloads.push(path)
    if (!BYTES[path]) throw new Error(`no ${path}`)
    return BYTES[path]
  }

  beforeEach(() => {
    out = mkdtempSync(join(tmpdir(), 'huginn-sync-'))
    downloads = []
  })
  afterEach(() => {
    rmSync(out, { recursive: true, force: true })
  })

  async function run(data, fetch = download) {
    const folders = listFolders(out)
    const targets = mirrorTargets(data, NOW, folders)
    const existing = readExisting(out, targets)
    const plan = planMirror(data, existing, { now: NOW, folders })
    return executeMirror(out, plan, { download: fetch })
  }

  it('writes everything once, then a second run writes and downloads nothing', async () => {
    const data = fullBoard()
    const slug = 'efnaskra-a-og-b-endurhonnun-a1b2c3'
    const first = await run(data)
    expect(first.written).toEqual([`${slug}/item.md`, `${slug}/drog.md`, 'STATUS.md'])
    expect(first.pointers).toEqual([`${slug}/upptaka.mp4.pointer.json`])
    expect(first.skipped).toEqual([])
    expect(downloads.length).toBe(2)

    const pointer = JSON.parse(readFileSync(join(out, slug, 'upptaka.mp4.pointer.json'), 'utf8'))
    expect(pointer).toEqual({
      name: 'upptaka.mp4',
      size: 12 * MB,
      mime: 'video/mp4',
      storage_path: sp(ITEM_ID, 'f2000000-0002', 'upptaka.mp4'),
      sha256: sha(Buffer.from('big video')),
    })
    expect(readFileSync(join(out, 'STATUS.md'), 'utf8')).toContain('# Staða: Metta')
    expect(readdirSync(join(out, slug)).sort()).toEqual(['drog.md', 'item.md', 'upptaka.mp4.pointer.json'])

    downloads = []
    const second = await run(data)
    expect(second.written).toEqual([])
    expect(second.pointers).toEqual([])
    expect(second.skipped.length).toBe(4)
    expect(downloads).toEqual([])
  })

  it('dry run writes nothing and downloads nothing', async () => {
    const data = fullBoard()
    const targets = mirrorTargets(data, NOW)
    const plan = planMirror(data, readExisting(out, targets), { now: NOW })
    const result = await executeMirror(out, plan, { download, dryRun: true })
    expect(result.written.length).toBe(3)
    expect(result.pointers.length).toBe(1)
    expect(readdirSync(out)).toEqual([])
    expect(downloads).toEqual([])
  })

  it('never deletes local files and leaves no temp files', async () => {
    mkdirSync(join(out, 'gamalt-verk-123456'), { recursive: true })
    writeFileSync(join(out, 'gamalt-verk-123456', 'item.md'), 'gamalt\n')
    await run(fullBoard())
    expect(existsSync(join(out, 'gamalt-verk-123456', 'item.md'))).toBe(true)
    const all = readdirSync(out, { recursive: true })
    expect(all.some((p) => String(p).includes('huginn-tmp'))).toBe(false)
  })

  it('rewrites a changed item.md with LF endings and a final newline', async () => {
    const data = fullBoard()
    await run(data)
    data.items[0].summary = 'Ný staða'
    const again = await run(data)
    // The summary is not part of STATUS.md, so only item.md changes.
    expect(again.written).toEqual(['efnaskra-a-og-b-endurhonnun-a1b2c3/item.md'])
    const text = readFileSync(join(out, 'efnaskra-a-og-b-endurhonnun-a1b2c3', 'item.md'), 'utf8')
    expect(text).toContain('Ný staða')
    expect(text.endsWith('\n')).toBe(true)
    expect(text.includes('\r')).toBe(false)
  })

  it('keeps going when one download fails, writes later files and STATUS.md, and reports exit code 1', async () => {
    const data = fullBoard()
    data.files.push(file('f4000000-0004', ITEM_ID, 'seinni.txt', 5, { created_at: '2026-10-09T00:00:00Z' }))
    const later = sp(ITEM_ID, 'f4000000-0004', 'seinni.txt')
    const flaky = async (path) => {
      downloads.push(path)
      if (path.endsWith('_drog.md')) throw new Error('HTTP 500')
      if (path === later) return Buffer.from('hallo')
      return download(path)
    }
    const slug = 'efnaskra-a-og-b-endurhonnun-a1b2c3'
    const result = await run(data, flaky)
    expect(result.failed).toEqual([{ path: slug + '/drog.md', reason: 'HTTP 500' }])
    expect(result.written).toEqual([slug + '/item.md', slug + '/seinni.txt', 'STATUS.md'])
    expect(result.pointers).toEqual([slug + '/upptaka.mp4.pointer.json'])
    expect(existsSync(join(out, 'STATUS.md'))).toBe(true)
    expect(existsSync(join(out, slug, 'drog.md'))).toBe(false)
    const report = syncReport(out, result, false)
    expect(report.exitCode).toBe(1)
    expect(report.json.ok).toBe(false)
    expect(report.json.failed).toEqual(result.failed)
    expect(report.text).toContain('Mistókst: 1\n  ' + slug + '/drog.md: HTTP 500')
    expect(syncReport(out, await run(data), false).exitCode).toBe(0)
  })

  it('lists a storage_path outside the item as failed and never downloads it', async () => {
    const data = fullBoard()
    data.files[0].storage_path = 'other-project/x/f1_drog.md'
    const result = await run(data)
    expect(result.failed).toEqual([{ path: 'efnaskra-a-og-b-endurhonnun-a1b2c3/drog.md', reason: BAD_STORAGE_PATH }])
    expect(downloads).not.toContain('other-project/x/f1_drog.md')
    expect(result.written).toContain('STATUS.md')
  })

  it('writes into the old folder after a title change and makes no new one', async () => {
    const data = fullBoard()
    await run(data)
    data.items[0].title = 'Alveg nýr titill'
    downloads = []
    const again = await run(data)
    expect(again.written).toEqual(['efnaskra-a-og-b-endurhonnun-a1b2c3/item.md', 'STATUS.md'])
    expect(readdirSync(out).sort()).toEqual(['STATUS.md', 'efnaskra-a-og-b-endurhonnun-a1b2c3'])
    expect(readFileSync(join(out, 'efnaskra-a-og-b-endurhonnun-a1b2c3', 'item.md'), 'utf8')).toContain('# Alveg nýr titill')
    expect(downloads).toEqual([])
  })

  it('rewrites item.md of a dropped item that has a folder, without downloads, and leaves its files', async () => {
    const data = fullBoard()
    const slug = 'efnaskra-a-og-b-endurhonnun-a1b2c3'
    await run(data)
    data.items[0].status = 'dropped'
    data.items[0].closed_at = '2026-10-31T11:00:00Z'
    downloads = []
    const again = await run(data)
    expect(again.written).toEqual([slug + '/item.md', 'STATUS.md'])
    expect(downloads).toEqual([])
    expect(readFileSync(join(out, slug, 'item.md'), 'utf8')).toContain('- Staða: Hætt við')
    expect(readdirSync(join(out, slug)).sort()).toEqual(['drog.md', 'item.md', 'upptaka.mp4.pointer.json'])
  })

  it('gives a dropped item without a folder nothing', async () => {
    const data = fullBoard()
    data.items[0].status = 'dropped'
    data.items[0].closed_at = '2026-10-31T11:00:00Z'
    const result = await run(data)
    expect(result.written).toEqual(['STATUS.md'])
    expect(readdirSync(out)).toEqual(['STATUS.md'])
  })

  it('writes a pointer with a warning when the downloaded bytes are 10 MB or more, then skips it', async () => {
    const data = fullBoard()
    const slug = 'efnaskra-a-og-b-endurhonnun-a1b2c3'
    const big = Buffer.alloc(MIRROR_MAX_BYTES, 1)
    const liar = async (path) => {
      downloads.push(path)
      return path.endsWith('_drog.md') ? big : download(path)
    }
    const result = await run(data, liar)
    expect(result.written).toEqual([slug + '/item.md', 'STATUS.md'])
    expect(result.pointers).toEqual([slug + '/drog.md.pointer.json', slug + '/upptaka.mp4.pointer.json'])
    expect(result.warnings).toEqual([
      slug + '/drog.md: skráin er ' + MIRROR_MAX_BYTES + ' bæti í Storage en 120 bæti samkvæmt gagnagrunni, bendiskrá skrifuð í staðinn.',
    ])
    expect(existsSync(join(out, slug, 'drog.md'))).toBe(false)
    const pointer = JSON.parse(readFileSync(join(out, slug, 'drog.md.pointer.json'), 'utf8'))
    expect(pointer.size).toBe(MIRROR_MAX_BYTES)
    expect(pointer.sha256).toBe(sha(big))
    expect(syncReport(out, result, false).text).toContain('Viðvaranir: 1')
    downloads = []
    const again = await run(data, liar)
    expect(again.written).toEqual([])
    expect(again.pointers).toEqual([])
    expect(downloads).toEqual([])
  })

  it('refuses a path that leaves the out folder', () => {
    expect(() => resolveInside(out, '../x')).toThrow()
    expect(() => resolveInside(out, 'a/../../x')).toThrow()
    expect(() => resolveInside(out, join(tmpdir(), 'x'))).toThrow()
    expect(resolveInside(out, 'a/b.md')).toBe(join(out, 'a', 'b.md'))
  })
})
