import { describe, it, expect } from 'vitest'
import {
  BOARD_SIZES,
  boardRects,
  estimateCardHeight,
  guardClose,
  idRange,
  mimeFor,
  normalizeRepoPath,
  parseCommand,
  parseTags,
  pickOne,
  placeItem,
  placeNewCard,
  resolveModule,
  resolveShort,
  statusPatch,
  storagePath,
  validateUpload,
} from './write.mjs'

const C = { id: 'p-c', user_id: 'u-c', short: 'C', display_name: 'Claude', is_service: true }
const H = { id: 'p-h', user_id: 'u-h', short: 'H', display_name: 'Heimir', is_service: false }
const A = { id: 'p-a', user_id: 'u-a', short: 'Á', display_name: 'Árni', is_service: false }
const participants = [H, A, C]

describe('guardClose', () => {
  const item = { id: 'i1', status: 'building' }
  const open = { id: 'q1', item_id: 'i1', answer: null, answered_at: null }
  const answered = { id: 'q2', item_id: 'i1', answer: 'Já', answered_at: '2026-10-31T10:00:00Z' }
  const action = { id: 'a1', item_id: 'i1', done_at: null }
  const doneAction = { id: 'a2', item_id: 'i1', done_at: '2026-10-31T10:00:00Z' }

  it('refuses with an unanswered question', () => {
    const r = guardClose(item, [open, answered], [], false)
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('1 ósvaraða spurningu')
    expect(r.reason).toContain('--force')
  })

  it('refuses with an open action and counts in Icelandic plural', () => {
    const r = guardClose(item, [], [action, { ...action, id: 'a3' }], false)
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('2 opin handtök')
  })

  it('names both counts', () => {
    const r = guardClose(item, [open, { ...open, id: 'q3' }], [action], false)
    expect(r.reason).toContain('2 ósvaraðar spurningar og 1 opið handtak')
  })

  it('allows with --force', () => {
    expect(guardClose(item, [open], [action], true)).toEqual({ ok: true })
  })

  it('allows when everything is answered and done', () => {
    expect(guardClose(item, [answered], [doneAction], false)).toEqual({ ok: true })
  })

  it('ignores rows of other items', () => {
    expect(guardClose(item, [{ ...open, item_id: 'i2' }], [{ ...action, item_id: 'i2' }], false)).toEqual({ ok: true })
  })
})

describe('resolveShort', () => {
  it('finds Árni by Á, in any case', () => {
    expect(resolveShort(participants, 'Á')).toBe('u-a')
    expect(resolveShort(participants, 'á')).toBe('u-a')
    expect(resolveShort(participants, ' c ')).toBe('u-c')
  })

  it('gives null for none', () => {
    expect(resolveShort(participants, 'none')).toBeNull()
    expect(resolveShort(participants, 'NONE')).toBeNull()
  })

  it('throws an Icelandic error naming the known shorts for an unknown one', () => {
    expect(() => resolveShort(participants, 'X')).toThrow(/Enginn þátttakandi.*X.*H, Á, C/)
  })
})

describe('parseTags', () => {
  it('splits on commas, trims and drops empty tags', () => {
    expect(parseTags('a, b,,c')).toEqual(['a', 'b', 'c'])
  })

  it('drops duplicates and gives [] for an empty string', () => {
    expect(parseTags('a,a , b')).toEqual(['a', 'b'])
    expect(parseTags('')).toEqual([])
    expect(parseTags(' , ')).toEqual([])
  })
})

describe('statusPatch', () => {
  it('clears waiting_on when the status is not waiting', () => {
    expect(statusPatch('building', undefined)).toEqual({ status: 'building', waiting_on: null })
    expect(statusPatch('done', null)).toEqual({ status: 'done', waiting_on: null })
  })

  it('refuses a person to wait on with a status other than waiting', () => {
    expect(() => statusPatch('ready', 'u-h')).toThrow(/--waiting-on/)
  })

  it('allows waiting with nobody to wait on', () => {
    expect(statusPatch('waiting', undefined)).toEqual({ status: 'waiting' })
    expect(statusPatch('waiting', null)).toEqual({ status: 'waiting', waiting_on: null })
    expect(statusPatch('waiting', 'u-h')).toEqual({ status: 'waiting', waiting_on: 'u-h' })
  })

  it('a person alone moves the item to waiting on them, none alone clears waiting_on', () => {
    expect(statusPatch(undefined, 'u-a')).toEqual({ status: 'waiting', waiting_on: 'u-a' })
    expect(statusPatch(undefined, null)).toEqual({ waiting_on: null })
    expect(statusPatch(undefined, undefined)).toEqual({})
  })

  it('refuses an unknown status', () => {
    expect(() => statusPatch('finished', undefined)).toThrow(/Óþekkt staða/)
  })
})

