# Spjöld og spjall: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The item card shows status, title, module and what matters, with a soft gold glow and one line when something is unread; the item panel gets a Spjall (chat) tab with bubbles in three colours; `item.md` carries the chat so a build session reads and answers it.

**Architecture:** No migration. Everything the card and the chat show is a pure rule in `src/vinnubord/lib/` (`cards.ts` for the card, new `chat.ts` for the rows) fed by `cardModels` in `BoardPage`, so `ItemCard` and the new `ChatTab` only render. The CLI copies the card height rule in `cli/lib/write.mjs` and `parity.test.mjs` pins it to the CSS tokens. The mirror renders a `## Spjall` section and the `/huginn` skill in metta2_new tells the session to read and answer it.

**Tech Stack:** React 19 + TypeScript, vitest, react-i18next, Node ESM CLI, Playwright (`npm run shots:hg`).

**Spec:** `docs/superpowers/specs/2026-11-03-spjold-og-spjall-design.md`

## Global Constraints

- No migration, no new table or column. `hg_unread` already counts `comment.added`.
- **Never a coloured left border, stripe or bar** on a card, bubble or row. Attention is a glow, the author is the bubble colour (spec section 2, and-markmið).
- No em dashes or hyphen dashes as punctuation anywhere: code comments, copy, docs, commit messages. Commas, periods or colons.
- Icelandic UI copy. New i18n keys go in `en.json` by hand under `vinnubord.*`, `npm run translate` regenerates `is.json`, then check the `is.json` diff and correct the Icelandic by hand where needed (keys alphabetical). Status labels stay hard coded Icelandic in `status.ts` (R5).
- Rules below the token block in `vinnubord.css` read only tokens. New values are tokens in `:root`, in the section the spec names.
- Pure logic in `src/vinnubord/lib/` with a vitest file beside it; test files import from `vitest` explicitly.
- Branch `vinnubord-12` off `main`. Commit prefixes `feat(vinnubord):`, `test(vinnubord):`, `docs(vinnubord):`, with the `Co-Authored-By:` trailer of the model that authored the commit.
- `npm run build` and `npm run test` green at the end of every task.
- Implementer budget per task: about 60 tool calls or 150k context, then commit what is green and report DONE_WITH_CONCERNS.
- Model routing (global rules): Tasks 3, 6 and 7 are transcription and go to Sonnet; Tasks 1, 2, 4, 5 and 8 go to Opus. Every task gets a review (Opus), the final whole branch review runs on Fable.

## Review Focus

1. A comment by the viewer themself after someone else's unread comment: the card line must show the other person's comment, not go quiet and not show the viewer's own. Pinned in Task 1 (`freshComment` test "own comment never counts, even when newest").
2. A comment body that is only whitespace lines or starts with blank lines: the card line takes the first non empty line, and an all blank body gives an empty line without crashing. Pinned in Task 1 (`firstLine` tests).
3. A comment whose author is no longer a participant: the chat shows it as `them` with short `?`, and the card line shows `?:`. Pinned in Task 4 (`chatRows` unknown author) and Task 1.
4. The viewer opens the panel on the Staða tab while a new chat message arrives: the Spjall tab dot must light although the panel is open (`chatSeen` reset on a newer foreign comment). Pinned in Task 5 by a manual check in the handover list and by the `latestForeignCommentAt` test in Task 4.
5. `updated_at` exactly 7 days old: the stamp line must agree between web and CLI (`<=` vs `<`). Pinned in Task 1 and Task 3 with the same boundary values (`6 days 23 h` shows, `7 days 1 h` hides) and the parity test on `CARD_STAMP_DAYS`.

## Size table

| Task | Files | Size |
|---|---|---|
| 1 Card model | `src/vinnubord/lib/cards.ts`, `src/vinnubord/lib/cards.test.ts`, `src/vinnubord/pages/BoardPage.tsx` | S |
| 2 Card render, CSS, copy | `src/vinnubord/components/ItemCard.tsx`, `src/vinnubord/components/Board.tsx`, `src/vinnubord/vinnubord.css`, `src/shared/i18n/locales/en.json`, `src/shared/i18n/locales/is.json` | M |
| 3 CLI card height parity | `cli/lib/write.mjs`, `cli/lib/write.test.mjs`, `cli/lib/parity.test.mjs` | S |
| 4 Chat rows | `src/vinnubord/lib/chat.ts` (new), `src/vinnubord/lib/chat.test.ts` (new), `src/shared/lib/dateUtils.ts` | S |
| 5 Chat tab, comment box, panel | `src/vinnubord/components/panel/ChatTab.tsx` (new), `src/vinnubord/components/ItemPanel.tsx`, `src/vinnubord/components/panel/CommentBox.tsx`, `src/vinnubord/vinnubord.css`, `en.json`, `is.json` | M |
| 6 Legend | `src/vinnubord/components/TopBar.tsx`, `src/vinnubord/vinnubord.css`, `en.json`, `is.json` | S |
| 7 Mirror and skill | `cli/lib/mirror.mjs`, `cli/lib/mirror.test.mjs`, `cli/README.md`, `D:/Claude Code/metta2/metta2_new/.claude/skills/huginn/SKILL.md` | S |
| 8 Shots, handover, CLAUDE.md | `scripts/hg-shots.mjs`, `docs/progress/12-spjold-og-spjall.md` (new), `CLAUDE.md` | S |

No L task. Tasks 2 and 5 each touch 5 files but are one component plus its styles and copy; a reviewer judges each as one change.

---

### Task 1: Card model: stamp rule, fresh comment, fresh line

