# 20. Raðaþak: loadBoard reads every list in pages

Plan: `docs/superpowers/plans/2026-11-25-radathak.md`. Huginn card `b610fdbd`, plan row `1c63f91b`. No migration.

## What was wrong

PostgREST returns at most 1000 rows per request and cuts the rest without an error. `loadBoard` read every list in one request, oldest first, so past 1000 rows the newest rows were the ones dropped. On 2026-11-25 `hg_rulings` of metta held 1118 rows: the newest 118 rulings were missing from the item panel, the mirror (`item.md`) and `pull --json`. Nothing else was over the cap (events are read with a limit of 500 on purpose).

## What was built

- `src/vinnubord/lib/paging.ts`: `fetchAll` (one list, page by page, until it holds the server's exact count), `ordered` and `BOARD_ORDER` (the fixed order of every list, ending in the table's key). 15 tests.
- `cli/lib/paging.mjs`: the CLI copy, held equal by three tests in `cli/lib/parity.test.mjs`.
- `loadBoard` in `src/vinnubord/lib/api.ts` and `cli/lib/client.mjs`: every list goes through `fetchAll`, also the `hg_unread` rpc on the web. `hg_events` keeps its limit.
- `npm run smoke:hg` scenario 15: `loadBoard` returns no fewer rows than each table holds, read only. It runs the CLI `loadBoard` (the web one is covered by the paging tests and the browser check of Task 2).
- The spec of fastaust in Huginn, section 8.5 item 3, now says what the code does: only an action closed by someone other than the service user keeps a deadline from coming back (corrected in the planning session).

724 vitest tests, `npm run build` green, `npm run smoke:hg` printed `ok 15/15`.

## Reviews

- Task 1 (pager), Opus: approved, no Critical or Important, five Minor (comment accuracy, the no count and empty page fallbacks, parity coverage, the error number), triaged in the final review.
- Task 2 (loadBoard and smoke), Opus: approved, no Critical or Important, four Minor (smoke scenario 15 details, all in the plan's text), triaged in the final review. The browser check of Step 7 passed: 1118 rulings, all distinct, "Plan A, grunnur" runs to R17, the dot is lit.
- Task 3 (docs), Sonnet: approved, no Critical or Important, two Minor (wording), one rejected, one confirmed against the browser check.
- Final review of the branch, Fable: no Critical or Important. Fixed in one wave: the comment about a list that shrank, tests for an empty later page and for three parity scripts, the smoke comment and a check that the server gave a count, two sentences in CLAUDE.md, open item 4 below. Rejected: reading on without a count (it would cost 18 extra requests and only matters if the cap is lowered and the count lost), the number in the MAX_PAGES message, counting hg_items in the smoke (its query carries a time window), the wording "browser check of Task 2", and hg_unread in the BoardList type (nobody calls it as a table).
- The fix wave, Opus: clean, all ten items as ordered, no new findings.

## What Heimir checks

1. Open "Nýr módúll - Vörumóttaka" (`7a35df18`), Staða, "Plan A, grunnur": the rulings run past R14. Before the fix the list ended there.
2. Open "Bókunarflæði á metta.is með dagatali Árna" (`eb5b33da`), "Plan A": R9 is there.
3. The board opens as fast as before.

## Open

1. fastaust: remove the `ROW_CAP` guard in `scripts/deals/huginn.mjs` (`boardProblem`). A list of 1000 rows or more is now whole, and the guard would stop the mirror and the inbox for no reason once a fastaust list reaches 1000 rows (chat, about March 2027). Recorded as an action on the card.
2. Lists are read whole and grow with the project. Rulings of metta grow by about 60 a day, one more request per load roughly every 17 days. Bounding plans, rulings, files, actions and comments by the item window (open, or closed within 90 days) would stop that. Not built, not on a card yet: Heimir decides.
3. Pages are not a snapshot (see "loadBoard reads every list in pages" in `CLAUDE.md`). Accepted.
4. Rows that share created_at now come in id order on the web, as the mirror already sorted them. The questions a quick analysis writes in one insert (10 groups on metta) can show in another order than before the fix, 3 of them on open cards. The order the model gave them was never stored. Accepted.