describe('resolveModule', () => {
  const modules = [
    { id: 'm1', slug: 'efnaskra' },
    { id: 'm2', slug: 'gatlistar' },
  ]
  it('finds a module by slug and gives null for none', () => {
    expect(resolveModule(modules, 'gatlistar')).toBe('m2')
    expect(resolveModule(modules, 'none')).toBeNull()
  })
  it('throws for an unknown slug', () => {
    expect(() => resolveModule(modules, 'nope')).toThrow(/Enginn módúll/)
  })
})

describe('idRange and pickOne', () => {
  it('turns a prefix of 8 hex characters into a uuid range', () => {
    expect(idRange('1A2B3C4D')).toEqual({
      prefix: '1a2b3c4d',
      lo: '1a2b3c4d-0000-0000-0000-000000000000',
      hi: '1a2b3c4d-ffff-ffff-ffff-ffffffffffff',
    })
  })

  it('accepts a leading # and dashes inside the prefix', () => {
    expect(idRange('#1a2b3c4d-9e').lo).toBe('1a2b3c4d-9e00-0000-0000-000000000000')
    expect(idRange('#1a2b3c4d-9e').prefix).toBe('1a2b3c4d9e')
  })

  it('a full uuid is its own range', () => {
    const id = '6ea33ea7-0072-4e4b-a625-156ebf487399'
    expect(idRange(id)).toEqual({ prefix: id.replace(/-/g, ''), lo: id, hi: id })
  })

  it('refuses short, too long or non hex input', () => {
    expect(() => idRange('1a2b3c4')).toThrow(/minnsta kosti 8/)
    expect(() => idRange('verk-1234567')).toThrow(/minnsta kosti 8/)
    expect(() => idRange('')).toThrow(/minnsta kosti 8/)
    expect(() => idRange('1'.repeat(33))).toThrow(/minnsta kosti 8/)
  })

  const rows = [{ id: '1a2b3c4d-0000-4000-8000-000000000001' }, { id: '1a2b3c4d-9999-4000-8000-000000000002' }]

  it('picks the one row whose id starts with the prefix', () => {
    expect(pickOne(rows, '1a2b3c4d9', 'item')).toBe(rows[1])
    expect(pickOne(rows, rows[0].id, 'item')).toBe(rows[0])
    expect(pickOne(rows, '#1A2B3C4D-0', 'item')).toBe(rows[0])
  })

  it('reports a missing and an ambiguous prefix in Icelandic', () => {
    expect(() => pickOne(rows, 'ffffffff', 'item')).toThrow(/passar ekki við neitt verk/)
    expect(() => pickOne(rows, 'ffffffff', 'question')).toThrow(/neina spurningu/)
    expect(() => pickOne(rows, '1a2b3c4d', 'item')).toThrow(/fleiri en eitt.*lengra/)
  })
})

describe('parseCommand', () => {
  const spec = { title: 'value', file: 'multi', force: 'bool' }

  it('reads positionals, value, multi and boolean flags and the global flags', () => {
    const r = parseCommand(
      ['item', 'create', '--title', 'T', '--file', 'a.md', '--file=b.png', '--force', '--project', 'metta', '--json'],
      spec,
      'item create',
    )
    expect(r.positional).toEqual(['item', 'create'])
    expect(r.flags).toEqual({ title: 'T', file: ['a.md', 'b.png'], force: true, project: 'metta', json: true })
  })

  it('rejects an unknown flag', () => {
    expect(() => parseCommand(['item', 'create', '--titel', 'T'], spec, 'item create')).toThrow(
      /Óþekktur rofi --titel fyrir huginn item create/,
    )
  })

  it('does not let a value flag swallow the next flag', () => {
    expect(() => parseCommand(['item', 'create', '--title', '--force'], spec, 'item create')).toThrow(/--title vantar gildi/)
    expect(() => parseCommand(['item', 'create', '--title'], spec, 'item create')).toThrow(/--title vantar gildi/)
  })

  it('keeps a word after a boolean flag as a positional', () => {
    const r = parseCommand(['item', 'close', '--force', 'abcdef12'], spec, 'item close')
    expect(r.positional).toEqual(['item', 'close', 'abcdef12'])
    expect(r.flags.force).toBe(true)
  })

  it('rejects a value on a boolean flag and a repeated single flag', () => {
    expect(() => parseCommand(['x', '--force=yes'], spec, 'x')).toThrow(/--force tekur ekki gildi/)
    expect(() => parseCommand(['x', '--title', 'a', '--title', 'b'], spec, 'x')).toThrow(/oftar en einu sinni/)
  })

  it('accepts an empty value, so --tags "" can clear tags', () => {
    expect(parseCommand(['x', '--title', ''], spec, 'x').flags.title).toBe('')
  })

  it('pins the flag shapes of action cancel and action set', () => {
    const r = parseCommand(['x', '--reason', 'r'], { reason: 'value' }, 'action cancel')
    expect(r.positional).toEqual(['x'])
    expect(r.flags).toEqual({ reason: 'r' })
    expect(() => parseCommand(['x', '--body'], { body: 'value' }, 'action set')).toThrow('--body vantar gildi.')
  })
})