**Files:**
- Modify: `src/vinnubord/lib/cards.ts`
- Modify: `src/vinnubord/lib/cards.test.ts`
- Modify: `src/vinnubord/pages/BoardPage.tsx:96-110`

**Interfaces:**
- Consumes: `readAtOf(reads, itemId, viewerId)` from `lib/reads.ts`; `freshChips(summary, max)` from `lib/reads.ts`; types `Comment`, `Read` from `lib/types.ts`.
- Produces, all exported from `src/vinnubord/lib/cards.ts`:
  - `export const CARD_STAMP_DAYS = 7`
  - `export function showStamp(updatedAt: string | null, now: number): boolean` (true when `updatedAt` parses and `now - Date.parse(updatedAt) <= CARD_STAMP_DAYS * 86_400_000`)
  - `export function firstLine(body: string): string` (first non empty line after `\r\n` and `\r` are normalised, trimmed; `''` when none)
  - `export function freshComment(comments: Comment[], participants: Participant[], itemId: string, viewerId: string, readAt: string | null): { short: string; line: string } | null`
  - `export type FreshLine = { kind: 'created' } | { kind: 'comment'; short: string; line: string } | { kind: 'kinds'; kinds: { kind: UnreadKind; n: number }[]; more: number }`
  - `export function freshLine(summary: UnreadSummary, comment: { short: string; line: string } | null): FreshLine`
  - `CardModel` gains `moduleName: string | null`, `showStamp: boolean`, `freshComment: { short: string; line: string } | null`
  - `CardContext` gains `comments: Comment[]`, `reads: Read[]`, `now: number`

- [ ] **Step 1: Write the failing tests** in `cards.test.ts` (new `describe` blocks after the existing ones; reuse the `item`, `module`, `participant` helpers):

```ts
describe('showStamp', () => {
  const now = Date.parse('2026-11-03T12:00:00Z')
  it('shows within 7 days and hides after', () => {
    expect(showStamp('2026-10-27T13:00:00Z', now)).toBe(true)   // 6 days 23 h
    expect(showStamp('2026-10-27T11:00:00Z', now)).toBe(false)  // 7 days 1 h
    expect(showStamp(null, now)).toBe(false)
    expect(showStamp('not a date', now)).toBe(false)
  })
})

describe('firstLine', () => {
  it('takes the first non empty line, normalised and trimmed', () => {
    expect(firstLine('\r\n  \nSjáumst kl 10\r\nTek iPadinn')).toBe('Sjáumst kl 10')
    expect(firstLine('  \n\n')).toBe('')
  })
})

describe('freshComment', () => {
  const ps = [participant({ user_id: 'me', short: 'H' }), participant({ user_id: 'a', short: 'Á' })]
  const c = (id: string, user: string, at: string, body = 'x') =>
    ({ id, created_at: at, project_id: 'pr', item_id: 'i1', module_id: null, body, user_id: user })
  it('newest foreign comment after the read mark wins', () => {
    const cs = [c('1', 'a', '2026-11-01T10:00:00Z', 'gamalt'), c('2', 'a', '2026-11-03T10:00:00Z', 'nýtt\nlína 2')]
    expect(freshComment(cs, ps, 'i1', 'me', '2026-11-02T00:00:00Z')).toEqual({ short: 'Á', line: 'nýtt' })
  })
  it('own comment never counts, even when newest', () => {
    const cs = [c('1', 'a', '2026-11-03T10:00:00Z', 'frá Árna'), c('2', 'me', '2026-11-03T11:00:00Z', 'mitt')]
    expect(freshComment(cs, ps, 'i1', 'me', null)).toEqual({ short: 'Á', line: 'frá Árna' })
  })
  it('older than the read mark, or on another item, gives null', () => {
    const cs = [c('1', 'a', '2026-11-01T10:00:00Z'), { ...c('2', 'a', '2026-11-03T10:00:00Z'), item_id: 'other' }]
    expect(freshComment(cs, ps, 'i1', 'me', '2026-11-02T00:00:00Z')).toBeNull()
  })
  it('no read mark means every foreign comment is fresh, unknown author is ?', () => {
    const cs = [c('1', 'gone', '2026-11-01T10:00:00Z', 'hæ')]
    expect(freshComment(cs, ps, 'i1', 'me', null)).toEqual({ short: '?', line: 'hæ' })
  })
})

describe('freshLine', () => {
  const summary = (kinds: { kind: UnreadKind; n: number }[], created = false) => ({ created, kinds, latest: '2026-11-03T00:00:00Z' })
  it('created wins over everything', () => {
    expect(freshLine(summary([{ kind: 'comment', n: 1 }], true), { short: 'Á', line: 'x' })).toEqual({ kind: 'created' })
  })
  it('a fresh comment wins over other kinds', () => {
    expect(freshLine(summary([{ kind: 'file', n: 1 }, { kind: 'comment', n: 1 }]), { short: 'Á', line: 'Sjáumst' }))
      .toEqual({ kind: 'comment', short: 'Á', line: 'Sjáumst' })
  })
  it('otherwise the first three kinds and how many more', () => {
    const s = summary([{ kind: 'file', n: 1 }, { kind: 'answer', n: 1 }, { kind: 'status', n: 1 }, { kind: 'plan', n: 1 }])
    expect(freshLine(s, null)).toEqual({ kind: 'kinds', kinds: s.kinds.slice(0, 3), more: 1 })
  })
})
```

And in the existing `cardModels` describe, add:

