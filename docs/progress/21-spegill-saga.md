# 21. Spegill og saga: the mirror writes item.md and saga.md

Plan: `docs/superpowers/plans/2026-11-26-huginn-spegill-saga.md` (in metta2_new). Plan A of two, plan B is the skill rule in metta2_new. Branch `spegill-saga`. No migration.

## Why

Measured 2026-11-26 on the session that opened card 7a35df18 (Vörumóttaka): `item.md` was 105,000 characters and cost 55,000 tokens to read. 45,000 characters were closed actions (38,000 of them one SQL payload that was run on 24 November) and 19,000 were done plans with rulings. Open actions were under 2,000. Across the 78 open cards, done plans (116,000 characters) and closed actions (108,000) are 45% of everything the mirror writes.

## What was built

- `cli/lib/mirror.mjs`: `renderItemMd` writes only what is open. A done plan is one line (name, `Lokið`, path, number of rulings) and a closed or cancelled action is one line (id, state, day, who closed it, first 140 characters, counted by code points, and a closed action with an empty body ends its line after the person, with no colon). `renderSagaMd` writes done plans with rulings and closed actions with text, the payload replaced by its length.
- `saga.md` is written only when something is closed. The sync compares `item.md`, `saga.md` and `STATUS.md` by sha256, and a file named `saga.md` is reserved like `item.md`.
- `sync` warns for an open item whose description is over 15000 characters. The warning does not change the exit code.
- "Halda áfram" (`buildContinuationPrompt`) names `item.md` in the mirror folder instead of the whole folder.
- Docs: `cli/README.md` (section Spegill), `CLAUDE.md` (Current state, Key Patterns).

Commits on the branch: d88ecd4, 6aa5585, cc9c1eb (code), 7efc745 (fix: clip by code points, no trailing colon on an empty closed action), then this commit (final review fixes, docs current and a CRLF payload test).

## Decisions

- **R1. The payload of a closed action is mirrored nowhere.** It stays in the database and in `huginn pull --json`. Cost if wrong: a session that wants old SQL runs one command instead of reading a file.
- **R2. Answered questions, chat and the file list stay whole in item.md.** Together they are 8% of the open cards and they carry decisions of Árni and Heimir. Cost if wrong: none, they can move later.
- **R3. saga.md is written only when something is closed.** If the last closed thing is opened again (a done plan set back to todo and no closed action exists) the old saga.md stays on disk, because the tool never deletes. Its header says item.md wins. Cost if wrong: a stale file that claims a plan is done while item.md shows it open.
- **R4. The description is not cut by the tool.** It is free text. `sync` prints a warning for an open card over 15000 characters, and the skill in metta2_new (plan B) tells the session that works on the card to shorten it.
- **R5. The CLI is built in a worktree.** Every running Claude session calls `cli/huginn.mjs` from the main checkout of the Huginn repo, so a half edited file there breaks every session.

## Verification

735 vitest tests passed (46 files, 11 more than the 724 before), `npm run build` green. `npm run lint` is broken and was not run.

## Pending

- The description of a card is still free text and the three largest open cards are 22000 to 30000 characters. The skill rule that shortens them is plan B in metta2_new.
- Not fixed: if an earlier sync copied an uploaded file named saga.md into a card folder, the rendered saga.md now replaces that copy once something on the card is closed. The upload stays in Storage and is mirrored as saga-<id>.md.
- Not fixed: no test checks that sync adds bodyWarnings to its result. It is one line in a command that needs the network, and bodyWarnings itself is tested.
- Not fixed: task 1 wrote the implementation before the RED run. RED was shown by reverting mirror.mjs, so the evidence holds.
- The final review, the merge to main and the live sync run in metta2_new are done by the controller after the final review.
