# Handtak breytt og fellt niður Implementation Plan (plan 8, part C of the spec)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The CLI can change the text, owner or payload of an open action (`action set`) and cancel one that no longer applies (`action cancel`), the database records who changed it and when, and `pull`, `item.md` and the web show the edit mark and the cancellation without any status rule changing.

**Architecture:** Migration 0012 adds `updated_at`, `updated_by`, `cancelled` and `cancel_reason` to `hg_actions`, stamps edits in `hg_stamp_author` and logs `action.updated` and `action.cancelled` in `hg_log_event`. A cancelled action is a closed action with a flag (`done_at` set), so `waitsFor`, `countBucket`, trigger 0009, `guardClose` and the continuation prompt stay as they are. Two CLI commands in `cli/lib/commands.mjs` and `ops.mjs`, display in `format.mjs`, `mirror.mjs`, `ActionList.tsx`, `history.ts` and `reads.ts`, two lines in the `/huginn` skill in metta2_new.

**Tech Stack:** Postgres (Supabase MCP `apply_migration`), Node ESM CLI, vitest, React 19, react-i18next.

**Spec:** `docs/superpowers/specs/2026-11-01-olesid-og-synir-design.md`, section 5b (and 6, 7, 8). Requires plan 6 (`2026-11-01-olesid.md`) built: `hg_actions.created_by` (0010), `UnreadKind`, `UNREAD_ORDER`, `isFresh` and the `hg-fresh` classes exist.

## Global Constraints

- Only `hg_` objects on the shared Supabase project. Migration applied with MCP `apply_migration`, name `0012_hg_action_edits`. No DROP, no DELETE. Never `supabase db push`. Never edit an applied migration. `hg_stamp_author` and `hg_log_event` are replaced whole with `create or replace`: copy the current body (`hg_stamp_author` from `0010_hg_unread.sql`, `hg_log_event` from `0004_hg_trigger_fixes.sql` lines 140 to 263) and change only the `hg_actions` branches given below.
- No em dashes and no hyphen dashes as punctuation anywhere: SQL comments, CLI text, README, the skill, i18n.
- Icelandic CLI copy exactly as given. CLI flags are strict (unknown flags are errors, `parseCommand`). CLI tests in `cli/lib/*.test.mjs`, `parity.test.mjs` must stay green and is not edited.
- Web: new keys under `vinnubord.*` in `en.json`, `is.json` through `npm run translate` or by hand in alphabetical order. CSS reads only existing tokens.
- Verification gates: `npm run build` and `npm run test` green after every task. `npm run smoke:hg` in task 1 only.
- Commits on `main` in `D:\Claude Code\Huginn\huginn`, scope `(vinnubord)` for web and `(cli)` for CLI, `Co-Authored-By` trailer. Task 5 commits and pushes in `D:\Claude Code\metta2\metta2_new`.
- Implementer budget per task: about 60 tool calls or 150k context. Implementers verify only the set named in their task.

## Review Focus

1. `action set` on a closed or cancelled action must refuse with "Handtakið er lokað." and change nothing. Test: task 2 ops test through the smoke scenario 10 step d.
2. A plan going `done` while the item's only remaining action is cancelled must close the item (cancelled is closed). Test: task 1 smoke scenario 10 step f.
3. `action done` must still work after `action set` (the edit does not touch `done_at`), and marking a cancelled action done must refuse like an already done one. Test: scenario 10 steps c and e.
4. An `action.updated` event must list the changed fields and must not fire when only `done_at` changes. Test: scenario 10 steps b and c.
5. `pull` must keep listing an edited open action under its item and drop a cancelled one from the open list. Test: task 3 `format.test.mjs`.

## Size table