```ts
it('moduleName, showStamp and freshComment come from the context', () => {
  const now = Date.parse('2026-11-03T12:00:00Z')
  const ctx: CardContext = { ...base, modules: [module({ id: 'm1', name: 'Viðhald' })], comments: [
    { id: 'c', created_at: '2026-11-03T10:00:00Z', project_id: 'pr', item_id: 'i1', module_id: null, body: 'Hæ', user_id: 'other' },
  ], reads: [], now, participants: [...participants, participant({ user_id: 'other', short: 'Á' })] }
  const [m] = cardModels([item({ module_id: 'm1', updated_at: '2026-11-01T00:00:00Z' })], ctx)
  expect(m.moduleName).toBe('Viðhald')
  expect(m.showStamp).toBe(true)
  expect(m.freshComment).toEqual({ short: 'Á', line: 'Hæ' })
  expect(cardModels([item({ updated_at: '2026-10-01T00:00:00Z' })], ctx)[0]).toMatchObject({ moduleName: null, showStamp: false })
})
```

`base` is whatever the existing tests call their shared `CardContext`; extend it with `comments: [], reads: [], now: Date.now()`.

- [ ] **Step 2: Run** `npx vitest run src/vinnubord/lib/cards.test.ts`. Expected: FAIL, `showStamp`, `firstLine`, `freshComment`, `freshLine` not exported and `moduleName` undefined.

- [ ] **Step 3: Implement** the four functions and the three new `CardModel` fields in `cards.ts`. `freshComment`: filter `comments` by `item_id === itemId` and `user_id !== viewerId` and (`readAt === null` or `Date.parse(created_at) > Date.parse(readAt)`), take the one with the greatest `created_at`, short from `participants` else `'?'`, `line: firstLine(body)`. `freshLine`: `created` first, then `comment !== null`, else `freshChips(summary)` mapped to `{ kind: 'kinds', kinds: shown, more }`. In `cardModels`: `moduleName` from `ctx.modules` by `item.module_id` (`name`), `showStamp: showStamp(item.updated_at, ctx.now)`, `freshComment: freshComment(ctx.comments, ctx.participants, item.id, ctx.viewerId, readAtOf(ctx.reads, item.id, ctx.viewerId))`.

- [ ] **Step 4: Wire `BoardPage`**: add `comments: data.comments`, `reads: data.reads`, `now: Date.now()` to the `cardModels` call at `BoardPage.tsx:100-107`. `now` inside the `useMemo` is fine: the memo reruns on every data change, and the 7 day boundary does not need a timer.

- [ ] **Step 5: Run** `npx vitest run src/vinnubord/lib/cards.test.ts` and `npm run build`. Expected: PASS, build green (nothing reads the new fields yet).

- [ ] **Step 6: Commit** `feat(vinnubord): card model carries module name, stamp rule and fresh comment`.

---

### Task 2: Card render, glow, fresh line, tokens, copy

**Files:**
- Modify: `src/vinnubord/components/ItemCard.tsx`
- Modify: `src/vinnubord/components/Board.tsx:871-891`
- Modify: `src/vinnubord/vinnubord.css` (tokens at `:root` "Item cards" block near line 91-145; rules near 686-750)
- Modify: `src/shared/i18n/locales/en.json`, `src/shared/i18n/locales/is.json`

**Interfaces:**
- Consumes: `CardModel.moduleName`, `.showStamp`, `.freshComment` and `freshLine(summary, comment)` from Task 1.
- Produces: `ItemCard` props `moduleName: string | null`, `showStamp: boolean`, `freshComment: { short: string; line: string } | null` (the `fresh` prop stays). Classes `.hg-card-module`, `.hg-card-new`; `.hg-card-ring` is gone.

- [ ] **Step 1: Tokens.** In the "Item cards" block add, after `--hg-card-chips-gap`:

```
--hg-card-module-gap: 4px;
--hg-card-new-size: 28px;
--hg-card-new-spread: 2px;
--hg-card-new-border: color-mix(in oklab, var(--hg-gold) 45%, var(--hg-line));
--hg-card-new-ring: color-mix(in oklab, var(--hg-gold) 25%, transparent);
--hg-card-new-color: color-mix(in oklab, var(--hg-gold) 22%, transparent);
```

Remove `--hg-ring-size`, `--hg-ring-offset`, `--hg-ring-border`, `--hg-ring-glow` (lines 126-129) and the `.hg-card-ring` rule (734-738). `grep -n "hg-ring" src` must return nothing afterwards. `--hg-card-glow` (the dot blur) stays.

- [ ] **Step 2: Rules.** Replace `.hg-card-fresh` and `.hg-card-fresh span` with:

```
.hg-card-module {
  margin-top: var(--hg-card-module-gap); font-size: var(--hg-card-by-size); color: var(--hg-ink-3); line-height: 1.3;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.hg-card-new {
  border-color: var(--hg-card-new-border);
  box-shadow: 0 0 0 1px var(--hg-card-new-ring), 0 0 var(--hg-card-new-size) var(--hg-card-new-spread) var(--hg-card-new-color), var(--hg-card-shadow);
}
/* The one line under the hairline that says what is new since the viewer last opened the card. */
.hg-card-fresh {
  margin-top: var(--hg-card-plans-gap); padding-top: var(--hg-card-plan-label-gap); border-top: 1px dashed var(--hg-line);
  font-size: var(--hg-chip-size); color: var(--hg-gold); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.hg-card-fresh b { font-weight: 800; }
```

Check that `.hg-card-lift` and `.hg-card:hover` set `box-shadow` later in the file (they do, through `--hg-card-lift-shadow`), so a lifted card keeps the lift shadow over the glow. If `.hg-card-lift` is declared before `.hg-card-new` in the file, move `.hg-card-new` above it.

