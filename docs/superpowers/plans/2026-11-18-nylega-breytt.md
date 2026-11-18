# Nýlega breytt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "nýlega breytt" pill first in the top bar that counts and filters the cards whose last movement is inside a window (24 h, 3 days default, 7 days), with the list sort "Síðast breytt" and the list row date reading the same clock.

**Architecture:** One pure rule in `src/vinnubord/lib/recent.ts` gives every item the newest stamp of the item and of everything on it. `BoardPage` computes it once per data load and `cardModels` puts it on the card model (`changedAt`, `recent`), which the board and the list already share. The pill is one more boolean on the local `Filter`, next to `unread`. No database change, no CLI change.

**Tech Stack:** React 19, TypeScript, vitest, plain CSS tokens in `src/vinnubord/vinnubord.css`, `react-i18next`.

**Spec:** `docs/superpowers/specs/2026-11-18-nylega-breytt-design.md` (Icelandic, approved by Heimir 2026-11-18). Read it before starting.

## Global Constraints

- Full profile, not the small task profile: 13 code files. Every task gets its review, the whole branch gets the Fable final review, fix rounds are reviewed.
- Build in a worktree, never switch the branch of the main checkout: `.superpowers/wt/feat-nylega-breytt`, branch `feat/nylega-breytt`, `node_modules` as a junction (`cmd //c "mklink /J node_modules ..\\..\\..\\node_modules"`), `.env` hard linked (`ln ../../../.env .env`).
- No migration, no change under `supabase/`, `cli/` or `scripts/`. `npm run smoke:hg` is not part of this plan.
- No em dashes and no hyphen dashes as punctuation, in code comments, copy and docs.
- Rules below the token block in `vinnubord.css` read only tokens. Stroke widths and 1 px hairlines are the allowed literals.
- No coloured left bar or stripe on anything.
- Window values are exactly 24, 72 and 168 hours, default 72, storage key `hg.recent` in `localStorage`.
- Commit prefixes `feat:`, `test:`, `docs:` with scope `(vinnubord)`, trailer `Co-Authored-By: Claude <noreply@anthropic.com>`.
- Implementer budget: at about 60 tool calls or 150k context, commit what is green, report DONE_WITH_CONCERNS with what is left. Read code in large ranges with Read.
- Suggested implementer models: tasks 1 to 4 and 6 Sonnet (the code is in the plan), task 5 Opus (browser checks need judgment). Reviewers never below Sonnet.
- Each task names its verification set. The implementer checks nothing else. Reviewers judge the whole diff.

## Size table

| Task | Files | Size |
|---|---|---|
| 1. The rule and the window | `lib/recent.ts` (new), `lib/recent.test.ts` (new), `hooks/useRecentWindow.ts` (new) | S |
| 2. The card model carries it | `lib/cards.ts`, `lib/cards.test.ts`, `lib/list.test.ts`, `pages/BoardPage.tsx` | M |
| 3. The list reads it | `lib/list.ts`, `lib/list.test.ts`, `components/ListDrawer.tsx` | S |
| 4. The filter | `lib/filters.ts`, `lib/filters.test.ts`, `hooks/useFilter.ts`, `lib/views.ts`, `components/ViewMenu.tsx`, `lib/cards.ts`, `lib/cards.test.ts` | L, not split |
| 5. The pill and the window choice | `components/TopBar.tsx`, `pages/BoardPage.tsx`, `vinnubord.css`, `locales/en.json`, `locales/is.json` | M |
| 6. Docs | `CLAUDE.md`, `docs/progress/18-nylega-breytt.md` (new) | S |

Task 4 is 7 files and cannot be split: `Filter` and the `matches` context each gain a required field, so every place that builds one has to change in the same commit for `tsc -b` to pass. Five of the seven edits are one line.

All paths below are under `src/vinnubord/` unless they start with `src/`, `docs/` or `CLAUDE.md`.

## Review Focus

1. Stamps arrive in mixed forms (`...00+00:00`, `...00.123456+00:00`, `...Z`). The newest must win by time, not by string order. Test in task 1.
2. A stamp slightly in the future (server clock ahead of the browser) is a fresh change and must count as recent. Test in task 1.
3. A comment, file or action whose item is not in the loaded board (closed more than 90 days ago) must not create a map entry or throw. Test in task 1.
4. A filter stored in `sessionStorage` before this change has no `recent` key, and `hg.recent` can hold garbage: both fall back (off, 72). Tests in tasks 1 and 4.
5. Seven pills on a 1280 to 1440 px wide bar: the bar stays one row, the pill row scrolls sideways, nothing overlaps. Browser check in task 5.

---

### Task 1: The rule and the window

**Files:**
- Create: `src/vinnubord/lib/recent.ts`
- Create: `src/vinnubord/lib/recent.test.ts`
- Create: `src/vinnubord/hooks/useRecentWindow.ts`

**Interfaces:**
- Produces: `RECENT_HOURS`, `RecentHours`, `DEFAULT_RECENT_HOURS`, `RECENT_KEY`, `parseRecentHours(raw: string | null): RecentHours`, `lastChangeByItem(data): Map<string, number>` (epoch ms per item id, 0 when nothing parses), `isRecent(changedAt: number, now: number, hours: RecentHours): boolean`, and the hook `useRecentWindow(): { hours: RecentHours; setHours: (h: RecentHours) => void }`.

