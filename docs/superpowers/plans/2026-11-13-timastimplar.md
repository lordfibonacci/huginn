# Tímastimplar: the clock on every stamp

Date: 2026-11-13. Small task profile (5 code files, about 80 changed lines, no migration, one verification set). Planned and built in the same Fable session on Heimir's word.

## Why

A stamp shows the clock only when it is from today ("í dag 10:15"). Anything older shows the date alone ("12. nóvember"), so Heimir cannot see when yesterday something moved.

## Rule

Two forms, both in `src/shared/lib/dateUtils.ts`:

- `formatStamp`: always with the clock. "í dag 10:15", "í gær 14:32", "11. nóvember, 23:59", "30. október 2025, 16:05" (the comma came in the fix round, see Niðurstaða; the code blocks in 1a and 1b below are the first build and show the form without it). Used everywhere in the panels and on the settings page (history, actions, files, questions, the "Síðast hreyft" line, module comments, the context bundle stamp). Those call sites do not change, they get the clock through the function.
- `formatStampShort`: the clock today and yesterday, an older day is the date alone. Used where the row is tight: the board card, the list row and the closed item row in the module panel. Since the final review also the stamp beside an action (`ActionList.tsx:76`), see Niðurstaða; the edit line under it keeps the long form.

`formatDay` (the chat day row) keeps its output and shares the new helper.

No new i18n key (`dates.today` and `dates.yesterday` exist), no CSS, no token, no CLI change (the card stamp row keeps its height, so `parity.test.mjs` is untouched).

## Size table

| Task | Files | Size |
|---|---|---|
| 1. Stamp functions, tests, three call sites | `src/shared/lib/dateUtils.ts`, `src/shared/lib/dateUtils.test.ts` (new), `src/vinnubord/components/ItemCard.tsx`, `src/vinnubord/components/ListDrawer.tsx`, `src/vinnubord/components/ModulePanel.tsx` | S |
| 2. Docs | `CLAUDE.md` | S |

## Task 1: stamp functions, tests, call sites

### 1a. `src/shared/lib/dateUtils.test.ts` (new file, write it first and see it fail)

```ts
import { describe, it, expect, vi } from 'vitest'
import { formatStamp, formatStampShort } from './dateUtils'

// dateUtils reads i18n; a stub keeps the test free of the browser language detector.
vi.mock('../i18n', () => ({ default: { language: 'en', t: (key: string) => key } }))

// Local noon, so the local day never shifts with the time zone.
const now = new Date(2026, 10, 13, 12, 0)
const at = (y: number, m: number, d: number, h: number, min: number) => new Date(y, m, d, h, min).toISOString()

describe('formatStamp', () => {
  it('today and yesterday by name, with the clock', () => {
    expect(formatStamp(at(2026, 10, 13, 8, 5), now)).toBe('dates.today 08:05')
    expect(formatStamp(at(2026, 10, 12, 14, 32), now)).toBe('dates.yesterday 14:32')
    expect(formatStamp(at(2026, 10, 12, 0, 5), now)).toBe('dates.yesterday 00:05')
  })
  it('an older day is the date with the clock, the year only in another year', () => {
    expect(formatStamp(at(2026, 10, 11, 23, 59), now)).toBe('November 11 23:59')
    expect(formatStamp(at(2025, 9, 30, 16, 5), now)).toBe('October 30, 2025 16:05')
  })
  it('yesterday across a month and a year boundary', () => {
    expect(formatStamp(at(2026, 9, 31, 9, 0), new Date(2026, 10, 1, 12, 0))).toBe('dates.yesterday 09:00')
    expect(formatStamp(at(2025, 11, 31, 9, 0), new Date(2026, 0, 1, 12, 0))).toBe('dates.yesterday 09:00')
  })
  it('an invalid date is empty', () => {
    expect(formatStamp('nope', now)).toBe('')
  })
})

describe('formatStampShort', () => {
  it('the clock today and yesterday', () => {
    expect(formatStampShort(at(2026, 10, 13, 8, 5), now)).toBe('dates.today 08:05')
    expect(formatStampShort(at(2026, 10, 12, 14, 32), now)).toBe('dates.yesterday 14:32')
  })
  it('an older day is the date alone', () => {
    expect(formatStampShort(at(2026, 10, 11, 23, 59), now)).toBe('November 11')
    expect(formatStampShort(at(2025, 9, 30, 16, 5), now)).toBe('October 30, 2025')
  })
  it('an invalid date is empty', () => {
    expect(formatStampShort('nope', now)).toBe('')
  })
})
```

### 1b. `src/shared/lib/dateUtils.ts`

Replace the block from the comment `// Short stamp for "last moved": ...` through the end of `formatStamp` (lines 40 to 47) with:

```ts
// Stamp with the clock: "í dag 10:15", "í gær 14:32", "30. október 14:32"
// earlier this year, "30. október 2025 14:32" in another year.
export function formatStamp(dateString: string, now: Date = new Date()): string {
  const d = new Date(dateString)
  if (Number.isNaN(d.getTime())) return ''
  return `${nearDay(d, now) ?? formatDate(d, now)} ${clock(d)}`
}

// The same stamp where the row is tight (board card, list row): the clock
// today and yesterday, an older day is the date alone.
export function formatStampShort(dateString: string, now: Date = new Date()): string {
  const d = new Date(dateString)
  if (Number.isNaN(d.getTime())) return ''
  const near = nearDay(d, now)
  return near ? `${near} ${clock(d)}` : formatDate(d, now)
}

// "í dag" or "í gær" when the date falls on that local day, else null.
function nearDay(d: Date, now: Date): string | null {
  const day = d.toDateString()
  if (day === now.toDateString()) return i18n.t('dates.today')
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (day === yesterday.toDateString()) return i18n.t('dates.yesterday')
  return null
}
```

