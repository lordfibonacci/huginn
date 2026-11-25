# 19 Vinnuborð: fastaust sem Huginn verkefni (plan 19)

Date: 2026-11-25
Branch: `feat/fastaust-cli` (commits 82ba3c7, ffcef3b, efe951a and the docs commit, on top of b9ea894). Not merged or pushed when this was written.
Plan: `docs/superpowers/plans/2026-11-25-fastaust-i-huginn.md`
Spec: `docs/superpowers/specs/2026-11-25-fastaust-i-huginn-design.md`

Status: **built (2026-11-25)**. No migration. Final whole branch review (Fable): pending, the controller updates this line.

## What was built

Fasteignasala Austurlands is the second Huginn project, slug `fastaust`. It has seven boxes as the stages of a sale and no packs or modules. Its cards are written by `scripts/sync-huginn.mjs` in the fastaust repo from the eignalog headers; that script is the fastaust plan and is not part of this branch. The task order was: CLI boxes and placement (1), the data (2), CLI flags (3), home page (4), docs (5).

1. **CLI boxes (task 1).** `loadBoard` in `cli/lib/client.mjs` reads `hg_zones` into `zones` (so `pull --json` carries them). `cli/lib/write.mjs` gets `ZONE_PAD`, `ZONE_TOP`, `resolveZone` (one box by name, any case, an unknown or doubled name is an error that lists the boxes), `placeInZone` (first free slot, columns left to right and rows top to bottom, and the height the box needs), `placeItemInZone` and `itemInZone` (the centre rule of `zoneMembers` in `lib/zones.ts`, border included). `placeItem` now treats boxes as obstacles for a card with no module to sit beside, so a module less card without `--zone` never lands inside a box.
2. **Data (task 2).** Inserted by the controller through the Supabase MCP, see the next section.
3. **CLI flags (task 3).** `item create` takes `--zone`, `--summary` and `--source-ref`; `item set` takes `--title` and `--zone`. `--zone` writes `hg_items.pos_x|pos_y` and, when the box is full, `hg_zones.h` (`resizeZone` in `cli/lib/ops.mjs`), never a view position. A card already in the box is left alone ("er þegar í kassanum"). `cli/README.md` has the new rows and a Kassar bullet.
4. **Home page (task 4).** `lib/lastProject.ts` (`hg.lastProject` in `localStorage`, read and write inside try and catch, `startSlug`). `BoardPage` writes the slug of the open project and `HomePage` sends "/" to the stored slug when the viewer is a participant of it, else to the first project by name.

## The data

Project `fastaust` in the shared Supabase project `czdjxtsjgughimlazdmu` (inserted 2026-11-25):

- Project: slug `fastaust`, name Fasteignasala Austurlands, `repo_path` `d:\Claude Code\fastaust`.
- Participants: H (Heimir, not service) and C (the Claude service user, service).
- Six tags: eign, leiðsla, hjá seljanda, hjá kaupanda, hjá júlíusi, hjá öðrum.
- Seven boxes, each 600 by 1300, at y 0 and x 0, 660, 1320, 1980, 2640, 3300, 3960, in this order and colour: Óraðað (stone), Leiðsla (lilac), Í undirbúningi (gold), Í sölu (teal), Tilboð (coral), Kaupsamningur (gold), Afsal (teal).

## What was checked

- `npm run test`: 706 tests green in 45 files (680 before this branch). `npm run build`: green. No database code in `src`, so no `smoke:hg` run.
- Task 1: RED before the section (12 failed, 59 passed in `write.test.mjs`), then `write.test.mjs` and `parity.test.mjs` 83 passed. The read only live `pull` was on metta (fastaust did not exist yet, it came with task 2) and returned `zones`.
- Task 3, live against `fastaust` (a test card, `e378dc80`):
  1. `item create` with `--zone`: `{"ok": true, "id": "e378dc80-..."}`, exit 0. `pull` showed it at x 24, y 40 in Óraðað.
  2. `item set --zone Tilboð`: `Verk uppfært #e378dc80: Prufa úr plani, má hunsa, Í bið`, exit 0. `pull` showed it at x 2664, y 40.
  3. `item set --zone Tilboð` again: `Verk #e378dc80 er þegar í kassanum Tilboð.`, exit 0, nothing written.
  4. `item set --title`: `Verk uppfært #e378dc80: Prufa, nýr titill, má hunsa, Í bið`, exit 0.
  5. `item set --zone "Ekki til"`: `Villa: Kassinn Ekki til fannst ekki. Kassar: Óraðað, Leiðsla, Í undirbúningi, Í sölu, Tilboð, Kaupsamningur, Afsal.`, exit 1.
  6. `item close --dropped`: `Verki lokað #e378dc80: Prufa, nýr titill, má hunsa, Hætt við`, exit 0.
  `npx vitest run cli/`: 6 files, 182 tests green.