| Task | Files | Size |
|---|---|---|
| 1 Migration 0012, smoke scenario 10 | `supabase/migrations/0012_hg_action_edits.sql`, `supabase/migrations/README.md`, `scripts/hg-smoke.mjs`, `CLAUDE.md` | M |
| 2 CLI commands | `cli/lib/ops.mjs`, `cli/lib/commands.mjs`, `cli/README.md`, `cli/lib/write.test.mjs` | S |
| 3 CLI display | `cli/lib/format.mjs`, `format.test.mjs`, `cli/lib/mirror.mjs`, `mirror.test.mjs` | S |
| 4 Web display | `src/vinnubord/lib/types.ts`, `history.ts`, `history.test.ts`, `reads.ts`, `reads.test.ts`, `components/panel/ActionList.tsx`, `ItemPanel.tsx`, `vinnubord.css`, `en.json`, `is.json` | M |
| 5 Skill in metta2_new | `D:\Claude Code\metta2\metta2_new\.claude\skills\huginn\SKILL.md` | S |
| 6 Handover | `docs/progress/08-handtok-breytt.md`, `CLAUDE.md` | S |

No L tasks.

---

### Task 1: Migration 0012

**Files:**
- Create: `supabase/migrations/0012_hg_action_edits.sql`
- Modify: `supabase/migrations/README.md`, `scripts/hg-smoke.mjs` (`TOTAL` 9 to 10), `CLAUDE.md`

**Interfaces:**
- Produces: columns `hg_actions.updated_at timestamptz`, `updated_by uuid`, `cancelled boolean not null default false`, `cancel_reason text`; events `action.updated` (`data.fields` text array of `body`, `owner`, `payload`) and `action.cancelled` (`data.reason`).

- [ ] **Step 1: Write the migration**

Header and columns, verbatim:

```sql
-- 0012_hg_action_edits
-- An open action can be changed and cancelled (spec 2026-11-01-olesid-og-synir-design.md, 5b).
-- updated_at and updated_by stamp a change of body, owner or payload. A cancelled
-- action is a closed action (done_at set) with cancelled = true and a reason, so
-- every rule that reads done_at (0009, waitsFor, guardClose) is unchanged.
-- Events: action.updated with the changed fields, action.cancelled instead of
-- action.done when done_at is set together with cancelled.

alter table hg_actions
  add column updated_at timestamptz,
  add column updated_by uuid,
  add column cancelled boolean not null default false,
  add column cancel_reason text;
```

Then `create or replace function hg_stamp_author()` copied from `0010_hg_unread.sql` with the `hg_actions` branch replaced by:

```sql
  elsif tg_table_name = 'hg_actions' then
    -- owner is the assignee, never stamped. created_by is the author (0010).
    -- A change of body, owner or payload stamps updated_at and updated_by (0012).
    if tg_op = 'INSERT' then
      new.created_by := coalesce(auth.uid(), new.created_by);
      new.updated_at := null;
      new.updated_by := null;
    else
      new.created_by := old.created_by;
      if new.body is distinct from old.body
         or new.owner is distinct from old.owner
         or new.payload is distinct from old.payload then
        new.updated_at := now();
        new.updated_by := coalesce(auth.uid(), new.updated_by);
      else
        new.updated_at := old.updated_at;
        new.updated_by := old.updated_by;
      end if;
    end if;
    if new.done_at is null then
      new.done_by := null;
      new.cancelled := false;
      new.cancel_reason := null;
    elsif tg_op = 'INSERT' or old.done_at is null then
      new.done_by := coalesce(auth.uid(), new.done_by);
    else
      new.done_by := old.done_by;
      new.cancelled := old.cancelled;
      new.cancel_reason := old.cancel_reason;
    end if;
  end if;
```

Then `create or replace function hg_log_event()` copied from 0004 with the `hg_actions` branch replaced by:

```sql
  elsif tg_table_name = 'hg_actions' then
    if tg_op = 'INSERT' then
      insert into hg_events (created_at, project_id, item_id, actor, kind, data)
      values (clock_timestamp(), new.project_id, new.item_id, v_uid, 'action.added', '{}');
      if new.done_at is not null then
        insert into hg_events (created_at, project_id, item_id, actor, kind, data)
        values (clock_timestamp(), new.project_id, new.item_id,
                coalesce(v_uid, new.done_by), 'action.done', '{}');
      end if;
    else
      if new.body is distinct from old.body then
        v_fields := array_append(v_fields, 'body');
      end if;
      if new.owner is distinct from old.owner then
        v_fields := array_append(v_fields, 'owner');
      end if;
      if new.payload is distinct from old.payload then
        v_fields := array_append(v_fields, 'payload');
      end if;
      if cardinality(v_fields) > 0 then
        insert into hg_events (created_at, project_id, item_id, actor, kind, data)
        values (clock_timestamp(), new.project_id, new.item_id,
                coalesce(v_uid, new.updated_by), 'action.updated',
                jsonb_build_object('fields', to_jsonb(v_fields)));
      end if;
      if old.done_at is null and new.done_at is not null then
        if new.cancelled then
          insert into hg_events (created_at, project_id, item_id, actor, kind, data)
          values (clock_timestamp(), new.project_id, new.item_id,
                  coalesce(v_uid, new.done_by), 'action.cancelled',
                  jsonb_build_object('reason', new.cancel_reason));
        else
          insert into hg_events (created_at, project_id, item_id, actor, kind, data)
          values (clock_timestamp(), new.project_id, new.item_id,
                  coalesce(v_uid, new.done_by), 'action.done', '{}');
        end if;
      end if;
    end if;
```

`v_fields` is already declared in `hg_log_event` (used by the items branch); it starts as `'{}'` per row. The rest of both functions is byte for byte the current version.

- [ ] **Step 2: Apply**: MCP `apply_migration`, name `0012_hg_action_edits`. Expected: success.

- [ ] **Step 3: Smoke scenario 10**

`const TOTAL = 10`. After scenario 9's `passed++`, before `} finally {` (uses `itemId`; create a second item for step f with `extraItems.push`):

```js
    scenario = '10 action edits'
    // a: a new action has no edit stamp
    const a10 = must(
      await sb.from('hg_actions').insert({ project_id: projectId, item_id: itemId, body: 'first text', owner: heimir.user_id }).select('id, updated_at, updated_by').single(),
      'insert action 10',
    )
    expect(a10.updated_at === null && a10.updated_by === null, 'new action carries an edit stamp')
    // b: changing body stamps updated_at and updated_by and logs action.updated with fields
    must(await sb.from('hg_actions').update({ body: 'second text', owner: arni.user_id }).eq('id', a10.id), 'edit action')
    const e10 = must(await sb.from('hg_actions').select('updated_at, updated_by, done_at').eq('id', a10.id).single(), 'read edited')
    expect(e10.updated_by === me && e10.updated_at !== null && e10.done_at === null, 'edit stamp missing or done_at touched')
    const upd = (await readEvents()).filter((e) => e.kind === 'action.updated')
    expect(upd.length === 1 && JSON.stringify(upd[0].data.fields) === JSON.stringify(['body', 'owner']), `action.updated events ${JSON.stringify(upd)}`)
    // c: marking done after an edit works and logs action.done, not action.updated
    must(await sb.from('hg_actions').update({ done_at: new Date().toISOString() }).eq('id', a10.id).is('done_at', null), 'done after edit')
    const afterDone = await readEvents()
    expect(afterDone.filter((e) => e.kind === 'action.updated').length === 1, 'done_at change logged action.updated')
    expect(afterDone.filter((e) => e.kind === 'action.done').length >= 3, 'action.done missing after edit')
    // d: cancelling an open action sets done_at, cancelled, reason and logs action.cancelled
    const c10 = must(
      await sb.from('hg_actions').insert({ project_id: projectId, item_id: itemId, body: 'to cancel', owner: heimir.user_id }).select('id').single(),
      'insert cancel target',
    )
    must(
      await sb.from('hg_actions').update({ done_at: new Date().toISOString(), cancelled: true, cancel_reason: 'planið breyttist' }).eq('id', c10.id).is('done_at', null),
      'cancel action',
    )
    const cRow = must(await sb.from('hg_actions').select('done_at, done_by, cancelled, cancel_reason').eq('id', c10.id).single(), 'read cancelled')
    expect(cRow.done_at && cRow.done_by === me && cRow.cancelled === true && cRow.cancel_reason === 'planið breyttist', `cancel row ${JSON.stringify(cRow)}`)
    const canc = (await readEvents()).filter((e) => e.kind === 'action.cancelled')
    expect(canc.length === 1 && canc[0].data.reason === 'planið breyttist', `action.cancelled events ${JSON.stringify(canc)}`)
    // e: cancelled cannot be flipped back by an update that keeps done_at
    must(await sb.from('hg_actions').update({ cancelled: false, cancel_reason: null }).eq('id', c10.id), 'flip cancelled')
    const kept10 = must(await sb.from('hg_actions').select('cancelled, cancel_reason').eq('id', c10.id).single(), 'read flipped')
    expect(kept10.cancelled === true && kept10.cancel_reason === 'planið breyttist', 'cancelled was flipped on a closed action')
    // f: a plan going done with only a cancelled action left closes the item (cancelled is closed)
    const fItem = must(
      await sb.from('hg_items').insert({ project_id: projectId, title: 'smoke 10 f', status: 'waiting', waiting_on: heimir.user_id, created_by: me }).select('id').single(),
      'insert item f',
    )
    extraItems.push(fItem.id)
    const fAct = must(await sb.from('hg_actions').insert({ project_id: projectId, item_id: fItem.id, body: 'gone', owner: heimir.user_id }).select('id').single(), 'insert action f')
    must(await sb.from('hg_actions').update({ done_at: new Date().toISOString(), cancelled: true }).eq('id', fAct.id), 'cancel action f')
    const fPlan = must(await sb.from('hg_plans').insert({ project_id: projectId, item_id: fItem.id, name: 'p', status: 'building' }).select('id').single(), 'insert plan f')
    must(await sb.from('hg_plans').update({ status: 'done' }).eq('id', fPlan.id), 'plan f done')
    const fRow = must(await sb.from('hg_items').select('status, closed_at').eq('id', fItem.id).single(), 'read item f')
    expect(fRow.status === 'done' && fRow.closed_at !== null, `item f is ${fRow.status}, expected done`)
    passed++
```