Replace the comment and body of `formatDay` (the last function in the file) with:

```ts
// Day heading for the chat: "í dag", "í gær", else the date alone.
export function formatDay(dateString: string, now: Date = new Date()): string {
  const d = new Date(dateString)
  if (Number.isNaN(d.getTime())) return ''
  return nearDay(d, now) ?? formatDate(d, now)
}
```

`clock`, `formatTime`, `formatDate`, `timeAgo` and `formatDueDate` stay as they are.

### 1c. Call sites that take the short form

- `src/vinnubord/components/ItemCard.tsx`: line 3 becomes `import { formatStampShort } from '../../shared/lib/dateUtils'`, and line 134 `{formatStamp(item.updated_at)}` becomes `{formatStampShort(item.updated_at)}`.
- `src/vinnubord/components/ListDrawer.tsx`: line 3 becomes `import { formatStampShort } from '../../shared/lib/dateUtils'`, and line 78 becomes `<span className="hg-list-when">{formatStampShort(card.item.updated_at)}</span>`.
- `src/vinnubord/components/ModulePanel.tsx`: line 3 becomes `import { formatStamp, formatStampShort } from '../../shared/lib/dateUtils'`, and line 38 becomes ``{item.closed_at && `, ${formatStampShort(item.closed_at)}`}``. Line 89 (the comment stamp) keeps `formatStamp`.

No other file changes. `ItemPanel`, `ActionList`, `FilesTab`, `HistoryTab`, `QuestionsTab` and `ProjectFields` keep `formatStamp` and get the clock through it. (After the final review the stamp beside an action in `ActionList` moved to the short form, see Niðurstaða.)

### Verification set (implementer)

- `npx vitest run src/shared/lib/dateUtils.test.ts` fails before 1b (no `formatStampShort` export) and passes after.
- `npm run test`: all green. Note the new total (655 before, 7 new tests expected, so 662).
- `npm run build`: green.

Nothing else needs checking by the implementer. No browser run.

Commit: `feat(vinnubord): clock on every stamp, short form on card and list`.

## Task 2: docs

`CLAUDE.md`:

- In "Current state", first line: change `655 vitest tests` to the new total from Task 1.
- In "Key Patterns", insert this bullet directly above the `**ErrorBoundary**` bullet:

```
- **Stamps carry the clock.** `formatStamp` in `src/shared/lib/dateUtils.ts` always writes the clock ("í dag 10:15", "í gær 14:32", "11. nóvember 23:59") and is the form for everything in the panels and the settings page. `formatStampShort` writes the clock today and yesterday and the date alone for an older day; it is for tight rows only (the board card, the list row, a closed item in the module panel). `formatDay` (chat day row) and both stamps share `nearDay`. Chrome has no Icelandic `Intl` data (`supportedLocalesOf(['is-IS'])` is empty, measured 2026-11-13), so there the date part falls back to the browser's own language ("November 12") while "í dag" and "í gær" come from i18n.
```

Commit: `docs(vinnubord): stamps carry the clock`.

## Review

One Opus code review after Task 1 and 2, then the Fable final review. Findings are fixed in one dispatch or rejected with one line under "Niðurstaða" below.

## Niðurstaða

Built 2026-11-13 by a Sonnet implementer (ffad22d, 5f06709), no deviation from the plan text. 662 tests after the build, 664 after the fix round, `npm run build` green.

Opus code review: nothing Critical or Important, three Minor.

1. Fixed. The date and the clock ran together in English ("November 12 14:32"). A dated stamp now has a comma before the clock ("November 12, 14:32", "12. nóvember, 14:32"); "í dag" and "í gær" keep the plain space. A localized "kl." was not taken: it needs a new i18n key, and in Chrome the date part is English anyway.
2. Rejected at first, then fixed after the final review (see below).
3. Fixed. The i18n stub in `dateUtils.test.ts` is hoisted and mutable, one case runs in Icelandic, and one case puts `now` just after midnight.

Sonnet re-review of the fix commit (9495625): no findings that need a fix. Three notes on how the comma reads inside a sentence ("Síðast hreyft: Heimir, 12. nóvember, 14:32.", "breytt 12. nóvember, 14:32 af Á", and the English "Last moved by Heimir November 12, 14:32." which lacked an "on" before this branch too): rejected, all readable, and the reviewer advised leaving them.

Fable final review, round 1: safe to deploy, one Minor finding. The stamp beside an action (`ActionList.tsx:76`, `.hg-act-when`) is the one long form site that cannot wrap and takes its width from the text beside it: on a 360 px phone an unread action older than yesterday left the body an estimated 75 px, and an estimated 40 px with a year in the stamp (computed from the tokens and glyph widths, not measured in a browser). Fixed: that stamp takes `formatStampShort` (yesterday still shows the clock, which is what Heimir asked for; the History tab has the exact time of every action event), and the edit line under the action keeps `formatStamp`. This was a second fix round in a file the plan did not name, so the task left the small profile here: the fix got its own review and the final review ran again.

Sonnet review of the action fix (5b3d42f) and Fable final review, round 2: code clean, safe to deploy, wording only. Fixed in one docs and comment commit: the CLAUDE.md bullet no longer says "everything in the panels" before naming two panel exceptions, the Rule section and 1c of this plan point at the action stamp change, the pixel numbers above are marked as estimates, and the comment on `formatStampShort` names all four sites.

Outside this diff, noted by the reviewer and left alone: `src/vinnubord/lib/chat.test.ts` fails one case under `TZ=Pacific/Chatham` and `TZ=Pacific/Pago_Pago` (it passes in Reykjavik and the other zones tried). Not caused by this branch.
