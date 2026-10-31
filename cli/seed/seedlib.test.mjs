import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { BOARD_SIZES as S, boardRects, estimateCardHeight, placeItem } from '../lib/write.mjs'
import { describeEntry, hasDashPunctuation, itemInput, placeEntry, splitSeed, validateSeed } from './seedlib.mjs'

const participants = [
  { user_id: 'u-h', short: 'H' },
  { user_id: 'u-a', short: 'Á' },
  { user_id: 'u-c', short: 'C' },
]
const modules = [
  { id: 'm-efna', slug: 'efnaskra' },
  { id: 'm-kiosk', slug: 'kiosk' },
]
const ctx = { projectId: 'p1', userId: 'u-c', modules, participants }

const base = {
  title: 'Efnaskrá A og B: endurhönnun',
  module: 'efnaskra',
  status: 'waiting',
  waiting_on: 'H',
  summary: 'handtök eftir',
  body: 'Sameinað í main.',
  tags: ['pakki Árna'],
  source_ref: 'docs/progress/141-efnaskra-a.md',
}

describe('hasDashPunctuation', () => {
  it('flags en and em dashes and a lone hyphen between spaces', () => {
    expect(hasDashPunctuation('A – B')).toBe(true)
    expect(hasDashPunctuation('A—B')).toBe(true)
    expect(hasDashPunctuation('A - B')).toBe(true)
    expect(hasDashPunctuation('- lína')).toBe(true)
  })
  it('allows hyphens inside words and token names', () => {
    expect(hasDashPunctuation('Fable-yfirferð og iPad-athugun')).toBe(false)
    expect(hasDashPunctuation('(--mc-ink) og 768 til 1279')).toBe(false)
    expect(hasDashPunctuation(null)).toBe(false)
  })
})

describe('validateSeed', () => {
  it('accepts a valid entry', () => {
    expect(validateSeed({ items: [base] }, ctx)).toEqual([])
  })
  it('needs an items array', () => {
    expect(validateSeed({}, ctx)).toHaveLength(1)
  })
  it('rejects duplicate titles, unknown status, module and short', () => {
    const errors = validateSeed(
      {
        items: [
          base,
          { ...base },
          { ...base, title: 'B', status: 'doing' },
          { ...base, title: 'C', module: 'engin' },
          { ...base, title: 'D', waiting_on: 'X' },
        ],
      },
      ctx,
    )
    expect(errors.some((e) => e.includes('oftar en einu sinni'))).toBe(true)
    expect(errors.some((e) => e.includes('óþekkt staða doing'))).toBe(true)
    expect(errors.some((e) => e.includes('engin'))).toBe(true)
    expect(errors.some((e) => e.includes('skammstöfunina X'))).toBe(true)
  })
  it('allows waiting_on only on waiting and needs a building plan for building', () => {
    const errors = validateSeed(
      {
        items: [
          { ...base, title: 'P', status: 'parked' },
          { ...base, title: 'B', status: 'building', waiting_on: null, plans: [{ name: 'Plan A', status: 'todo' }] },
        ],
      },
      ctx,
    )
    expect(errors).toHaveLength(2)
    expect(errors[0]).toContain('waiting_on')
    expect(errors[1]).toContain('plan í byggingu')
  })
  it('checks plans, rulings and actions', () => {
    const errors = validateSeed(
      {
        items: [
          {
            ...base,
            plans: [{ name: 'Plan A', status: 'later', rulings: [{ code: 'R1', body: 'a — b', cost: 'none' }] }],
            actions: [{ owner: 'none', body: 'Keyra SQL' }, { owner: 'H', body: '' }],
          },
        ],
      },
      ctx,
    )
    expect(errors.some((e) => e.includes('óþekkt staða plans later'))).toBe(true)
    expect(errors.some((e) => e.includes('úrskurði R1'))).toBe(true)
    expect(errors.some((e) => e.includes('þarf eiganda'))).toBe(true)
    expect(errors.some((e) => e.includes('handtak án texta'))).toBe(true)
  })
  it('flags dash punctuation in text fields but not in an action payload', () => {
    const ok = validateSeed({ items: [{ ...base, actions: [{ owner: 'H', body: 'SQL', payload: 'select 1 -- x' }] }] }, ctx)
    expect(ok).toEqual([])
    const bad = validateSeed({ items: [{ ...base, body: 'Eitt - annað' }] }, ctx)
    expect(bad[0]).toContain('lýsingu')
  })
  it('needs body and source_ref', () => {
    const errors = validateSeed({ items: [{ ...base, body: ' ', source_ref: '' }] }, ctx)
    expect(errors).toHaveLength(2)
  })
})

describe('itemInput', () => {
  it('maps module slug and waiting_on short to ids', () => {
    expect(itemInput(base, ctx)).toEqual({
      projectId: 'p1',
      userId: 'u-c',
      title: 'Efnaskrá A og B: endurhönnun',
      body: 'Sameinað í main.',
      summary: 'handtök eftir',
      moduleId: 'm-efna',
      tags: ['pakki Árna'],
      status: 'waiting',
      waitingOn: 'u-h',
      sourceRef: 'docs/progress/141-efnaskra-a.md',
    })
  })
  it('leaves module and waiting_on null when absent', () => {
    const input = itemInput({ ...base, module: null, status: 'parked', waiting_on: undefined, summary: undefined }, ctx)
    expect(input.moduleId).toBeNull()
    expect(input.waitingOn).toBeNull()
    expect(input.summary).toBeNull()
  })
})