Run: `npm run smoke:hg`. Expected: `ok 10/10`.

- [ ] **Step 4: Docs**

README Files list: `- 0012_hg_action_edits: updated_at, updated_by, cancelled and cancel_reason on hg_actions, edit stamps, action.updated and action.cancelled events.`

CLAUDE.md Migrations list: ``- `0012_hg_action_edits` : applied through MCP 2026-11-01. `hg_actions` gets `updated_at`, `updated_by` (stamped when body, owner or payload changes), `cancelled` and `cancel_reason`. A cancelled action has `done_at` set, so every `done_at` rule is unchanged; `done_at` set together with `cancelled` logs `action.cancelled` instead of `action.done`; an edit logs `action.updated` with `fields`. Flags on a closed action cannot be flipped. `npm run smoke:hg` scenario 10 covers it.``

- [ ] **Step 5: Commit** `feat(vinnubord): migration 0012, actions can be changed and cancelled`.

Verification set: `npm run smoke:hg`. Nothing else.

---

### Task 2: CLI commands `action set` and `action cancel`

**Files:**
- Modify: `cli/lib/ops.mjs`, `cli/lib/commands.mjs`, `cli/README.md`, `cli/lib/write.test.mjs`

**Interfaces:**
- Produces, in `ops.mjs`: `updateAction(client, id, patch: { body?, owner?, payload? })` updates where `id` and `done_at is null`, `select('*')`, fails `'Gat ekki breytt handtakinu'` on error and `'Handtakið er lokað.'` when no row; `cancelAction(client, id, reason)` updates `{ done_at: new Date().toISOString(), cancelled: true, cancel_reason: reason ?? null }` where `id` and `done_at is null`, fails `'Gat ekki fellt handtakið niður'` and `'Handtakið er lokað.'`.
- Produces, in `commands.mjs` under `action`:
  - `set`: usage `'action set <aid> [--body ".."] [--owner short] [--payload-file f.sql]'`, `args: 1`, `spec: { body: 'value', owner: 'value', 'payload-file': 'value' }`. At least one flag or error `'Gefðu --body, --owner eða --payload-file.'`. Owner through `resolveShort` like `add` (none is an error with the same text as `add`). Text: `` `Handtak #${shortId(a.id)} breytt.` ``.
  - `cancel`: usage `'action cancel <aid> [--reason ".."]'`, `args: 1`, `spec: { reason: 'value' }`. Text: `` `Handtak #${shortId(a.id)} fellt niður.` ``.