- Task 4: `lastProject.test.ts` 5 of 5 after a RED run (the module did not exist yet).
- Browser checks in Playwright on the worktree dev server (1440 by 900), signed in as claude@huginn.pro:
  - Task 2: the fastaust board shows the seven boxes fitted in the view, no pack, no card, no alert, empty console. The switcher lists Fasteignasala Austurlands and Metta; picking Metta loads its board (83 cards, 5 packs). One deviation from the plan: the new item sheet has a Módúll select with the single option "Enginn módull" and opens without error. Heimir ruled on 2026-11-25 to keep it as it is (it belongs to approach B of the spec).
  - Task 4: "/" with nothing stored opens fastaust; after metta "/" opens metta; after fastaust "/" opens fastaust; with `hg.lastProject` set to `ekki-til` "/" opens fastaust. Console empty.
- `resizeZone` was run live by the controller on 2026-11-25 on the box Afsal with the height it already had (1300): it returned without error and nothing changed; an unknown id gives the error. The growing itself has not run live.
- Environment: `node_modules` of the main checkout is damaged (no `.bin`, 99 of 559 non optional packages missing, older than this build), so the worktree got its own `npm ci` instead of a junction. The main checkout needs an `npm ci` before its next build.

## Open

1. The fastaust plan (the sync script in the fastaust repo, and by spec section 10 one paragraph in `.claude/skills/email-sweep/SKILL.md` beside its two additions to steps 1 and 6 and one paragraph in the fastaust `CLAUDE.md`) is not built. It calls `cli/huginn.mjs` from the main checkout of this repo, so it starts after the merge and push.
2. The test card `e378dc80` on fastaust is dropped and fades from the board by itself three days after it was closed.
3. `itemInZone` copies the centre rule of `zoneMembers`; `parity.test.mjs` covers it, so a change to one fails until the other follows.
4. A card placed with `--zone` goes at the main board position only. In a saved view the card keeps whatever view position it has, and the CLI neither reads nor writes view positions.
5. An item a participant creates by hand in `fastaust` is analysed with the software prompt (`hg-analyse`), a known gap (spec section 13).
6. A box never shrinks: the first fill of about 40 cards grows Óraðað from 1300 to about 3800 px and it stays so when the cards are moved out. After the moves Heimir drags the corner, or the session sets `h` back to 1300 with one UPDATE.
7. Packs are no obstacle for `--zone` (spec 6.4 names cards only). Fastaust has no packs, but a box drawn around a pack in metta would take cards on top of its modules.
8. A command whose item write is refused after the box grew leaves the box one row taller. The retry finds the same slot and grows no further.
9. For the mirror: errors go to stderr as `Villa: ...` with exit 1 also under `--json`, so it decides the spec 8.7 fallback from `zones` in the one `pull --json`.
10. For the mirror: a value that starts with `--` needs the `--flag=value` form, so it always passes `--title=`, `--summary=` and `--source-ref=` that way.
11. Without `--zone` on fastaust a card lands left of Óraðað at y 0, never in a box.
12. A card created before its actions is estimated about 32 px shorter than it becomes. The 40 px gap absorbs it, and a card on the last row can stick about 8 px out of the bottom.

## What Heimir checks

1. `huginn.pro` opens the project he was last in, also after a reload.
2. The project switcher shows both Fasteignasala Austurlands and Metta.
3. The fastaust board shows seven empty boxes in a row: Óraðað, Leiðsla, Í undirbúningi, Í sölu, Tilboð, Kaupsamningur, Afsal.