describe('splitSeed', () => {
  it('skips exact titles that exist, whatever their status', () => {
    const items = [{ title: 'A' }, { title: 'B ' }, { title: 'C' }]
    const { create, skip } = splitSeed(items, ['B', 'a'])
    expect(create.map((i) => i.title)).toEqual(['A', 'C'])
    expect(skip.map((i) => i.title)).toEqual(['B '])
  })
  it('creates nothing on a second run', () => {
    const items = [{ title: 'A' }, { title: 'B' }]
    expect(splitSeed(items, ['A', 'B']).create).toEqual([])
  })
})

describe('placeEntry', () => {
  const board = (items) => ({
    packages: [{ id: 'pk1', name: 'Grunnur', position: 0, pos_x: 1450, pos_y: 60 }],
    modules: [{ id: 'm1', package_id: 'pk1', slug: 'a', name: 'Yfirlit', status_line: null, position: 0 }],
    items,
    plans: [],
    files: [],
    actions: [],
  })
  const entry = {
    plans: [{ status: 'done' }, { status: 'done' }],
    actions: [{ owner: 'H' }, { owner: 'H' }, { owner: 'Á' }],
  }
  const input = { moduleId: 'm1', title: 'Efnaskrá A og B: endurhönnun', tags: ['pakki Árna', 'fyrir sýningu'] }
  const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

  it('sizes the card with its plans and actions, so it skips a gap that only fits a bare card', () => {
    const m1 = boardRects(board([])).modules.get('m1')
    const bare = estimateCardHeight({ title: input.title, tags: input.tags, fileCount: 0 })
    const blocker = { id: 'c1', status: 'new', title: 'Spjald', tags: [], module_id: null, pos_x: m1.x - S.gap - S.cardW, pos_y: m1.y + bare + S.gap }
    const b = board([blocker])
    const plain = placeItem(b, 'm1', { title: input.title, tags: input.tags, fileCount: 0 })
    const pos = placeEntry(b, input, entry)
    const full = estimateCardHeight(
      { id: 'x', title: input.title, tags: input.tags, fileCount: 0 },
      { plans: entry.plans.map(() => ({ item_id: 'x' })), actions: entry.actions.map(() => ({ item_id: 'x', done_at: null })), files: [] },
    )
    expect(full).toBeGreaterThan(bare)
    expect(pos).not.toEqual(plain)
    const rect = { ...pos, w: S.cardW, h: full }
    const card = { x: blocker.pos_x, y: blocker.pos_y, w: S.cardW, h: estimateCardHeight(blocker, b) }
    expect(overlaps(rect, card)).toBe(false)
  })

  it('leaves no placeholder rows on the board', () => {
    const b = board([])
    placeEntry(b, input, entry)
    expect(b.plans).toEqual([])
    expect(b.actions).toEqual([])
  })
})

describe('describeEntry', () => {
  it('prints module, status, waiting_on, plans and actions', () => {
    const text = describeEntry(
      {
        ...base,
        plans: [{ name: 'Plan A', path: 'docs/plans/a.md', status: 'done', rulings: [{ code: 'R1', body: 'x' }] }],
        actions: [{ owner: 'H', body: 'Keyra SQL', payload: 'select 1' }],
      },
      { x: 10, y: 20 },
    )
    expect(text).toContain('módúll efnaskra, staða waiting, bíður H, staðsetning 10,20')
    expect(text).toContain('plan: Plan A (done) docs/plans/a.md, 1 úrskurðir')
    expect(text).toContain('handtak H: Keyra SQL [með payload]')
  })
})

describe('metta seed file', () => {
  const data = JSON.parse(readFileSync(new URL('./metta-2026-10-31.json', import.meta.url), 'utf8'))
  const slugs = [
    'yfirlit', 'gatlistar', 'kiosk', 'hitamaelingar', 'atvik', 'verkferlar', 'efnaskra', 'stefnur-og-thjalfun',
    'vidhald', 'ahaettumat', 'innri-uttekt', 'oryggisfundir', 'merkimidar', 'abendingar',
    'spjaldtolvur-og-simar', 'innskraning-og-oryggi', 'honnunarkerfi', 'gagnagrunnur-og-afkost', 'innleiding',
    'tolvupostur', 'profanir-og-smokes', 'rv-samstarf', 'storeldhusid-5-6-nov', 'landing-metta-is',
    'tilbod-og-verdskra', 'eigendabakendi', 'birgdir-og-pantanir', 'uppskriftir-og-ryrnun',
  ]
  const live = { ...ctx, modules: slugs.map((slug) => ({ id: `m-${slug}`, slug })) }

  it('validates against the live module slugs', () => {
    expect(validateSeed(data, live)).toEqual([])
  })
  it('keeps the Efnaskrá handover: plans A, B1, B2 done, 17 rulings on A, SQL payload', () => {
    const e1 = data.items.find((i) => i.mockup_id === 'e1')
    expect(e1.plans.map((p) => `${p.name}:${p.status}`)).toEqual(['Plan A:done', 'Plan B1:done', 'Plan B2:done'])
    expect(e1.plans[0].rulings.map((r) => r.code)).toEqual(Array.from({ length: 17 }, (_, i) => `R${i + 1}`))
    expect(e1.actions[0].payload).toContain("c0da0aec-e2cf-4139-9b44-c23b36d3dbae")
  })
})