describe('upload rules', () => {
  it('copies the web limits', () => {
    expect(validateUpload({ name: 'a.md', size: 10 })).toEqual({ ok: true })
    expect(validateUpload({ name: 'a.md', size: 0 }).ok).toBe(false)
    expect(validateUpload({ name: 'a.md', size: 52428801 }).ok).toBe(false)
    expect(validateUpload({ name: `${'x'.repeat(178)}.md`, size: 1 }).ok).toBe(false)
  })

  it('builds the storage path like the web: project, item, uuid and a safe name', () => {
    expect(storagePath('pr', 'it', 'uu', 'Skýrsla á íslensku.md')).toBe('pr/it/uu_Skyrsla_a_islensku.md')
  })

  it('guesses a mime type from the extension, null when unknown', () => {
    expect(mimeFor('a.MD')).toBe('text/markdown')
    expect(mimeFor('a.png')).toBe('image/png')
    expect(mimeFor('a.weird')).toBeNull()
  })
})

describe('normalizeRepoPath', () => {
  it('trims, turns backslashes into slashes, strips a leading ./ and collapses //', () => {
    expect(normalizeRepoPath(' docs\\plans\\a.md ')).toBe('docs/plans/a.md')
    expect(normalizeRepoPath('./docs/a.md')).toBe('docs/a.md')
    expect(normalizeRepoPath('docs//a.md')).toBe('docs/a.md')
    expect(normalizeRepoPath('docs/a.md')).toBe('docs/a.md')
  })
  it('refuses a path that is empty after normalising', () => {
    expect(() => normalizeRepoPath('  ')).toThrow('Slóðin er tóm.')
    expect(() => normalizeRepoPath('./')).toThrow('Slóðin er tóm.')
  })
})

// ---------- placement ----------

const S = BOARD_SIZES

function board(extra = {}) {
  return {
    packages: [
      { id: 'pk2', name: 'Annar', position: 1, pos_x: 1450, pos_y: 880 },
      { id: 'pk1', name: 'Grunnur', position: 0, pos_x: 1450, pos_y: 60 },
    ],
    modules: [
      { id: 'm2', package_id: 'pk1', slug: 'b', name: 'Gátlistar', status_line: 'Lína um stöðu', position: 1 },
      { id: 'm1', package_id: 'pk1', slug: 'a', name: 'Yfirlit', status_line: null, position: 0 },
      { id: 'm3', package_id: 'pk2', slug: 'c', name: 'Birgðir', status_line: null, position: 0 },
      { id: 'm4', package_id: null, slug: 'd', name: 'Laus', status_line: null, position: 0 },
    ],
    items: [],
    plans: [],
    files: [],
    actions: [],
    ...extra,
  }
}