- [ ] **Step 1: Write the failing test** `src/vinnubord/lib/recent.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { DEFAULT_RECENT_HOURS, RECENT_HOURS, RECENT_KEY, isRecent, lastChangeByItem, parseRecentHours } from './recent'
import type { Action, Comment, FileRow, Item, Plan, Question, Ruling } from './types'

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'i1', created_at: '2026-11-01T00:00:00Z', project_id: 'pr', module_id: null, title: 'Item', summary: null,
    body: null, status: 'new', waiting_on: null, tags: [], keywords: [], pos_x: 0, pos_y: 0, source_ref: null,
    next_step: null, next_prompt: null, created_by: 'u', updated_by: null,
    updated_at: '2026-11-02T00:00:00Z', closed_at: null, ...over,
  }
}
const comment = (over: Partial<Comment>): Comment => ({
  id: 'c', created_at: null, project_id: 'pr', item_id: 'i1', module_id: null, body: 'x', user_id: 'u', ...over,
})
const file = (over: Partial<FileRow>): FileRow => ({
  id: 'f', created_at: null, project_id: 'pr', item_id: 'i1', name: 'a.md', storage_path: 'p', size: 1, mime: null,
  repo_path: null, note: null, uploaded_by: 'u', updated_at: null, updated_by: null, ...over,
})
const question = (over: Partial<Question>): Question => ({
  id: 'q', created_at: null, project_id: 'pr', item_id: 'i1', body: 'x', asked_by: 'u', asked_to: null, answer: null,
  answered_by: null, answered_at: null, ...over,
})
const action = (over: Partial<Action>): Action => ({
  id: 'a', created_at: null, project_id: 'pr', item_id: 'i1', body: 'x', owner: 'u', created_by: null, payload: null,
  done_at: null, done_by: null, updated_at: null, updated_by: null, cancelled: false, cancel_reason: null, ...over,
})
const plan = (over: Partial<Plan>): Plan => ({
  id: 'pl', created_at: null, project_id: 'pr', item_id: 'i1', name: 'P', path: null, status: 'todo', position: 0,
  updated_at: '2026-11-01T00:00:00Z', ...over,
})
const ruling = (over: Partial<Ruling>): Ruling => ({
  id: 'r', created_at: null, project_id: 'pr', plan_id: 'pl', code: 'R1', body: 'x', cost: null, reversed: false, ...over,
})

const none = { comments: [], files: [], questions: [], actions: [], plans: [], rulings: [] }
const at = (iso: string) => Date.parse(iso)
const LATE = '2026-11-10T08:00:00Z'

describe('lastChangeByItem', () => {
  it('an item alone is the later of created_at and updated_at', () => {
    expect(lastChangeByItem({ ...none, items: [item()] }).get('i1')).toBe(at('2026-11-02T00:00:00Z'))
    const born = item({ created_at: '2026-11-05T00:00:00Z', updated_at: '2026-11-02T00:00:00Z' })
    expect(lastChangeByItem({ ...none, items: [born] }).get('i1')).toBe(at('2026-11-05T00:00:00Z'))
  })
  it('every kind of thing on the item moves it', () => {
    const cases = [
      { comments: [comment({ created_at: LATE })] },
      { files: [file({ created_at: LATE })] },
      { files: [file({ created_at: '2026-11-01T00:00:00Z', updated_at: LATE })] },
      { questions: [question({ created_at: LATE })] },
      { questions: [question({ created_at: '2026-11-01T00:00:00Z', answered_at: LATE })] },
      { actions: [action({ created_at: LATE })] },
      { actions: [action({ created_at: '2026-11-01T00:00:00Z', done_at: LATE })] },
      { actions: [action({ created_at: '2026-11-01T00:00:00Z', updated_at: LATE })] },
      { plans: [plan({ created_at: LATE })] },
      { plans: [plan({ updated_at: LATE })] },
      { plans: [plan({})], rulings: [ruling({ created_at: LATE })] },
    ]
    for (const [n, extra] of cases.entries()) {
      expect(lastChangeByItem({ ...none, items: [item()], ...extra }).get('i1'), `case ${n}`).toBe(at(LATE))
    }
  })
  it('an older thing on the item never moves it back', () => {
    const data = { ...none, items: [item()], comments: [comment({ created_at: '2026-10-01T00:00:00Z' })] }
    expect(lastChangeByItem(data).get('i1')).toBe(at('2026-11-02T00:00:00Z'))
  })
  it('the newest wins by time across stamp forms, not by string order', () => {
    // 09:00 at +01:00 is 08:00 UTC: later as a string, earlier in time.
    const data = {
      ...none,
      items: [item({ updated_at: '2026-11-10T09:00:00+01:00' })],
      comments: [comment({ created_at: '2026-11-10T08:30:00.123456+00:00' })],
      actions: [action({ created_at: '2026-11-10T08:15:00Z' })],
    }
    expect(lastChangeByItem(data).get('i1')).toBe(at('2026-11-10T08:30:00.123456+00:00'))
  })
  it('ignores a module comment, a row of an item that is not loaded and a ruling of an unknown plan', () => {
    const data = {
      ...none,
      items: [item()],
      comments: [comment({ item_id: null, module_id: 'm1', created_at: LATE }), comment({ item_id: 'gone', created_at: LATE })],
      files: [file({ item_id: 'gone', created_at: LATE })],
      rulings: [ruling({ plan_id: 'nope', created_at: LATE })],
    }
    const map = lastChangeByItem(data)
    expect(map.get('i1')).toBe(at('2026-11-02T00:00:00Z'))
    expect([...map.keys()]).toEqual(['i1'])
  })
  it('null and unparsable stamps are skipped, an item with none is 0', () => {
    const blank = item({ created_at: null, updated_at: 'nope' })
    expect(lastChangeByItem({ ...none, items: [blank], comments: [comment({ created_at: 'x' })] }).get('i1')).toBe(0)
  })
})

describe('isRecent', () => {
  const now = at('2026-11-18T12:00:00Z')
  it('is inside the window, the edge included', () => {
    expect(isRecent(at('2026-11-18T11:00:00Z'), now, 24)).toBe(true)
    expect(isRecent(at('2026-11-17T12:00:00Z'), now, 24)).toBe(true)
    expect(isRecent(at('2026-11-17T11:59:59Z'), now, 24)).toBe(false)
    expect(isRecent(at('2026-11-15T12:00:00Z'), now, 72)).toBe(true)
    expect(isRecent(at('2026-11-11T12:00:00Z'), now, 168)).toBe(true)
    expect(isRecent(at('2026-11-11T11:00:00Z'), now, 168)).toBe(false)
  })
  it('a stamp ahead of the browser clock counts, an item with no stamp never does', () => {
    expect(isRecent(at('2026-11-18T12:00:05Z'), now, 24)).toBe(true)
    expect(isRecent(0, now, 168)).toBe(false)
  })
})

describe('the window', () => {
  it('has three choices, 72 hours by default, one key for every project', () => {
    expect([...RECENT_HOURS]).toEqual([24, 72, 168])
    expect(DEFAULT_RECENT_HOURS).toBe(72)
    expect(RECENT_KEY).toBe('hg.recent')
  })
  it('parses a stored choice and falls back to the default', () => {
    expect(parseRecentHours('24')).toBe(24)
    expect(parseRecentHours('72')).toBe(72)
    expect(parseRecentHours('168')).toBe(168)
    for (const raw of [null, '', 'abc', '48', '72.5', '-24', '{}']) expect(parseRecentHours(raw), String(raw)).toBe(72)
  })
})
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run src/vinnubord/lib/recent.test.ts`
Expected: FAIL, cannot resolve `./recent`.