- [ ] **Step 1: Failing test**

`write.test.mjs` tests pure parsing only; add one case that `parseCommand(['x', '--reason', 'r'], { reason: 'value' }, 'action cancel')` yields `{ positional: ['x'], flags: { reason: 'r' } }` and that `parseCommand(['x', '--body'], { body: 'value' }, 'action set')` throws `--body vantar gildi.` (this pins the spec shapes used below). Run: `npx vitest run cli/lib/write.test.mjs`. Expected: PASS already (parser is generic); keep the test as documentation of the flag shapes.

- [ ] **Step 2: ops and commands** per the interfaces. `--payload-file` is read with the existing `readText`.

- [ ] **Step 3: README**

In the write commands table after `action done`:

```
| `action set <aid>` | `huginn action set 5e6f7a8b --body "Nýr texti" --owner Á --payload-file 0012.sql` (aðeins opið handtak, stofndagur helst, breytingin er merkt) |
| `action cancel <aid>` | `huginn action cancel 5e6f7a8b --reason "Planið breyttist"` (lokar handtaki sem á ekki lengur við án þess að það teljist gert) |
```

In the bullet list under the table add: `- **Handtök.** Handtak sem varð rangt er lagað með `action set`, aldrei hakað sem gert. Handtak sem á ekki lengur við er fellt niður með `action cancel`; það telst lokað (stöðvar hvorki `item close` né plan sem fer í done) en ekki gert.`

- [ ] **Step 4: Verify against the live project**

From `D:/Claude Code/metta2/metta2_new` (credentials in `~/.huginn/`): `node "D:/Claude Code/Huginn/huginn/cli/huginn.mjs" --help` lists both commands. Create a throwaway action on a test item with `action add`, then `action set <aid> --body "breytt"` prints `Handtak #... breytt.`, `action set` again on it after `action done` prints the error `Handtakið er lokað.` with exit code 1, `action cancel` on a second throwaway prints `Handtak #... fellt niður.`. Delete the throwaway item afterwards through MCP `execute_sql` (`delete from hg_items where id = ...`, Heimir allows deletes of smoke data; this is the same thing the smoke script does) or use the smoke item pattern: create the item with `item create --title "cli smoke 8" --json` and delete it by id.

- [ ] **Step 5: Build and test**: `npm run test`, `npm run build` green.

- [ ] **Step 6: Commit** `feat(cli): action set and action cancel`.

Verification set: test, build, the live run above. Nothing else.

---

### Task 3: CLI display in `pull` and `item.md`

**Files:**
- Modify: `cli/lib/format.mjs`, `format.test.mjs`, `cli/lib/mirror.mjs`, `mirror.test.mjs`

**Interfaces:**
- Produces: in `subLines` an open action with `updated_at` ends `` `, breytt ${iso(a.updated_at)} af ${shortOf(a.updated_by, participants)}` `` before the `#id`; cancelled actions are closed (`done_at` set) so they are already out of the open list. In `renderItemMd`: heading `` `### Handtak #${shortId(a.id)}, ${a.cancelled ? 'fellt niður' : a.done_at ? 'lokið' : 'opið'}` ``; a cancelled action's line is `` `- Fellt niður: ${iso(a.done_at)}, af ${person(a.done_by, participants)}` `` plus `` `, ástæða: ${oneLine(a.cancel_reason)}` `` when there is one, instead of the `Lokið:` line; an action with `updated_at` gets `` `- Breytt: ${iso(a.updated_at)}, af ${person(a.updated_by, participants)}` `` after `Stofnað`.