- [ ] **Step 3: `ItemCard`.** Props: add `moduleName`, `showStamp`, `freshComment`. Render order per spec 4.1: status row, title, `{moduleName && <div className="hg-card-module">{moduleName}</div>}`, the `.hg-card-by` row only when `mover && showStamp`, chips without tags (the `item.tags.map` goes, the wrapper condition becomes `fileCount > 0 || actionsOpen > 0 || actionsMine > 0`), plans, then `{fresh && <FreshLine line={freshLine(fresh, freshComment)} />}`. Remove the `.hg-card-ring` span. Add `fresh !== null ? 'hg-card-new' : ''` to `cls`. `FreshLine` renders: `created` as `<b>{t('vinnubord.card.fresh.created')}</b>`; `comment` as `<b>{short}:</b> {line}`; `kinds` as the kind strings joined with `', '` plus `' +N'` from `t('vinnubord.card.fresh.more', { count })` when `more > 0`, no "Síðan síðast:" prefix.

- [ ] **Step 4: `Board.tsx`.** Pass `moduleName={c.moduleName}`, `showStamp={c.showStamp}`, `freshComment={c.freshComment}` at the `<ItemCard` call (line 871).

- [ ] **Step 5: Copy.** In `en.json` under `vinnubord.card`: remove `fresh.since`; keep `fresh.created`, `fresh.more`, `fresh.kinds.*`. Remove `vinnubord.card.unread` if nothing else uses it (`grep -rn "card.unread" src`). Run `npm run translate`, check the `is.json` diff.

- [ ] **Step 6: Verify.** `npm run build`, `npm run test` green. `npm run dev`, open metta: a card with unread shows the gold glow and one line, a quiet card has no glow, no card shows tags, a card older than 7 days has no date row, the module name sits under the title in one line. Verification set: the board at 1280 px wide, desktop only; nothing else needs checking by the implementer.

- [ ] **Step 7: Commit** `feat(vinnubord): card shows module, glow and one fresh line, no tags`.

---

### Task 3: CLI card height parity

**Files:**
- Modify: `cli/lib/write.mjs` (`CSS_TOKENS` at 274, `base` at 312, `estimateCardHeight` at 374)
- Modify: `cli/lib/write.test.mjs:314-327`
- Modify: `cli/lib/parity.test.mjs`

**Interfaces:**
- Consumes: `CARD_STAMP_DAYS` and `showStamp` from `src/vinnubord/lib/cards.ts` (the parity test imports the TS directly, as it does `status.ts`).
- Produces: `export const CARD_STAMP_DAYS = 7` in `write.mjs`; `estimateCardHeight(item, board = {}, now = Date.now())`; `base.cardBySize` (12, token `card-by-size`), `base.cardModuleGap` (4, token `card-module-gap`).

- [ ] **Step 1: Tests.** In `write.test.mjs` `describe('estimateCardHeight')` replace the chips assertion and add:

```js
it('ignores tags, counts the module line and the stamp row only within 7 days', () => {
  const now = Date.parse('2026-11-03T12:00:00Z')
  const quiet = estimateCardHeight({ id: 'x', title: 'Stutt', tags: [], updated_at: '2026-10-01T00:00:00Z' }, {}, now)
  const tagged = estimateCardHeight({ id: 'x', title: 'Stutt', tags: ['a', 'b', 'c'], updated_at: '2026-10-01T00:00:00Z' }, {}, now)
  const withModule = estimateCardHeight({ id: 'x', title: 'Stutt', tags: [], module_id: 'm', updated_at: '2026-10-01T00:00:00Z' }, {}, now)
  const recent = estimateCardHeight({ id: 'x', title: 'Stutt', tags: [], updated_at: '2026-10-27T13:00:00Z' }, {}, now)
  const edge = estimateCardHeight({ id: 'x', title: 'Stutt', tags: [], updated_at: '2026-10-27T11:00:00Z' }, {}, now)
  expect(tagged).toBe(quiet)
  expect(withModule).toBeGreaterThan(quiet)
  expect(recent).toBeGreaterThan(quiet)
  expect(edge).toBe(quiet)
})
```

In `parity.test.mjs` add to the sizes describe:

```js
it('the card stamp rule matches the web', () => {
  expect(CARD_STAMP_DAYS).toBe(webCards.CARD_STAMP_DAYS)
})
```

with `import * as webCards from '../../src/vinnubord/lib/cards.ts'` and `CARD_STAMP_DAYS` imported from `./write.mjs`. The existing token loop covers `cardBySize` and `cardModuleGap` once they are in `CSS_TOKENS`.

- [ ] **Step 2: Run** `npx vitest run cli/lib/write.test.mjs cli/lib/parity.test.mjs`. Expected: FAIL.

- [ ] **Step 3: Implement.** `CSS_TOKENS`: add `cardBySize: 'card-by-size'`, `cardModuleGap: 'card-module-gap'`. `base`: `cardBySize: 12`, `cardModuleGap: 4`. `export const CARD_STAMP_DAYS = 7`. In `estimateCardHeight(item, board = {}, now = Date.now())`: after the title, `if (item.module_id) h += S.cardModuleGap + S.cardBySize * LH_CARD`; the `h += S.cardStGap + S.avSize` line only when `item.updated_at` parses and `now - Date.parse(item.updated_at) <= CARD_STAMP_DAYS * 86_400_000`; `const chips = []` (no tags), the rest as is. `placeItem` passes nothing new (`now` defaults).

- [ ] **Step 4: Run** the two test files and `npm run test`. Expected: PASS.

- [ ] **Step 5: Commit** `feat(vinnubord): CLI card height follows the new card`.

---

### Task 4: Chat rows