- [ ] **Step 3: Write `src/vinnubord/lib/recent.ts`**

```ts
import type { BoardData } from './types'

// "Nýlega breytt" (spec 2026-11-18): the last movement of an item is the
// newest stamp on the item or on anything that belongs to it, and a card is
// recent while that movement is inside the viewer's window. The pill, the
// list sorts and the list row date all read this one clock.

export const RECENT_HOURS = [24, 72, 168] as const
export type RecentHours = (typeof RECENT_HOURS)[number]
export const DEFAULT_RECENT_HOURS: RecentHours = 72

// localStorage key of the window. One for every project: it is a personal
// setting, like the language.
export const RECENT_KEY = 'hg.recent'

export function parseRecentHours(raw: string | null): RecentHours {
  const n = Number(raw)
  return (RECENT_HOURS as readonly number[]).includes(n) ? (n as RecentHours) : DEFAULT_RECENT_HOURS
}

function ms(stamp: string | null | undefined): number {
  if (!stamp) return 0
  const at = Date.parse(stamp)
  return Number.isNaN(at) ? 0 : at
}

// Epoch ms of the last movement per item id, 0 when no stamp parses. Counts
// the item itself, its chat, files (a replace too), questions and answers,
// actions (done, cancelled or edited too), plans and their rulings. Rows of
// an item that is not loaded, and module comments, are skipped. What moves
// no stamp in the database (a drag, keywords, a file note, a silent tag
// change, a read mark) does not count.
export function lastChangeByItem(
  data: Pick<BoardData, 'items' | 'comments' | 'files' | 'questions' | 'actions' | 'plans' | 'rulings'>,
): Map<string, number> {
  const latest = new Map<string, number>()
  for (const item of data.items) latest.set(item.id, Math.max(ms(item.created_at), ms(item.updated_at)))
  const bump = (itemId: string | null | undefined, ...stamps: (string | null)[]) => {
    if (!itemId) return
    const have = latest.get(itemId)
    if (have === undefined) return
    let best = have
    for (const s of stamps) best = Math.max(best, ms(s))
    if (best !== have) latest.set(itemId, best)
  }
  for (const c of data.comments) bump(c.item_id, c.created_at)
  for (const f of data.files) bump(f.item_id, f.created_at, f.updated_at)
  for (const q of data.questions) bump(q.item_id, q.created_at, q.answered_at)
  for (const a of data.actions) bump(a.item_id, a.created_at, a.done_at, a.updated_at)
  const itemOfPlan = new Map<string, string>()
  for (const p of data.plans) {
    itemOfPlan.set(p.id, p.item_id)
    bump(p.item_id, p.created_at, p.updated_at)
  }
  for (const r of data.rulings) bump(itemOfPlan.get(r.plan_id), r.created_at)
  return latest
}

// A stamp ahead of now (the server clock runs ahead of the browser) is recent.
export function isRecent(changedAt: number, now: number, hours: RecentHours): boolean {
  return changedAt > 0 && now - changedAt <= hours * 3_600_000
}
```

- [ ] **Step 4: Write `src/vinnubord/hooks/useRecentWindow.ts`**

```ts
import { useCallback, useState } from 'react'
import { RECENT_KEY, parseRecentHours, type RecentHours } from '../lib/recent'

function read(): RecentHours {
  try {
    return parseRecentHours(localStorage.getItem(RECENT_KEY))
  } catch {
    return parseRecentHours(null)
  }
}

// The viewer's "nýlega breytt" window in hours, kept in localStorage under
// hg.recent: one choice per browser for every project.
export function useRecentWindow() {
  const [hours, setState] = useState<RecentHours>(read)
  const setHours = useCallback((next: RecentHours) => {
    try {
      localStorage.setItem(RECENT_KEY, String(next))
    } catch {
      // Storage can be blocked (private mode). The choice still holds for this page.
    }
    setState(next)
  }, [])
  return { hours, setHours }
}
```

- [ ] **Step 5: Verify**

