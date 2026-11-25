# 18 Vinnuborð: nýlega breytt (plan 18)

Date: 2026-11-18
Branch: `feat/nylega-breytt` (commits 9c1eabe to d2dd963 and the docs commit, on top of main 18f6f89). The final whole branch review (Fable) came back clean.
Plan: `docs/superpowers/plans/2026-11-18-nylega-breytt.md`
Spec: `docs/superpowers/specs/2026-11-18-nylega-breytt-design.md`

Status: **built, final review clean**. No migration.

## What was built

A "nýlega breytt" pill, first in the counter row, that filters the board to the cards that moved inside a window. `lib/recent.ts` gives every item one last movement stamp (the item and everything on it: chat, files, questions, actions, plans, rulings), `cardModels` puts it on the card as `changedAt` and `recent`, `Filter.recent` combines with every other filter by AND, and the list sorts and row dates read `changedAt` too, so pill, list and board never disagree. The window is 24, 72 (default) or 168 hours, chosen in the viewer menu and stored per browser (`hg.recent`, `useRecentWindow`). Saved views never store it. The task order was: last movement rule and window (1), card model and list (2 to 3), filter (4), pill and window select (5), docs (6).

## Numbers

- `npm run test`: 680 tests green in 44 files. `npm run build`: green.
- No database code touched, so no smoke run.

## Review rounds

Each of tasks 1 to 5 had one task review (tasks 1 to 4 on Sonnet, task 5 on Opus). All approved with no Critical or Important findings, so there were no fix rounds. The final whole branch review on Fable (18f6f89 to a9e3e80) found no Critical or Important issues and said ready to merge. It rejected the three deferred Minors below with reasons and accepted the controller's rulings (the phone sheet Hreinsa, the iOS font size selector, the commit trailer). Its four Minors were handled in one docs fix: a Current state bullet in CLAUDE.md, the Design System paragraph moved after Far labels, this result recorded here, and the row cap below written down instead of changed in code.

Minor notes kept, not fixed:
- `parseRecentHours` accepts strings like " 24" (harmless, the result is always a valid window).
- The list row date goes epoch to ISO string and back through `formatStampShort` (works).
- The window shows only in the pill's title, which touch users never see (same as the other pills).
- Task 4's implementer skipped the RED run. The controller removed the filter line, saw both new filter tests fail, then restored it.

## Open

1. On the phone the filter sheet's "Hreinsa" clears packages, tags and the view only, never the pills (the existing rule for every pill), so the recent pill is switched off on the phone by tapping it. The top bar "Hreinsa" on wider boards clears it.
2. A plan reorder moves the plan's `updated_at` and so counts as a change, a known and accepted slip.
3. Real phone and iPad checks have not run. The browser checks ran in Playwright at 1440x900, 1280x800 and 390x844.
4. `loadBoard` in `lib/api.ts` reads comments, files, questions, actions and rulings with no limit in `created_at` ascending order. Past the PostgREST row cap (1000 rows of one kind) the newest rows would drop, so `changedAt`, the chat tab and the action chip would run old. Metta is far below it. The fix is to order those five queries descending; nothing in `src` depends on their order. Fixed 2026-11-25 by reading every list in pages instead of reordering, see `20-radathak.md`.

## What Heimir checks

1. The pill is first in the row and its number matches the list count when only it is on.
2. Write a message in the chat of an old card: the card lights under the pill and goes to the top of the list sorted "Síðast breytt".
3. Drag a card: it does not become recently changed.
4. The window choice in the menu under your initial: 24 klst, 3 dagar, 7 dagar, kept after a reload.
5. On the phone the pill is first in the row that scrolls sideways.