- [ ] **Step 1: Failing tests**

`format.test.mjs`, in the describe that holds the `'  - Handtak, H: Keyra SQL í ritli #a1'` expectation, add a case with `updated_at: '2026-11-01T10:00:00+00:00', updated_by: 'u-c'` expecting `'  - Handtak, H: Keyra SQL í ritli, breytt 2026-11-01T10:00:00Z af C #a1'` (match the `iso` format the existing test uses), and a case that a cancelled action (`done_at` set, `cancelled: true`) is not listed.

`mirror.test.mjs`, next to the `#c1000000, opið` test: an action `c3000000` with `done_at`, `done_by: 'u-c'`, `cancelled: true`, `cancel_reason: 'planið breyttist'` renders `### Handtak #c3000000, fellt niður` and `- Fellt niður: 2026-...Z, af Claude, ástæða: planið breyttist`; an open action with `updated_at`/`updated_by` renders `- Breytt: ..., af Claude` after `- Stofnað`.

Run: `npx vitest run cli/lib/format.test.mjs cli/lib/mirror.test.mjs`. Expected: FAIL.

- [ ] **Step 2: Implement** per the interfaces. Run the two test files: PASS. `npm run test`: green (the `mirror` byte for byte rule holds since the output is deterministic).

- [ ] **Step 3: Commit** `feat(cli): pull and item.md show edited and cancelled actions`.

---

### Task 4: Web display

**Files:**
- Modify: `src/vinnubord/lib/types.ts` (`Action` gains `updated_at: string | null`, `updated_by: string | null`, `cancelled: boolean`, `cancel_reason: string | null`)
- Modify: `src/vinnubord/lib/history.ts`, `history.test.ts`, `reads.ts`, `reads.test.ts`
- Modify: `src/vinnubord/components/panel/ActionList.tsx`, `src/vinnubord/components/ItemPanel.tsx`
- Modify: `src/vinnubord/vinnubord.css`, `en.json`, `is.json`

**Interfaces:**
- `history.ts` `SIMPLE` gains `'action.cancelled': 'actionCancelled'`; `describeEvent` handles `action.updated` like `item.updated` (`line('actionUpdated', {}, fields)`), fields translated through `vinnubord.history.actionFields.*`.
- `reads.ts` `UnreadKind` gains `'actionEdited' | 'actionCancelled'`, `UNREAD_ORDER` inserts them after `'actionDone'` (the order becomes `action, actionDone, actionEdited, actionCancelled, question, ...`), kind map gains `action.updated` → `actionEdited` and `action.cancelled` → `actionCancelled`.
- `ActionList` rows: an action with `updated_at` shows `p.hg-act-edited` under the body: `t('vinnubord.panel.actionEdited', { when: formatStamp(updated_at), name: short })`; a cancelled action is in the folded done list with the checkbox replaced by `span.hg-act-cancel-mark` reading `t('vinnubord.panel.actionCancelled')`, the body struck through like done, and `p.hg-act-edited` with the reason when there is one. `isFresh` for a row also considers `updated_at`/`updated_by`: fresh when `fresh(created_at, created_by) || fresh(updated_at, updated_by)`.

- [ ] **Step 1: Failing tests**

`history.test.ts`: `describeEvent({ kind: 'action.updated', data: { fields: ['body', 'owner'] } })` gives `{ key: 'actionUpdated', fields: ['body', 'owner'] }`; `action.cancelled` gives key `actionCancelled`. `reads.test.ts`: `summarizeUnread` maps `action.updated` to `actionEdited` and `action.cancelled` to `actionCancelled`, and the order test includes them after `actionDone`.

- [ ] **Step 2: Implement** `history.ts`, `reads.ts`, `types.ts`.

- [ ] **Step 3: ActionList and ItemPanel** per the interfaces; `freshActions` in `ItemPanel` counts a row fresh by the extended rule.

- [ ] **Step 4: CSS**, after `.hg-act-when { ... }`, verbatim:

```css
.hg-act-edited { margin: 0; padding: 0 0 var(--hg-pn-meta-margin); font-size: var(--hg-hist-when-size); color: var(--hg-ink-3); }
.hg-act-cancel-mark {
  flex: none; width: var(--hg-check-size); font-size: var(--hg-chip-size); line-height: var(--hg-check-size); color: var(--hg-ink-3); text-align: center;
}
.hg-act.hg-act-cancelled .hg-act-body { color: var(--hg-ink-3); text-decoration: line-through; }
```

- [ ] **Step 5: i18n**

`en.json`: `vinnubord.panel.actionEdited: "changed {{when}} by {{name}}"`, `vinnubord.panel.actionCancelled: "cancelled"`, `vinnubord.panel.actionCancelReason: "Reason: {{reason}}"`, `vinnubord.history.actionUpdated: "changed an action: {{fields}}"`, `vinnubord.history.actionCancelled: "cancelled an action"`, `vinnubord.history.actionFields: { "body": "the text", "owner": "the owner", "payload": "the block" }`, `vinnubord.card.fresh.kinds.actionEdited: "action changed"`, `vinnubord.card.fresh.kinds.actionCancelled: "action cancelled"`. Icelandic: "breytt {{when}} af {{name}}", "fellt niður", "Ástæða: {{reason}}", "breytti handtaki: {{fields}}", "felldi niður handtak", fields "textanum", "eigandanum", "blokkinni", card kinds "handtak breytt", "handtak fellt niður".

- [ ] **Step 6: Build, test, look**: `npm run build`, `npm run test` green. `npm run dev` as the service user, open the item from task 2's live run (or any item with an edited action): the edited row shows "breytt í dag 10:12 af C" under it, the Saga tab shows "breytti handtaki: textanum", a cancelled action sits in "Afgreitt (n)" with "fellt niður" where the checkbox was. 390 px: nothing overflows.

- [ ] **Step 7: Commit** `feat(vinnubord): edited and cancelled actions in the panel and history`.

Verification set: build, test, the two looks. Nothing else.

---

### Task 5: Skill lines in metta2_new

**Files:**
- Modify: `D:\Claude Code\metta2\metta2_new\.claude\skills\huginn\SKILL.md`, section "Að haka við"

- [ ] **Step 1:** After the bullet that starts `- Handtak afgreitt:` insert, verbatim:

```
- Handtak sem varð rangt (planið breyttist, textinn á ekki lengur við): `huginn action set <aid> --body "..."` (líka `--owner` og `--payload-file`). Stofndagur helst, breytingin er merkt í pull og á vefnum. Aldrei haka rangt handtak sem gert og aldrei skrifa nýtt handtak í staðinn fyrir það gamla.
- Handtak sem á ekki lengur við: `huginn action cancel <aid> --reason "..."`. Það telst lokað, ekki gert: stöðvar hvorki `item close` né plan sem fer í done, og sýnist sem fellt niður.
```

- [ ] **Step 2:** In `D:\Claude Code\metta2\metta2_new`: `git add .claude/skills/huginn/SKILL.md`, commit `docs(huginn): action set and action cancel in the skill`, push (Claude pushes, the repo is on main).

---

### Task 6: Handover

**Files:**
- Create: `docs/progress/08-handtok-breytt.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1:** Progress doc in the format of `06-olesid.md`: tasks, commits (both repos), verification (`ok 10/10`), the acceptance run from the request (from metta2_new: `huginn action set 4d404216 --body "<new text>"` on item 800c8265 changes the text, `huginn pull` shows it with the edit mark, status and `waiting_on` unchanged; the build session does this if the action is still open, otherwise notes that it was already handled).
- [ ] **Step 2:** CLAUDE.md: Current state line for plan 8; Key Patterns "Actions are the only pending list" gets: an action that became wrong is changed with `action set`, one that no longer applies is cancelled with `action cancel`; cancelled is closed (`done_at` set, `cancelled` true), nothing that reads `done_at` changes. Commands section mentions nothing new (the CLI README lists them).
- [ ] **Step 3:** Commit `docs(vinnubord): plan 8 handover, action edits`. Push after the final whole branch review is clean.