Run: `npx vitest run src/vinnubord/lib/recent.test.ts` then `npm run build`
Expected: all tests in the file pass, build green. Nothing else needs checking by the implementer.

- [ ] **Step 6: Commit**

```bash
git add src/vinnubord/lib/recent.ts src/vinnubord/lib/recent.test.ts src/vinnubord/hooks/useRecentWindow.ts
git commit -m "feat(vinnubord): last movement rule and the recent window" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: The card model carries it

**Files:**
- Modify: `src/vinnubord/lib/cards.ts`
- Modify: `src/vinnubord/lib/cards.test.ts`
- Modify: `src/vinnubord/lib/list.test.ts` (the `card()` literal only)
- Modify: `src/vinnubord/pages/BoardPage.tsx`

**Interfaces:**
- Consumes: `lastChangeByItem`, `isRecent`, `RecentHours` from `lib/recent`, `useRecentWindow` from `hooks/useRecentWindow` (task 1).
- Produces: `CardModel.changedAt: number` (epoch ms, 0 when unknown), `CardModel.recent: boolean`, `CardContext.changed: Map<string, number>`, `CardContext.recentHours: RecentHours`. In `BoardPage`: `recentWindow` (the hook result) and `changed` (the map).

- [ ] **Step 1: Write the failing test.** In `cards.test.ts`, add two fields to `base` so the object reads:

```ts
const base: CardContext = {
  viewerId: 'me', participants, actions: [], modules: [module({ id: 'm1', package_id: 'p1' })],
  unread: new Map(), filter: emptyFilter(), comments: [], reads: [], now: Date.now(),
  search: new Map(), changed: new Map(), recentHours: 72,
}
```

and add this test inside `describe('cardModels', ...)`, after the `moduleName, showStamp and freshComment` test:

```ts
  it('changedAt comes from the changed map and recent from the window', () => {
    const now = Date.parse('2026-11-18T12:00:00Z')
    const changed = new Map([['a', Date.parse('2026-11-17T12:00:00Z')], ['b', Date.parse('2026-11-10T12:00:00Z')]])
    const out = cardModels([item({ id: 'a' }), item({ id: 'b' }), item({ id: 'c' })], ctx({ now, changed, recentHours: 72 }))
    expect(out.map((c) => c.changedAt)).toEqual([changed.get('a'), changed.get('b'), 0])
    expect(out.map((c) => c.recent)).toEqual([true, false, false])
    expect(cardModels([item({ id: 'b' })], ctx({ now, changed, recentHours: 168 }))[0].recent).toBe(false)
    expect(cardModels([item({ id: 'a' })], ctx({ now, changed, recentHours: 24 }))[0].recent).toBe(true)
  })
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run src/vinnubord/lib/cards.test.ts`
Expected: FAIL, `changedAt` is undefined.

- [ ] **Step 3: Edit `cards.ts`**

Add the import after the `./reads` import:

```ts
import { isRecent, type RecentHours } from './recent'
```

Add to `CardModel`, after `freshComment`:

```ts
  // Epoch ms of the last movement on the item or anything on it (lib/recent), 0 when unknown.
  changedAt: number
  // True when changedAt is inside the viewer's window.
  recent: boolean
```

Add to `CardContext`, after `search`:

```ts
  // Last movement per item id (lastChangeByItem) and the viewer's window.
  changed: Map<string, number>
  recentHours: RecentHours
```

In `cardModels`, after the line `const text = ctx.search.get(item.id) ?? ''`:

```ts
    const changedAt = ctx.changed.get(item.id) ?? 0
    const recent = isRecent(changedAt, ctx.now, ctx.recentHours)
```

and in the returned object, after the `freshComment` line:

```ts
      changedAt,
      recent,
```

- [ ] **Step 4: Edit the `card()` helper in `list.test.ts`** so the literal carries the new fields:

```ts
    fresh: null, mover: null, waitingOn: null, moduleName: null, showStamp: false, freshComment: null,
    changedAt: 0, recent: false, ...over,
```

- [ ] **Step 5: Edit `BoardPage.tsx`**

Imports, in the existing groups:

```ts
import { useRecentWindow } from '../hooks/useRecentWindow'
import { lastChangeByItem } from '../lib/recent'
```

After `const folds = useCollapsedPacks(project?.id ?? '')`:

```ts
  // The viewer's "nýlega breytt" window, per browser.
  const recentWindow = useRecentWindow()
```

After the `const search = useMemo(...)` line:

```ts
  // Last movement per item: one clock for the pill, the list sorts and the list row date.
  const changed = useMemo(() => (loaded ? lastChangeByItem(data) : new Map<string, number>()), [loaded, data])
```

In the `cards` memo, add to the context object after `search,`:

```ts
            changed,
            recentHours: recentWindow.hours,
```

and make its dependency list:

```ts
    [loaded, data, visibleItems, viewerId, unreadByItem, filterApi.filter, search, now, changed, recentWindow.hours],
```

- [ ] **Step 6: Verify**

Run: `npx vitest run src/vinnubord/lib/cards.test.ts src/vinnubord/lib/list.test.ts` then `npm run build`
Expected: both files pass, build green. Nothing else needs checking by the implementer.

- [ ] **Step 7: Commit**

```bash
git add src/vinnubord/lib/cards.ts src/vinnubord/lib/cards.test.ts src/vinnubord/lib/list.test.ts src/vinnubord/pages/BoardPage.tsx
git commit -m "feat(vinnubord): the card model carries the last movement" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: The list reads it

**Files:**
- Modify: `src/vinnubord/lib/list.ts`
- Modify: `src/vinnubord/lib/list.test.ts`
- Modify: `src/vinnubord/components/ListDrawer.tsx`