**Files:**
- Create: `src/vinnubord/lib/chat.ts`, `src/vinnubord/lib/chat.test.ts`
- Modify: `src/shared/lib/dateUtils.ts`

**Interfaces:**
- Consumes: `Comment`, `Participant` from `lib/types.ts`.
- Produces:
  - `dateUtils.ts`: `export function formatDay(dateString: string, now: Date = new Date()): string` ("í dag" via `dates.today`, "í gær" via a new key `dates.yesterday`, else the day and month as `formatStamp` does for an older date, with the year when it differs).
  - `chat.ts`:
    - `export type ChatWho = 'me' | 'them' | 'claude'`
    - `export type ChatRow = { type: 'day'; key: string; at: string } | { type: 'new'; key: 'new' } | { type: 'message'; key: string; id: string; who: ChatWho; short: string; name: string; body: string; at: string | null; fresh: boolean }`
    - `export function chatRows(comments: Comment[], participants: Participant[], itemId: string, viewerId: string, fresh: (at: string | null, by: string | null) => boolean): ChatRow[]`
    - `export function latestForeignCommentAt(comments: Comment[], itemId: string, viewerId: string): string | null`
  - The day row carries `at` (the first message's stamp) and the component formats it with `formatDay`, so `chat.ts` stays free of i18n.

- [ ] **Step 1: Tests** in `chat.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { chatRows, latestForeignCommentAt } from './chat'
import type { Comment, Participant } from './types'

const ps: Participant[] = [
  { id: 'p1', created_at: null, project_id: 'pr', user_id: 'me', display_name: 'Heimir', short: 'H', is_service: false },
  { id: 'p2', created_at: null, project_id: 'pr', user_id: 'a', display_name: 'Árni', short: 'Á', is_service: false },
  { id: 'p3', created_at: null, project_id: 'pr', user_id: 'c', display_name: 'Claude', short: 'C', is_service: true },
]
const c = (id: string, user: string, at: string, body = id): Comment =>
  ({ id, created_at: at, project_id: 'pr', item_id: 'i1', module_id: null, body, user_id: user })
const never = () => false

describe('chatRows', () => {
  it('orders by time, one day row per day, who by viewer and service', () => {
    const rows = chatRows([c('2', 'me', '2026-10-31T11:42:00Z'), c('1', 'a', '2026-10-31T11:20:00Z'), c('3', 'c', '2026-11-03T16:05:00Z')], ps, 'i1', 'me', never)
    expect(rows.map((r) => r.type)).toEqual(['day', 'message', 'message', 'day', 'message'])
    expect(rows.filter((r) => r.type === 'message').map((r) => r.type === 'message' && r.who)).toEqual(['them', 'me', 'claude'])
  })
  it('puts one new row before the first fresh message', () => {
    const fresh = (at: string | null) => at !== null && at >= '2026-11-02'
    const rows = chatRows([c('1', 'a', '2026-11-01T10:00:00Z'), c('2', 'a', '2026-11-03T10:00:00Z'), c('3', 'a', '2026-11-03T11:00:00Z')], ps, 'i1', 'me', fresh)
    expect(rows.map((r) => r.type)).toEqual(['day', 'message', 'day', 'new', 'message', 'message'])
    expect(rows.filter((r) => r.type === 'new')).toHaveLength(1)
  })
  it('skips other items, unknown author is them with ?', () => {
    const rows = chatRows([{ ...c('1', 'a', '2026-11-01T10:00:00Z'), item_id: 'x' }, c('2', 'gone', '2026-11-01T10:00:00Z')], ps, 'i1', 'me', never)
    expect(rows).toHaveLength(2)
    expect(rows[1]).toMatchObject({ who: 'them', short: '?', name: '?' })
  })
  it('a null created_at sorts first and gets no day row of its own', () => {
    const rows = chatRows([{ ...c('1', 'a', '2026-11-01T10:00:00Z'), created_at: null }, c('2', 'a', '2026-11-01T10:00:00Z')], ps, 'i1', 'me', never)
    expect(rows.map((r) => r.type)).toEqual(['message', 'day', 'message'])
  })
})

describe('latestForeignCommentAt', () => {
  it('newest comment on the item by someone else, null when none', () => {
    const cs = [c('1', 'a', '2026-11-01T10:00:00Z'), c('2', 'me', '2026-11-03T10:00:00Z'), { ...c('3', 'a', '2026-11-04T10:00:00Z'), item_id: 'x' }]
    expect(latestForeignCommentAt(cs, 'i1', 'me')).toBe('2026-11-01T10:00:00Z')
    expect(latestForeignCommentAt(cs, 'y', 'me')).toBeNull()
  })
})
```

- [ ] **Step 2: Run** `npx vitest run src/vinnubord/lib/chat.test.ts`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement** `chat.ts` as the interfaces say. Day rows compare `new Date(at).toDateString()`; `key` for a day row is `day:<toDateString>`, for a message `m:<id>`. `who`: `user_id === viewerId` then `me`, else participant `is_service` then `claude`, else `them`. The new row is inserted once, before the first message with `fresh(created_at, user_id)` true, after that message's day row. `formatDay` in `dateUtils.ts`: today, yesterday (`now` minus one day, same `toDateString` test), else `formatStamp`'s date branch. Add `"yesterday": "yesterday"` to `dates` in `en.json` and run `npm run translate` (expect "í gær").

- [ ] **Step 4: Run** the test file and `npm run build`. Expected: PASS.

- [ ] **Step 5: Commit** `feat(vinnubord): chat rows and formatDay`.

---

### Task 5: Chat tab, comment box, panel wiring

**Files:**
- Create: `src/vinnubord/components/panel/ChatTab.tsx`
- Modify: `src/vinnubord/components/ItemPanel.tsx`
- Modify: `src/vinnubord/components/panel/CommentBox.tsx`
- Modify: `src/vinnubord/vinnubord.css` (new "Chat" token section after the "Status tab, files, questions and history" block; rules after `.hg-compose` near line 1079; the `pointer: coarse` block at 492)
- Modify: `en.json`, `is.json`

**Interfaces:**
- Consumes: `chatRows`, `latestForeignCommentAt` (Task 4), `formatDay`, `formatStamp`.
- Produces: `ChatTab` props `{ itemId: string; comments: Comment[]; participants: Participant[]; viewerId: string; fresh: (at: string | null, by: string | null) => boolean; active: boolean; bodyRef: RefObject<HTMLDivElement | null> }`. `CommentBox` gains `onSent?: () => void`. `ItemPanel` `Tab` union gains `'chat'`, `TABS = ['status', 'chat', 'files', 'questions', 'history']`.

- [ ] **Step 1: Tokens** (new section `/* ---------- Chat ---------- */` after the history tokens, before `/* Markdown reader */`):

```
--hg-msg-radius: 16px;
--hg-msg-tail-radius: 6px;
--hg-msg-max-w: 82%;
--hg-msg-pad: 10px 13px;
--hg-msg-size: 14px;
--hg-msg-gap: 10px;
--hg-msg-who-size: 11px;
--hg-msg-them-bg: #1d2838;
--hg-msg-me-bg: #2f5f94;
--hg-msg-claude-bg: #4a3566;
--hg-msg-claude-glow: 0 0 22px -4px rgba(216, 164, 255, 0.35);
--hg-chat-day-size: 11px;
--hg-chat-day-gap: 6px 0 2px;
--hg-pn-tab-dot: 7px;
```

In the `pointer: coarse` block: `--hg-msg-claude-glow: none;`.

- [ ] **Step 2: Rules** (after `.hg-compose .hg-pn-error`):

```
.hg-chat { display: flex; flex-direction: column; gap: var(--hg-msg-gap); }
.hg-chat-day { text-align: center; font-size: var(--hg-chat-day-size); color: var(--hg-ink-3); margin: var(--hg-chat-day-gap); }
.hg-chat-new { display: flex; align-items: center; gap: var(--hg-pn-list-gap); font-size: var(--hg-chat-day-size); font-weight: 800; color: var(--hg-gold); }
.hg-chat-new::before, .hg-chat-new::after { content: ''; flex: 1; height: 1px; background: color-mix(in oklab, var(--hg-gold) 40%, transparent); }
.hg-chat-empty { text-align: center; color: var(--hg-ink-3); }
.hg-msg { max-width: var(--hg-msg-max-w); display: flex; flex-direction: column; gap: 3px; align-self: flex-start; }
.hg-msg-me { align-self: flex-end; align-items: flex-end; }
.hg-msg-body {
  padding: var(--hg-msg-pad); border-radius: var(--hg-msg-radius); font-size: var(--hg-msg-size); line-height: 1.4; color: var(--hg-ink);
  white-space: pre-wrap; overflow-wrap: anywhere; border-bottom-left-radius: var(--hg-msg-tail-radius); background: var(--hg-msg-them-bg);
}
.hg-msg-me .hg-msg-body { border-bottom-left-radius: var(--hg-msg-radius); border-bottom-right-radius: var(--hg-msg-tail-radius); background: var(--hg-msg-me-bg); }
.hg-msg-claude .hg-msg-body { background: var(--hg-msg-claude-bg); box-shadow: var(--hg-msg-claude-glow); }
.hg-msg-body a { color: inherit; text-decoration: underline; }
.hg-msg-who { font-size: var(--hg-msg-who-size); color: var(--hg-ink-3); padding: 0 6px; }
.hg-pn-tab-dot {
  display: inline-block; width: var(--hg-pn-tab-dot); height: var(--hg-pn-tab-dot); border-radius: 50%; margin-left: 5px;
  vertical-align: middle; background: var(--hg-gold); box-shadow: 0 0 8px var(--hg-gold);
}
```

- [ ] **Step 3: `ChatTab`.** Renders `chatRows(...)` inside `<div className="hg-chat">`: a day row as `<div className="hg-chat-day">{formatDay(at)}</div>`, the new row as `<div className="hg-chat-new">{t('vinnubord.chat.new')}</div>`, a message as `<div className={`hg-msg hg-msg-${who}`}><div className="hg-msg-body">{linkify(body)}</div><div className="hg-msg-who">{who === 'me' ? t('vinnubord.chat.you') : name}, {at ? formatStamp(at) : ''}</div></div>`. Empty: `<p className="hg-chat-empty">{t('vinnubord.chat.empty')}</p>`. `linkify` is a local function: split the body on `/(https?:\/\/[^\s<>"']+)/g`, odd parts become `<a href target="_blank" rel="noopener noreferrer">`, no other markup. Scroll: a `useEffect` on `[active, rows.length]` that, when `active`, runs after paint (`requestAnimationFrame`) and sets `bodyRef.current.scrollTop` to the `.hg-chat-new` element's `offsetTop` minus `bodyRef.current.offsetTop` when the new row exists, else to `scrollHeight`; a second effect on `[rows.length]` only scrolls to the bottom when `active` and the body was within 40 px of the bottom before the change (read in a ref on every scroll event of the body while active). `hidden` tabs have no layout, so measuring happens only when `active` is true.

- [ ] **Step 4: `ItemPanel`.** Add `'chat'` to `Tab` and `TABS` (second). `choose(next)`: for `chat` do not reset `scrollTop` (ChatTab sets it); for the others reset to 0 as now. Tab label `t('vinnubord.panel.tabs.chat')` plus `{chatDot && <i className="hg-pn-tab-dot" aria-hidden="true" />}` and `aria-label` with `t('vinnubord.chat.unreadTab')` when lit. `chatDot` state: `const [chatSeen, setChatSeen] = useState(false)`; `foreignCommentAt = latestForeignCommentAt(data.comments, item.id, viewerId)`; an effect on `[foreignCommentAt]` sets `chatSeen(false)` when `tab !== 'chat'` and `fresh(foreignCommentAt, null)`; choosing `chat` sets `chatSeen(true)`; `chatDot = !chatSeen && comments.some((c) => fresh(c.created_at, c.user_id))`. Render `<ChatTab itemId={item.id} comments={data.comments} participants={data.participants} viewerId={viewerId} fresh={fresh} active={tab === 'chat'} bodyRef={bodyRef} />` in its own `role="tabpanel"` div like the others. `CommentBox` gets `onSent={() => choose('chat')}`.

- [ ] **Step 5: `CommentBox`.** Add prop `onSent?: () => void`, called after a successful send. Key rule: `const fine = window.matchMedia('(pointer: fine)').matches` read once in a `useState` initialiser; `onKeyDown`: Ctrl or Cmd+Enter sends everywhere; plain Enter without Shift sends only when `fine`; otherwise the default (newline). Placeholder key stays `vinnubord.panel.comment.placeholder`, text becomes "Write a message"; hint becomes two keys `vinnubord.panel.comment.hintFine` ("Enter sends, Shift and Enter for a new line") and `vinnubord.panel.comment.hintCoarse` ("Send with the button"), chosen by `fine`.

- [ ] **Step 6: Copy.** `en.json`: `vinnubord.panel.tabs.chat: "Chat"`, `vinnubord.chat.{you: "You", new: "new", empty: "No messages yet", unreadTab: "Chat, unread messages"}`, the comment keys from Step 5, `vinnubord.history.commentAdded: "wrote in the chat"`. `npm run translate`; in `is.json` make sure the tab reads "Spjall", the you line "Þú", the history line "skrifaði í spjallið", the placeholder "Skrifa skilaboð".

- [ ] **Step 7: Verify.** `npm run build`, `npm run test` green. `npm run dev`: open a card with comments, the Spjall tab shows bubbles (own blue right, others grey left, Claude violet left), day rows, the "nýtt" row before the first unread message, the tab dot before the tab is opened and gone after, Enter sends on the desktop and the tab switches to Spjall on send from Staða. Open the same card as the sandbox or a second account is not possible here; the realtime dot (Review Focus 4) goes on Heimir's hand check list. Verification set: the panel at 1280 px and in the phone emulation of Chrome devtools (390 px, touch) for the Enter rule; nothing else.

- [ ] **Step 8: Commit** `feat(vinnubord): Spjall tab with bubbles, Enter sends, tab dot`.

---

### Task 6: Colour legend in the viewer menu

**Files:**
- Modify: `src/vinnubord/components/TopBar.tsx:308-321` (`ViewerMenu`)
- Modify: `src/vinnubord/vinnubord.css` (rules near `.hg-menu-sep` at 1325)
- Modify: `en.json`, `is.json`

**Interfaces:**
- Consumes: nothing new. Tone class names `hg-tone-*` as the cards use them.
- Produces: `.hg-legend`, `.hg-legend-dot`.

- [ ] **Step 1: Markup.** Between the "Merkja allt lesið" button and the `.hg-menu-row` language row insert:

```tsx
<div className="hg-menu-sep" />
<ul className="hg-legend" aria-label={t('vinnubord.top.legend.title')}>
  {LEGEND.map(([tone, key]) => (
    <li key={tone} className={`hg-tone-${tone}`}><i className="hg-legend-dot" aria-hidden="true" />{t(`vinnubord.top.legend.${key}`)}</li>
  ))}
</ul>
<div className="hg-menu-sep" />
```

with `const LEGEND: [Tone, string][] = [['gold', 'gold'], ['coral', 'coral'], ['lilac', 'lilac'], ['teal', 'teal'], ['stone', 'stone']]` at module level (`Tone` from `lib/status`).

- [ ] **Step 2: CSS.**

```
.hg-legend { list-style: none; margin: 0; padding: 0 var(--hg-control-gap); display: flex; flex-direction: column; gap: var(--hg-control-gap); font-size: var(--hg-chip-size); color: var(--hg-ink-2); }
.hg-legend li { display: flex; align-items: center; gap: var(--hg-card-row-gap); }
.hg-legend-dot { width: var(--hg-card-dot); height: var(--hg-card-dot); border-radius: 50%; background: var(--hg-c); box-shadow: 0 0 var(--hg-card-glow) var(--hg-c); flex: none; }
```

Confirm `--hg-control-gap` exists (it is used by `.hg-menu-sep`); otherwise use the token `.hg-menu` rows use for spacing.

- [ ] **Step 3: Copy.** `en.json` `vinnubord.top.legend`: `{ title: "Colours", gold: "New, or waiting for Claude", coral: "Waiting for you", lilac: "Waiting for others", teal: "Ready or building", stone: "Parked or done" }`. `npm run translate`; check Icelandic: "Litir", "Nýtt, eða bíður Claude", "Bíður þín", "Bíður annarra", "Tilbúið eða í smíðum", "Parkerað eða lokið".

- [ ] **Step 4: Verify** `npm run build` green; open the viewer menu, five lines with dots in the five tones in that order. Verification set: the top bar at 1280 px; nothing else.

- [ ] **Step 5: Commit** `feat(vinnubord): colour legend in the viewer menu`.

---

### Task 7: Mirror Spjall section, CLI README, skill

**Files:**
- Modify: `cli/lib/mirror.mjs:273-293` (after the Spurningar block, before `## Skrár`), `renderItemMd` signature's `extra`
- Modify: `cli/lib/mirror.test.mjs` (`fullBoard` at 103, `describe('renderItemMd')` at 414), `itemTargets` call at 336
- Modify: `cli/README.md:96`
- Modify: `D:/Claude Code/metta2/metta2_new/.claude/skills/huginn/SKILL.md` (Lotustart step 4 near line 37, "Að haka við" list near line 79-84, Lotulok list near line 86-100)

**Interfaces:**
- Consumes: `person`, `iso`, `multiLine` helpers already in `mirror.mjs`.
- Produces: `renderItemMd(..., extra)` reads `extra.comments` (default `[]`); `itemTargets` passes `comments: data.comments ?? []`.

- [ ] **Step 1: Tests** in `describe('renderItemMd')`:

```js
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
  expect(renderFull(fullBoard()).md).not.toContain('## Spjall')
})
```

Add `comments: []` to the `board()` helper's defaults if it lacks it, and `'comments'` to the shuffled keys in the "same output twice" test.

- [ ] **Step 2: Run** `npx vitest run cli/lib/mirror.test.mjs`. Expected: FAIL.

- [ ] **Step 3: Implement.** In `renderItemMd`, after the questions block: `const chat = (extra.comments ?? []).filter((c) => c.item_id === item.id).sort(byCreated)`; when non empty push `'## Spjall', ''`, then per comment `- ${iso(c.created_at)} ${person(c.user_id, participants)}: ${first}` where `first` is the first line of `multiLine(c.body)` and every following line is pushed prefixed with two spaces, then `''`. In `itemTargets` pass `comments: data.comments ?? []`. The "brief signature" test (line 434) calls `renderItemMd` directly without comments and still matches because `fullBoard()` has none.

- [ ] **Step 4: Run** `npm run test`. Expected: PASS.

- [ ] **Step 5: README and skill.** `cli/README.md` line 96 (item.md): add "spjall (skilaboð í tímaröð)" to the list before "og skráalisti". In `SKILL.md`: Lotustart step 4, after "(lýsing, Hvar erum við, plön, svör)" add "og `## Spjall`: spurning til Claude í spjallinu er beiðni eins og spurning í Spurningar, en henni er svarað með `huginn comment add <id> --body \"...\"`, ekki með `question answer`." In "Að haka við" add a bullet: "- Skilaboð í spjalli: `huginn comment add <id> --body \"...\"`. Eitt skilaboð, stutt, þegar lotan kláraði eða svaraði einhverju sem Heimir eða Árni spurðu um þar. Annars ekkert, handtökin og samantektin segja stöðuna." Commit the skill change in the metta2_new repo with `docs(huginn): skill reads and answers the chat` (separate repo, separate commit; do not push metta2_new, Heimir's build session there pushes with its next work. Report the uncommitted or unpushed state in the handover).

- [ ] **Step 6: Commit** (Huginn repo) `feat(vinnubord): item.md carries the chat`.

---

### Task 8: Phone shot, handover, CLAUDE.md

**Files:**
- Modify: `scripts/hg-shots.mjs:140-210`
- Create: `docs/progress/12-spjold-og-spjall.md`
- Modify: `CLAUDE.md` (Current state list, Design System classes and tokens, Key Patterns, lib and components listings)

- [ ] **Step 1: Shot.** After `shot('9-list-pick')` and before the final Escape: `await page.locator('.hg-pn-tab', { hasText: 'Spjall' }).click(); await page.waitForTimeout(600); await shot('10-chat')`. Run `npm run build && npm run preview` in one terminal and `SITE=http://localhost:4173 npm run shots:hg phone` in another; `.playwright-mcp/shots/phone-10-chat.png` exists and shows the chat tab. If the picked card has no comments the shot shows "Engin skilaboð enn", which is fine.

- [ ] **Step 2: Handover** `docs/progress/12-spjold-og-spjall.md` in the format of `11-skjal-uppfaert.md`: what each task built with commits, verification run, and "Heimir athugar" list: glow on a card Árni touched, the card line with Árni's first line, Spjall tab dot lighting while the panel is open on Staða and Árni writes, Enter on the phone gives a newline, `huginn sync` in metta2_new writes `## Spjall`.

- [ ] **Step 3: CLAUDE.md.** Add Plan 12 to Current state (one paragraph like the others, test count from `npm run test`). Design System: replace the `.hg-card-ring` and `.hg-card-fresh` descriptions with `.hg-card-new` (gold glow), `.hg-card-fresh` (one line), `.hg-card-module`; add the chat classes and the "Chat" token section, `--hg-msg-claude-glow` in the coarse block, `.hg-legend`. Key Patterns: a line under "Unread comes from events" that the card glow is `fresh !== null` and the line prefers an unread comment; a line that `item.md` carries `## Spjall` and the skill answers there. Folder structure: `chat` in `lib/`, `ChatTab` in `components/panel/`. Board sizes line: `cardBySize`, `cardModuleGap`, `CARD_STAMP_DAYS` in parity.

- [ ] **Step 4: Commit** `docs(vinnubord): plan 12 handover, shots and CLAUDE.md`.

## After the tasks

Final whole branch review on Fable, fix round reviewed again until clean (global rule). Then merge to `main`, check the repo is clean and not behind `origin`, push (Claude pushes, never Heimir). Vercel deploys `main`. The metta2_new skill commit stays local until that repo's next push; the handover says so.