function card(id, x, y, extra = {}) {
  return { id, status: 'new', title: 'Spjald', tags: [], pos_x: x, pos_y: y, module_id: null, ...extra }
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function obstaclesOf(b) {
  const { packs } = boardRects(b)
  const cards = b.items
    .filter((i) => i.status !== 'done' && i.status !== 'dropped')
    .map((i) => ({ x: i.pos_x, y: i.pos_y, w: S.cardW, h: estimateCardHeight(i, b) }))
  return [...packs, ...cards]
}

describe('boardRects', () => {
  it('stacks modules in their pack below the pack title, in position order', () => {
    const { modules, packs } = boardRects(board())
    const m1 = modules.get('m1')
    const m2 = modules.get('m2')
    expect(m1.x).toBe(1450 + S.moduleIndent)
    expect(m1.y).toBe(60 + S.packHead)
    expect(m1.w).toBe(S.packW - S.moduleIndent)
    expect(m2.y).toBe(m1.y + m1.h + S.moduleGap)
    // A status line makes the module taller.
    expect(m2.h).toBeGreaterThan(m1.h)
    expect(packs.find((p) => p.x === 1450 && p.y === 60).h).toBe(S.packHead + m1.h + S.moduleGap + m2.h + S.moduleGap)
  })

  it('leaves out a module that is in no pack (it is not drawn on the board)', () => {
    expect(boardRects(board()).modules.has('m4')).toBe(false)
  })
})

describe('estimateCardHeight', () => {
  it('is at least the size the web assumes for an undrawn card', () => {
    expect(estimateCardHeight({ title: 'Stutt', tags: [] })).toBeGreaterThanOrEqual(S.newCardH)
  })

  it('grows with a long title, chips and plans', () => {
    const base = estimateCardHeight({ id: 'x', title: 'Stutt', tags: [] })
    const long = estimateCardHeight({ id: 'x', title: 'Mjög langur titill '.repeat(6), tags: [] })
    const chips = estimateCardHeight({ id: 'x', title: 'Stutt', tags: ['a'] })
    const plans = estimateCardHeight({ id: 'x', title: 'Stutt', tags: [] }, { plans: [{ item_id: 'x' }] })
    expect(long).toBeGreaterThan(base)
    expect(chips).toBeGreaterThan(base)
    expect(plans).toBeGreaterThan(base)
  })
})

describe('placeItem', () => {
  it('puts a card for a module left of the module, top aligned, on an empty board', () => {
    const b = board()
    const m2 = boardRects(b).modules.get('m2')
    expect(placeItem(b, 'm2')).toEqual({ x: m2.x - S.gap - S.cardW, y: m2.y })
  })

  it('tries the right side of the module when the left spot holds a card', () => {
    const m1 = boardRects(board()).modules.get('m1')
    const b = board({ items: [card('c1', m1.x - S.gap - S.cardW, m1.y)] })
    expect(placeItem(b, 'm1')).toEqual({ x: m1.x + m1.w + S.gap, y: m1.y })
  })

  it('closed cards are not obstacles', () => {
    const m1 = boardRects(board()).modules.get('m1')
    const b = board({ items: [card('c1', m1.x - S.gap - S.cardW, m1.y, { status: 'dropped' })] })
    expect(placeItem(b, 'm1')).toEqual({ x: m1.x - S.gap - S.cardW, y: m1.y })
  })

  it('never lands on a card or a pack, even in a crowded column', () => {
    const m1 = boardRects(board()).modules.get('m1')
    const items = []
    // A wall of cards down both sides of the module, further than the candidate steps reach.
    for (let k = 0; k < 30; k++) {
      items.push(card(`l${k}`, m1.x - S.gap - S.cardW, m1.y + k * 150))
      items.push(card(`r${k}`, m1.x + m1.w + S.gap, m1.y + k * 150))
    }
    const b = board({ items })
    const pos = placeItem(b, 'm1')
    const rect = { ...pos, w: S.cardW, h: estimateCardHeight({ title: '', tags: [] }) }
    for (const o of obstaclesOf(b)) expect(overlaps(rect, o)).toBe(false)
    expect(Number.isInteger(pos.x) && Number.isInteger(pos.y)).toBe(true)
  })

  it('without a module, lands near the top left of what is on the board, off every pack and card', () => {
    const b = board({ items: [card('c1', 1100, 60)] })
    const pos = placeItem(b, null)
    const rect = { ...pos, w: S.cardW, h: estimateCardHeight({ title: '', tags: [] }) }
    for (const o of obstaclesOf(b)) expect(overlaps(rect, o)).toBe(false)
    expect(Math.abs(pos.x - 1100)).toBeLessThan(1000)
    expect(Math.abs(pos.y - 60)).toBeLessThan(1000)
  })

  it('a module in no pack is placed like no module', () => {
    const b = board()
    expect(placeItem(b, 'm4')).toEqual(placeItem(b, null))
  })

  it('on an empty board with nothing at all, starts at the origin', () => {
    expect(placeItem({ packages: [], modules: [], items: [] }, null)).toEqual({ x: 0, y: 0 })
  })

  it('uses the height of the new card, so a tall card does not reach into the card below', () => {
    const m1 = boardRects(board()).modules.get('m1')
    const below = card('c1', m1.x - S.gap - S.cardW, m1.y + 130)
    const b = board({ items: [below] })
    const tall = { title: 'Mjög langur titill '.repeat(8), tags: ['a', 'b'] }
    const pos = placeItem(b, 'm1', tall)
    const rect = { ...pos, w: S.cardW, h: estimateCardHeight(tall) }
    for (const o of obstaclesOf(b)) expect(overlaps(rect, o)).toBe(false)
  })
})

describe('placeNewCard port', () => {
  it('centres on the view centre without an anchor', () => {
    expect(placeNewCard({ anchor: null, center: { x: 500, y: 300 }, size: { w: 250, h: 110 }, obstacles: [] })).toEqual({
      x: 375,
      y: 245,
    })
  })
})