**Interfaces:**
- Consumes: `CardModel.changedAt` (task 2).
- Produces: nothing new. The `'updated'` sort and the order inside a status bucket follow `changedAt`.

- [ ] **Step 1: Change the tests first.** In `list.test.ts`, replace the whole `describe('listRows by status and by updated', ...)` block with:

```ts
describe('listRows by status and by updated', () => {
  const day = (d: number) => Date.parse(`2026-01-0${d}T00:00:00Z`)
  // updated_at is the same everywhere on purpose: the order must come from changedAt.
  const cards = [
    card({ item: item({ id: 'old', module_id: 'm1' }), bucket: 'mine', changedAt: day(1) }),
    card({ item: item({ id: 'new', module_id: 'm2' }), bucket: 'mine', changedAt: day(3) }),
    card({ item: item({ id: 'n', module_id: null }), bucket: 'new', changedAt: day(2) }),
    card({ item: item({ id: 'off' }), bucket: null, changedAt: 0 }),
  ]
  it('status: bucket rows in pill order, last moved first inside, module name on the row', () => {
    const rows = listRows(cards, packages, modules, 'status').rows
    expect(rows.map((r) => (r.kind === 'item' ? r.card.item.id : `${r.kind}:${r.id}`))).toEqual(['bucket:new', 'n', 'bucket:mine', 'new', 'old', 'bucket:closed', 'off'])
    expect(rows[3]).toMatchObject({ kind: 'item', moduleName: 'Kiosk' })
    expect(rows[1]).toMatchObject({ kind: 'item', moduleName: null })
  })
  it('updated: one run, last moved first, ties by id', () => {
    const tie = [card({ item: item({ id: 'b' }), changedAt: day(1) }), card({ item: item({ id: 'a' }), changedAt: day(1) })]
    expect(listRows(tie, packages, modules, 'updated').rows.map((r) => r.kind === 'item' && r.card.item.id)).toEqual(['a', 'b'])
    expect(listRows(cards, packages, modules, 'updated').rows.map((r) => r.kind === 'item' && r.card.item.id)).toEqual(['new', 'n', 'old', 'off'])
  })
  it('updated: a card whose item is old but whose chat is new goes first', () => {
    const quiet = card({ item: item({ id: 'quiet', updated_at: '2026-01-05T00:00:00Z' }), changedAt: day(5) })
    const chatty = card({ item: item({ id: 'chatty', updated_at: '2026-01-01T00:00:00Z' }), changedAt: day(6) })
    expect(listRows([quiet, chatty], packages, modules, 'updated').rows.map((r) => r.kind === 'item' && r.card.item.id)).toEqual(['chatty', 'quiet'])
  })
})
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run src/vinnubord/lib/list.test.ts`
Expected: FAIL in the two `updated` tests (the order still follows `updated_at`, which is the same on every card here). The status test may already pass.

- [ ] **Step 3: Edit `list.ts`.** Replace the function `byUpdated` with:

```ts
// Last moved first (CardModel.changedAt), ties by id.
function byChanged(a: CardModel, b: CardModel): number {
  if (a.changedAt !== b.changedAt) return b.changedAt - a.changedAt
  return a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0
}
```

and replace its three uses (`.sort(byUpdated)`) with `.sort(byChanged)`.

- [ ] **Step 4: Edit `ListDrawer.tsx`.** Replace the line

```tsx
        <span className="hg-list-when">{formatStampShort(card.item.updated_at)}</span>
```

with

```tsx
        <span className="hg-list-when">{card.changedAt > 0 ? formatStampShort(new Date(card.changedAt).toISOString()) : ''}</span>
```

- [ ] **Step 5: Verify**

Run: `npx vitest run src/vinnubord/lib/list.test.ts` then `npm run build`
Expected: the file passes, build green. Nothing else needs checking by the implementer.

- [ ] **Step 6: Commit**

```bash
git add src/vinnubord/lib/list.ts src/vinnubord/lib/list.test.ts src/vinnubord/components/ListDrawer.tsx
git commit -m "feat(vinnubord): the list sorts and dates by the last movement" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: The filter

**Files:**
- Modify: `src/vinnubord/lib/filters.ts`
- Modify: `src/vinnubord/lib/filters.test.ts`
- Modify: `src/vinnubord/hooks/useFilter.ts`
- Modify: `src/vinnubord/lib/views.ts` (one line)
- Modify: `src/vinnubord/components/ViewMenu.tsx` (one line)
- Modify: `src/vinnubord/lib/cards.ts` (one line)
- Modify: `src/vinnubord/lib/cards.test.ts`

**Interfaces:**
- Consumes: `CardModel.recent` computed in `cardModels` (task 2).
- Produces: `Filter.recent: boolean`, `toggleRecent(f: Filter): Filter`, the `matches` context field `recent: boolean`, and `FilterApi.toggleRecent(): void`.

- [ ] **Step 1: Change the tests first.** In `filters.test.ts`:

1. Add `toggleRecent,` to the import list from `./filters`, after `toggleFilter,`.
2. Replace every `unread: false, text` with `unread: false, recent: false, text` and every `unread: true, text` with `unread: true, recent: false, text` (replace all, the `ctx` helper on the query test included).
3. In the `withoutPicks` test, make the literal `{ tones: new Set<Tone>(['gold']), packages: new Set(['p']), tags: new Set(['t']), q: 'x', unread: true, recent: true }` and add `expect(r.recent).toBe(true)` after `expect(r.unread).toBe(true)`.
4. Add inside `describe('filters', ...)`, after the unread test:

```ts
  it('recent filter keeps only recently changed items, closed ones too', () => {
    const f = toggleRecent(emptyFilter())
    expect(isActive(f)).toBe(true)
    expect(isActive(toggleRecent(f))).toBe(false)
    expect(matches(item(), { tone: 'gold', packageId: null, unread: false, recent: true, text: '' }, f)).toBe(true)
    expect(matches(item(), { tone: 'gold', packageId: null, unread: false, recent: false, text: '' }, f)).toBe(false)
    expect(matches(item(), { tone: null, packageId: null, unread: false, recent: true, text: '' }, f), 'a closed card').toBe(true)
  })
  it('recent and a tone both have to match', () => {
    const f = toggleFilter(toggleRecent(emptyFilter()), 'tones', 'coral')
    expect(matches(item(), { tone: 'coral', packageId: null, unread: false, recent: true, text: '' }, f)).toBe(true)
    expect(matches(item(), { tone: 'coral', packageId: null, unread: false, recent: false, text: '' }, f)).toBe(false)
    expect(matches(item(), { tone: 'gold', packageId: null, unread: false, recent: true, text: '' }, f)).toBe(false)
  })
```

5. Add inside `describe('filter storage', ...)`, after the `round trips unread` test:

```ts
  it('round trips recent, and a filter stored before it existed has it off', () => {
    expect(parseFilter(serializeFilter(toggleRecent(emptyFilter()))).recent).toBe(true)
    expect(parseFilter('{"recent":"yes"}').recent).toBe(false)
    expect(parseFilter('{"tones":["gold"],"packages":[],"tags":[],"q":"","unread":true}').recent).toBe(false)
  })
```

In `cards.test.ts`, add inside `describe('cardModels', ...)`, after the `changedAt comes from the changed map` test:

```ts
  it('the recent filter dims a card outside the window and keeps a recent closed one', () => {
    const now = Date.parse('2026-11-18T12:00:00Z')
    const changed = new Map([['a', Date.parse('2026-11-18T09:00:00Z')], ['c', Date.parse('2026-11-18T10:00:00Z')]])
    const out = cardModels(
      [item({ id: 'a' }), item({ id: 'b' }), item({ id: 'c', status: 'done', closed_at: '2026-11-18T10:00:00Z' })],
      ctx({ now, changed, recentHours: 24, filter: { ...emptyFilter(), recent: true } }),
    )
    expect(out.map((c) => c.visible)).toEqual([true, false, true])
  })
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run src/vinnubord/lib/filters.test.ts src/vinnubord/lib/cards.test.ts`
Expected: FAIL, `toggleRecent` is not exported.

- [ ] **Step 3: Edit `filters.ts`**

`Filter` gains `recent: boolean` after `unread: boolean`.

```ts
export function emptyFilter(): Filter {
  return { tones: new Set(), packages: new Set(), tags: new Set(), q: '', unread: false, recent: false }
}

export function isActive(f: Filter): boolean {
  return f.tones.size > 0 || f.packages.size > 0 || f.tags.size > 0 || f.q.trim() !== '' || f.unread || f.recent
}
```

In `matches`, the context type becomes `{ tone: Tone | null; packageId: string | null; unread: boolean; recent: boolean; text: string }` and this line goes right after the unread line:

```ts
  if (f.recent && !ctx.recent) return false
```

`serializeFilter` returns:

```ts
  return JSON.stringify({ tones: [...f.tones], packages: [...f.packages], tags: [...f.tags], q: f.q, unread: f.unread, recent: f.recent })
```

In `parseFilter`, after the unread line:

```ts
  if (typeof o.recent === 'boolean') f.recent = o.recent
```

After `toggleUnread`:

```ts
export function toggleRecent(f: Filter): Filter {
  return { ...f, recent: !f.recent }
}
```

The comment above `withoutPicks` becomes:

```ts
// The filter without its package and tag picks, keeping tones, query, unread
// and recent. The same object when there are no picks.
```

- [ ] **Step 4: The three one line edits**

`views.ts`, in `itemsInView`: the `matches` call gets `unread: false, recent: false, text: ''`. Also change the two comments above `viewFilterOf` and `viewFilterJson` to:

```ts
// The filter a view stores. Unknown tones drop, q is empty, unread and recent are off.
```

```ts
// The part of a filter that a view keeps. Never q, unread or recent.
```

`ViewMenu.tsx`, in `save`: `viewFilterJson({ ...draft, q: '', unread: false, recent: false }),`

`cards.ts`, in `cardModels`: the `matches` call becomes

```ts
      matches(item, { tone: bucket !== null ? BUCKET_TONE[bucket] : null, packageId, unread: fresh !== null, recent, text }, filter)
```

(`recent` is the const task 2 added just above `visible`. If it sits below `visible`, move the two task 2 lines above it.)

- [ ] **Step 5: Edit `useFilter.ts`.** Add `toggleRecent as toggleRecentFilter,` to the import from `../lib/filters` after `toggleFilter,`, add after the `toggleUnread` line:

```ts
  const toggleRecent = useCallback(() => update((f) => toggleRecentFilter(f)), [update])
```

and add `toggleRecent` to the returned object after `toggleUnread`.

- [ ] **Step 6: Verify**

Run: `npx vitest run src/vinnubord/lib/filters.test.ts src/vinnubord/lib/cards.test.ts src/vinnubord/lib/views.test.ts` then `npm run build`
Expected: the three files pass, build green. Nothing else needs checking by the implementer.

- [ ] **Step 7: Commit**

```bash
git add src/vinnubord/lib/filters.ts src/vinnubord/lib/filters.test.ts src/vinnubord/hooks/useFilter.ts src/vinnubord/lib/views.ts src/vinnubord/components/ViewMenu.tsx src/vinnubord/lib/cards.ts src/vinnubord/lib/cards.test.ts
git commit -m "feat(vinnubord): recent on the board filter" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: The pill and the window choice

**Files:**
- Modify: `src/vinnubord/components/TopBar.tsx`
- Modify: `src/vinnubord/pages/BoardPage.tsx`
- Modify: `src/vinnubord/vinnubord.css`
- Modify: `src/shared/i18n/locales/en.json`
- Modify: `src/shared/i18n/locales/is.json` (through `npm run translate`, then the exact values below)

**Interfaces:**
- Consumes: `CardModel.recent` (task 2), `FilterApi.toggleRecent` and `Filter.recent` (task 4), `recentWindow` in `BoardPage` (task 2), `RECENT_HOURS`, `RecentHours`, `parseRecentHours` (task 1).
- Produces: the `TopBar` prop `recent: { count: number; hours: RecentHours; onHours: (h: RecentHours) => void }`.

- [ ] **Step 1: `en.json`.** In `vinnubord.board.counts`, after `"unread": "Unread"` (add the comma):

```json
        "recent": "Recently changed"
```

In `vinnubord.top`, after the `"markAllRead"` line:

```json
      "recent": {
        "window": "Recently changed",
        "hours": { "24": "24 hours", "72": "3 days", "168": "7 days" },
        "hint": { "24": "Changed in the last 24 hours", "72": "Changed in the last 3 days", "168": "Changed in the last 7 days" }
      },
```

- [ ] **Step 2: `is.json`.** Copy the translation cache into the worktree first, or every key is retranslated: `cp ../../../src/shared/i18n/locales/.is.cache.json src/shared/i18n/locales/.is.cache.json`. Run `npm run translate`. Check `git diff src/shared/i18n/locales/is.json`: only the eight new keys may differ. Then set their values by hand to exactly these (a hand edit sticks once the key is in the cache):

| Key | Value |
|---|---|
| `vinnubord.board.counts.recent` | `Nýlega breytt` |
| `vinnubord.top.recent.window` | `Nýlega breytt` |
| `vinnubord.top.recent.hours.24` | `24 klst` |
| `vinnubord.top.recent.hours.72` | `3 dagar` |
| `vinnubord.top.recent.hours.168` | `7 dagar` |
| `vinnubord.top.recent.hint.24` | `Hreyft síðasta sólarhringinn` |
| `vinnubord.top.recent.hint.72` | `Hreyft síðustu 3 daga` |
| `vinnubord.top.recent.hint.168` | `Hreyft síðustu 7 daga` |

Copy the cache back so the main checkout knows the new keys: `cp src/shared/i18n/locales/.is.cache.json ../../../src/shared/i18n/locales/.is.cache.json`. If `npm run translate` fails, stop and report it, do not add the keys to `is.json` by hand.

- [ ] **Step 3: `vinnubord.css`.** In the token block, after `--hg-count-pad-phone: 0 11px;`:

```css
  /* The recently changed pill: a clock in place of the dot, no status tone. */
  --hg-count-recent-color: var(--hg-ink-2);
  --hg-count-recent-icon: 14px;
```

After the rule `.hg-count-unread i { ... }`:

```css
/* The recently changed pill: a clock instead of a dot. It carries no tone
   class, the five tones mean status. */
.hg-count-recent { --hg-c: var(--hg-count-recent-color); }
.hg-count-recent.hg-on { --hg-c: var(--hg-ink); }
.hg-count-recent svg {
  width: var(--hg-count-recent-icon); height: var(--hg-count-recent-icon); flex: none; fill: none; stroke: var(--hg-c);
  stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round;
}
```

Widen the two list sort select rules so the window select in the viewer menu shares them. The selectors become:

```css
.hg-list-sort select, .hg-recent-row select {
```

```css
.hg-list-sort select:hover, .hg-list-sort select:focus-visible, .hg-recent-row select:hover, .hg-recent-row select:focus-visible { color: var(--hg-ink); border-color: var(--hg-pill-hover); outline: none; }
```

- [ ] **Step 4: `TopBar.tsx`**

Add the import:

```ts
import { RECENT_HOURS, parseRecentHours, type RecentHours } from '../lib/recent'
```

Add to `Props`, after `counts: Counts`:

```ts
  // The "nýlega breytt" pill: cards moved inside the viewer's window, and the window itself.
  recent: { count: number; hours: RecentHours; onHours: (h: RecentHours) => void }
```

Add `recent,` to the destructured props after `counts,`. Replace the comment above `COUNT_ORDER` with:

```ts
// Pill order: recently changed first (drawn on its own, it is no status), then
// unread, new, waiting on you, waiting on others, in build, on hold.
```

Inside `<div className="hg-counts" ...>`, before `{pills.map(`:

```tsx
        {(recent.count > 0 || f.recent) && (
          <button
            type="button"
            className={`hg-count hg-count-recent${f.recent ? ' hg-on' : ''}`}
            aria-pressed={f.recent}
            title={t(`vinnubord.top.recent.hint.${recent.hours}`)}
            onClick={filter.toggleRecent}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="8" r="6" />
              <path d="M8 4.5V8l2.5 1.5" />
            </svg>
            <b>{recent.count}</b>
            <span>{t('vinnubord.board.counts.recent').toLocaleLowerCase(i18n.language)}</span>
          </button>
        )}
```

Pass the window to the viewer menu: `<ViewerMenu slug={project.slug} projectId={project.id} viewer={viewer} recent={recent} />`, give `ViewerMenu` the parameter `recent` typed `Props['recent']`, and add this row right after the "Merkja allt lesið" button:

```tsx
          <label className="hg-menu-row hg-recent-row">
            <span>{t('vinnubord.top.recent.window')}</span>
            <select value={recent.hours} onChange={(e) => recent.onHours(parseRecentHours(e.target.value))}>
              {RECENT_HOURS.map((h) => (
                <option key={h} value={h}>
                  {t(`vinnubord.top.recent.hours.${h}`)}
                </option>
              ))}
            </select>
          </label>
```

- [ ] **Step 5: `BoardPage.tsx`.** After the `cards` memo:

```ts
  // The number on the "nýlega breytt" pill: every drawn card moved inside the window, filtered or not.
  const recentCount = useMemo(() => cards.filter((c) => c.recent).length, [cards])
```

On `<TopBar`, after `counts={counts}`:

```tsx
        recent={{ count: recentCount, hours: recentWindow.hours, onHours: recentWindow.setHours }}
```

Change the comment above `const picks` to end: `Tones, unread, recent and search show on the pills and in the field.`

- [ ] **Step 6: Verify (the implementer's whole set)**

Commands: `npm run build` and `npm run test`. Expected: build green, every test passes.

Browser, `npm run dev`, route `/p/metta`, signed in as the service user (`HG_SMOKE_EMAIL` and `HG_SMOKE_PASSWORD` in `.env`), at 1440x900, 1280x800 and 390x844. Every check is read only except the window choice, which writes `localStorage` only:

1. The pill is the first in the row, with a clock, a number and "nýlega breytt". If the number would be 0 the pill is hidden: choose "7 dagar" in the viewer menu first.
2. Click it: it lights, cards outside the window dim. Open the list, sort "Síðast breytt": the list count equals the number on the pill, and the dates in the rows fall inside the window.
3. In the viewer menu choose "24 klst": the number does not grow. Reload: the choice is still "24 klst". Set it back to "3 dagar".
4. "Hreinsa" switches the pill off.
5. At 1440 and 1280 the top bar is one row and nothing overlaps (the pill row may scroll sideways). At 390 the pill is first in the scrolling second row.

Nothing else needs checking by the implementer.

- [ ] **Step 7: Commit**

```bash
git add src/vinnubord/components/TopBar.tsx src/vinnubord/pages/BoardPage.tsx src/vinnubord/vinnubord.css src/shared/i18n/locales/en.json src/shared/i18n/locales/is.json
git commit -m "feat(vinnubord): the recently changed pill and its window" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: Docs

**Files:**
- Modify: `CLAUDE.md`
- Create: `docs/progress/18-nylega-breytt.md`

- [ ] **Step 1: `CLAUDE.md`**

1. Current state, first line: replace the test count with the number `npm run test` prints now.
2. The list of progress docs at the end of Current state: add `docs/progress/18-nylega-breytt.md`.
3. Folder structure: add `recent (last movement per item, the recent window)` to the `lib/` line and `useRecentWindow (the recent window per browser)` to the `hooks/` line.
4. Key Patterns, after the bullet "The list reads the same card model as the board", add:

```markdown
- **Last movement is one clock.** `lastChangeByItem` in `lib/recent.ts` gives every item the newest stamp of the item itself (`created_at`, `updated_at`) and of everything on it (chat, files and their replaces, questions and answers, actions with done and edits, plans, rulings), as epoch ms. `BoardPage` computes it once per data load and `cardModels` puts it on the card as `changedAt`, with `recent` (inside the viewer's window against the board clock, so a card leaves on the next data change, not on the minute). The "nýlega breytt" pill (first in the row, drawn on its own because it is no status, `Filter.recent`, combined with every other filter by AND), the list sorts ("Síðast breytt" and the order inside a status bucket) and the date on a list row all read `changedAt`, so they never disagree. The stamp on the board card still reads `updated_at`, because it names who moved the item. Everyone's changes count, the viewer's own included, and a lingering closed card counts. What moves no stamp does not count: a drag, keywords, a file note, a silent tag change, a read mark. The window is 24, 72 (default) or 168 hours, chosen in the viewer menu and stored per browser for every project (`localStorage` `hg.recent`, `useRecentWindow`). Saved views never store it. A plan reorder moves the plan's `updated_at` and so counts, a known and accepted slip.
```

5. Design System, after the Plan 16 paragraph, add:

```markdown
Nýlega breytt (2026-11-18) adds `--hg-count-recent-color|icon` and `.hg-count-recent` (the recently changed pill: a clock svg in place of the dot, no tone class, `--hg-c` set by the class and lifted to `--hg-ink` when on). `.hg-recent-row` is the window row in the viewer menu; its select shares the list sort select rule.
```

- [ ] **Step 2: `docs/progress/18-nylega-breytt.md`** with these sections, in English like the other progress docs: what was built (one paragraph, pointing at the spec and this plan), the numbers (vitest count, `npm run build` green), the review rounds and what they found, what is open, and "What Heimir checks":

1. The pill is first in the row and its number matches the list count when only it is on.
2. Write a message in the chat of an old card: the card lights under the pill and goes to the top of the list sorted "Síðast breytt".
3. Drag a card: it does not become recently changed.
4. The window choice in the menu under your initial: 24 klst, 3 dagar, 7 dagar, kept after a reload.
5. On the phone the pill is first in the row that scrolls sideways.

- [ ] **Step 3: Verify.** `npm run build` green. The controller reads the diff. Nothing else needs checking.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/progress/18-nylega-breytt.md
git commit -m "docs(vinnubord): recently changed" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## After the last task

Final whole branch review on Fable, fix rounds reviewed until one comes back clean. Then merge to main from the main checkout (check `git log` for foreign commits first), `npm run build` and `npm run test` on main, push, remove the worktree. Vercel deploys main.
