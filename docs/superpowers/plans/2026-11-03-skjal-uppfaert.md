# Skjal uppfært (same path is the same file): Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `huginn file add <item> <path> --repo-path <p>` on an item that already has a file at that repo path replaces that file in place (one row, one storage object, an "uppfært" stamp, a `file.updated` event) instead of adding a copy, and the web shows one file per path with who updated it and when.

**Architecture:** Migration 0014 adds `updated_at` and `updated_by` on `hg_files`, stamps them when `storage_path` changes, logs `file.updated`, carries `file_id` in both file events so `hg_unread` counts one document once, and guards the rule with a partial unique index on `(item_id, repo_path)`. The CLI does the replace (lookup by item and normalised path, byte compare, upload new, update row, remove old) in a new `putFile` in `cli/lib/ops.mjs`; `uploadFile` and `item create` are untouched. The web reads the new columns through one pure `fileStamp` rule for order, stamp line and fresh mark. The mirror adds an "uppfært" suffix only to replaced files. The web upload path (`src/vinnubord/lib/api.ts`) never sends `repo_path` and does not change.

**Tech Stack:** Postgres (Supabase, applied with the MCP `apply_migration`), Node ESM CLI, supabase-js smoke script, React 19 + TypeScript, vitest, react-i18next.

**Spec:** `docs/superpowers/specs/2026-11-03-skjal-uppfaert-design.md`

## Global Constraints

- Touch only `hg_` objects on the shared Supabase project `czdjxtsjgughimlazdmu`. No `DROP`, no `DELETE` in a migration; the migration uses `create or replace` for functions and `create or replace trigger` (Postgres 14+) instead of drop and create.
- Migration 0014 is applied through the MCP `apply_migration` (name `0014_hg_file_replace`) only after Heimir has run the cleanup SQL in the spec by hand and confirmed it. The unique index fails while duplicates exist. The build session asks Heimir, waits, then applies.
- No em dashes or hyphen dashes as punctuation anywhere: code comments, copy, docs, commit messages. Commas, periods or colons.
- Icelandic UI copy. New i18n keys go in `en.json` by hand, `npm run translate` regenerates `is.json`, then check the `is.json` diff and correct the Icelandic by hand where needed (keys alphabetical).
- Branch `vinnubord-11` off `main`. Commit prefixes `feat(vinnubord):`, `test(vinnubord):`, `docs(vinnubord):`, with the `Co-Authored-By:` trailer of the model that authored the commit.
- `npm run build` and `npm run test` green at the end of every task. `npm run smoke:hg` prints `ok 11/11` after Task 2, against the live DB, once 0014 is applied.
- Storage objects the smoke uploads are removed in its `finally`, so nothing is leaked in `hg-files`.
- Implementer budget per task: about 60 tool calls or 150k context, then commit what is green and report DONE_WITH_CONCERNS.

## Review Focus

1. Same size, different bytes (a one character edit in a plan) must replace, not report unchanged: the byte compare, not the size, decides. Pinned in Task 2 smoke step d.
2. The old storage object is already gone (removed by hand in the dashboard): the replace must still update the row and only warn about the remove. Pinned in Task 2 smoke step e.
3. The same `repo_path` on two different items is two files: the index and the lookup are per item. Pinned in Task 2 smoke step h.
4. A file first added by Árni and later replaced by Claude is fresh for Árni (the fresh rule reads `updated_by`, not `uploaded_by`), and the Skjöl line names Claude as the updater. Pinned in Task 3 `fileStamp` tests.
5. Path variants (`./docs/a.md`, `docs\a.md`, trailing space) are one key, and a path that is empty after normalising is refused. Pinned in Task 2 `normalizeRepoPath` tests.

Not testable here: `hg_unread` counting one document once needs a second participant's session (own events never count), so Heimir checks it on the board (Task 5 handover lists it).

## Size table

| Task | Files | Size |
|---|---|---|
| 1 Migration 0014 | `supabase/migrations/0014_hg_file_replace.sql`, `supabase/migrations/README.md` | S |
| 2 CLI replace and smoke | `cli/lib/write.mjs`, `cli/lib/write.test.mjs`, `cli/lib/ops.mjs`, `cli/lib/commands.mjs`, `scripts/hg-smoke.mjs` | M |
| 3 Web lib | `src/vinnubord/lib/types.ts`, `src/vinnubord/lib/files.ts` (new), `src/vinnubord/lib/files.test.ts` (new), `src/vinnubord/lib/history.ts`, `src/vinnubord/lib/history.test.ts`, `src/vinnubord/lib/reads.ts`, `src/vinnubord/lib/reads.test.ts` | M (7 files, but one rule and its tests; a reviewer judges them together) |
| 4 Files tab | `src/vinnubord/components/panel/FilesTab.tsx`, `src/shared/i18n/locales/en.json`, `src/shared/i18n/locales/is.json` | S |
| 5 Mirror and docs | `cli/lib/mirror.mjs`, `cli/lib/mirror.test.mjs`, `cli/README.md`, `CLAUDE.md`, `docs/progress/11-skjal-uppfaert.md` (new) | S |

---

### Task 1: Migration 0014

**Files:**
- Create: `supabase/migrations/0014_hg_file_replace.sql`
- Modify: `supabase/migrations/README.md` (one line in the Files list)

**Interfaces:**
- Produces: columns `hg_files.updated_at timestamptz` and `hg_files.updated_by uuid` (null until the first replace); event `file.updated` with `data = { name, file_id }`; `file.added` now also carries `file_id`; `hg_unread(p_project)` with the same signature as 0010b; unique index `hg_files_item_repo_path_key`.

- [ ] **Step 1: Write the migration**

Header comment in the style of 0012 (what and why, one short paragraph, names the spec). Then, in this order:

```sql
alter table hg_files
  add column updated_at timestamptz,
  add column updated_by uuid;
```

`create or replace function hg_stamp_author()`: copy the whole body from `supabase/migrations/0012_hg_action_edits.sql` verbatim and replace only the `hg_files` branch with:

```sql
  elsif tg_table_name = 'hg_files' then
    -- uploaded_by is the first author. A new storage object (file add on the
    -- same repo path, 0014) stamps updated_at and updated_by; nothing else does.
    if tg_op = 'INSERT' then
      new.uploaded_by := coalesce(auth.uid(), new.uploaded_by);
      new.updated_at := null;
      new.updated_by := null;
    else
      new.uploaded_by := old.uploaded_by;
      if new.storage_path is distinct from old.storage_path then
        new.updated_at := now();
        new.updated_by := coalesce(auth.uid(), new.updated_by);
      else
        new.updated_at := old.updated_at;
        new.updated_by := old.updated_by;
      end if;
    end if;
```

`create or replace function hg_log_event()`: copy the whole body from 0012 verbatim and replace only the `hg_files` branch with:

```sql
  elsif tg_table_name = 'hg_files' then
    if tg_op = 'INSERT' then
      insert into hg_events (created_at, project_id, item_id, actor, kind, data)
      values (clock_timestamp(), new.project_id, new.item_id,
              coalesce(v_uid, new.uploaded_by), 'file.added',
              jsonb_build_object('name', new.name, 'file_id', new.id));
    elsif new.storage_path is distinct from old.storage_path then
      insert into hg_events (created_at, project_id, item_id, actor, kind, data)
      values (clock_timestamp(), new.project_id, new.item_id,
              coalesce(v_uid, new.updated_by), 'file.updated',
              jsonb_build_object('name', new.name, 'file_id', new.id));
    end if;
```

Then:

```sql
create or replace trigger hg_files_log_event_trg
  after insert or update on hg_files
  for each row execute function hg_log_event();
```

`hg_unread`: the full text of `0010b_hg_unread_open_only.sql` (function, revoke, grant) with one change, the count:

```sql
  select e.item_id, e.kind,
         count(distinct coalesce(e.data->>'file_id', e.id::text))::bigint as n,
         max(e.created_at) as latest
```

with a comment above it: one document counts once however often it was replaced; events without `file_id` (every other kind, and file events from before 0014) count one each.

Last:

```sql
create unique index hg_files_item_repo_path_key
  on hg_files (item_id, repo_path) where repo_path is not null;
```

`hg_files_stamp_trg` (before insert or update, 0003) and `hg_files_analyse_trg` (after insert, 0007) are not touched.

- [ ] **Step 2: README line**

Append to the Files list in `supabase/migrations/README.md`:

`- 0014_hg_file_replace: updated_at and updated_by on hg_files, stamped and logged as file.updated when storage_path changes, file_id in both file events, hg_unread counts one file once, unique (item_id, repo_path) where repo_path is not null. Heimir runs the duplicate cleanup from the spec before it is applied.`

- [ ] **Step 3: Ask Heimir to run the cleanup, then apply**

Tell Heimir in one message: run the `delete from hg_files ...` statement from the spec section "Handvirk skref" in the SQL editor (26 rows expected) and answer when done. Wait. Then apply with the MCP tool `apply_migration`, name `0014_hg_file_replace`, query = the file content.

- [ ] **Step 4: Verify**

MCP `execute_sql`:

```sql
select column_name from information_schema.columns
where table_name = 'hg_files' and column_name in ('updated_at', 'updated_by');
select indexname from pg_indexes where tablename = 'hg_files' and indexname = 'hg_files_item_repo_path_key';
select count(*) from (select item_id, repo_path from hg_files where repo_path is not null group by 1, 2 having count(*) > 1) d;
```

Expected: two column rows, one index row, count 0.

- [ ] **Step 5: Commit**

`git add supabase/migrations/0014_hg_file_replace.sql supabase/migrations/README.md`, message `feat(vinnubord): migration 0014, a replaced file is stamped, logged and unique per path`.

---

### Task 2: CLI replace and smoke scenario 11

**Files:**
- Modify: `cli/lib/write.mjs` (new export after `storagePath`), `cli/lib/write.test.mjs`, `cli/lib/ops.mjs` (new export after `uploadFile`), `cli/lib/commands.mjs:381-394` (`file add`), `scripts/hg-smoke.mjs`

**Interfaces:**
- Consumes: Task 1 columns and events.
- Produces: `normalizeRepoPath(input: string): string` (throws `Error('Slóðin er tóm.')`), `putFile(client, { projectId, itemId, userId, name, bytes, mime, repoPath }) => Promise<{ file, outcome }>` with `outcome` one of `'added' | 'replaced' | 'unchanged'` and `file` the `hg_files` row (`select('*')`).

- [ ] **Step 1: Failing tests for `normalizeRepoPath`** in `cli/lib/write.test.mjs`, new `describe('normalizeRepoPath')` after `describe('upload rules')`:

```js
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
```

- [ ] **Step 2: Run** `npx vitest run cli/lib/write.test.mjs`. Expected: FAIL, `normalizeRepoPath is not a function` (or not exported).

- [ ] **Step 3: Implement `normalizeRepoPath(input)`** in `cli/lib/write.mjs` after `storagePath`: `String(input).trim()`, `\\` to `/`, repeated `/` to one, strip leading `./` (repeat while it matches), throw when the result is `''`. Short comment: the key of "same path is the same file" (0014), so variants of one path are one key.

- [ ] **Step 4: Run** `npx vitest run cli/lib/write.test.mjs`. Expected: PASS.

- [ ] **Step 5: Implement `putFile`** in `cli/lib/ops.mjs` after `uploadFile`:

```js
// file add with --repo-path (0014): the same repo path on the same item is the
// same file. No path, or no row at that path: uploadFile. Same bytes as the
// stored object: nothing is written. Otherwise the new object goes up under a
// new key, the row is updated (the triggers stamp updated_at and log
// file.updated) and the old object is removed; a failed update removes the
// new object again, a failed remove of the old one only warns.
export async function putFile(client, input) {
```

Steps inside, in this order: no `repoPath` → `{ file: await uploadFile(client, input), outcome: 'added' }`. Else `maybeSingle()` on `hg_files` by `item_id` and `repo_path`. None → `uploadFile`. The race (two commands, same path, no row yet) ends in `uploadFile`'s insert error: there, after the object is removed, `fail` with `Skjalið er þegar til, keyrðu skipunina aftur` when `error.code === '23505'`, otherwise the existing `Gat ekki skráð ${name}`. That is the only change to `uploadFile`. Row found and `Number(row.size) === bytes.length` → `downloadFile(client, row.storage_path)`; if it returns and `Buffer.compare(old, bytes) === 0` → `{ file: row, outcome: 'unchanged' }`; a download error counts as different. Different → upload under `storagePath(projectId, itemId, randomUUID(), name)` with `upsert: false`; `update({ name, storage_path, size, mime })` `.eq('id', row.id).select('*').single()`; on error remove the new object and `fail(\`Gat ekki uppfært ${name}\`, error)`; then `client.storage.from(FILES_BUCKET).remove([row.storage_path])`, on error `console.error(\`Viðvörun: gamla eintakið ${row.storage_path} var ekki fjarlægt: ${error.message}\`)`; return `{ file: data, outcome: 'replaced' }`.

- [ ] **Step 6: `file add` uses it** in `cli/lib/commands.mjs`: `repoPath` becomes `flags['repo-path'] !== undefined ? normalizeRepoPath(flags['repo-path']) : null` (import from `./write.mjs`); call `putFile`; text by outcome:

- added: `Skrá ${name} hlaðið upp #${id} á verk #${item}.` (unchanged wording)
- replaced: `Skjal ${name} uppfært #${id} á verk #${item}.`
- unchanged: `Skjal ${name} óbreytt #${id} á verk #${item}, ekkert skrifað.`

json: `{ ok: true, id, outcome }`.

- [ ] **Step 7: Smoke scenario 11** in `scripts/hg-smoke.mjs`: `TOTAL = 11`, `import { putFile } from '../cli/lib/ops.mjs'`, a `let smokeObjects = []` beside `extraItems`, and in `finally` after the item deletes: `if (smokeObjects.length) { const r = await sb.storage.from('hg-files').remove(smokeObjects); if (r.error) console.error(...) }`. Every `putFile` result with outcome `added` or `replaced` pushes `file.storage_path` to `smokeObjects` (push before asserting, so a failed assertion still cleans up). After scenario 10's `passed++`:

```js
scenario = '11 file replace'
const put = (bytes, repoPath, id = itemId) =>
  putFile(sb, { projectId, itemId: id, userId: me, name: 'plan.md', bytes: Buffer.from(bytes), mime: 'text/markdown', repoPath })
// a: first add, path normalised by the caller (the CLI), stored as given
const a11 = await put('v1', 'docs/plan.md')
smokeObjects.push(a11.file.storage_path)
expect(a11.outcome === 'added' && a11.file.updated_at === null && a11.file.updated_by === null, `first add ${JSON.stringify(a11)}`)
// b: other bytes replace in place: same id, new object, stamp, old object gone
const b11 = await put('v2', 'docs/plan.md')
smokeObjects.push(b11.file.storage_path)
expect(b11.outcome === 'replaced' && b11.file.id === a11.file.id && b11.file.storage_path !== a11.file.storage_path, `replace ${JSON.stringify(b11)}`)
expect(b11.file.updated_by === me && b11.file.updated_at !== null, 'replace stamp missing')
const gone = await sb.storage.from('hg-files').download(a11.file.storage_path)
expect(gone.error !== null, 'old object still in storage')
// c: same bytes again write nothing
const c11 = await put('v2', 'docs/plan.md')
expect(c11.outcome === 'unchanged' && c11.file.storage_path === b11.file.storage_path, `unchanged ${JSON.stringify(c11)}`)
// d: same size, other bytes: the compare reads bytes, not size
const d11 = await put('v3', 'docs/plan.md')
smokeObjects.push(d11.file.storage_path)
expect(d11.outcome === 'replaced' && d11.file.storage_path !== b11.file.storage_path, 'same size other bytes was not replaced')
// e: old object already gone by hand: the row is still updated
must(await sb.storage.from('hg-files').remove([d11.file.storage_path]), 'remove by hand')
const e11 = await put('v4', 'docs/plan.md')
smokeObjects.push(e11.file.storage_path)
expect(e11.outcome === 'replaced' && e11.file.id === a11.file.id, 'replace after a missing old object failed')
// f: events: one file.added and three file.updated, all with this file_id
const fe = (await readEvents()).filter((e) => e.data?.file_id === a11.file.id)
expect(fe.filter((e) => e.kind === 'file.added').length === 1 && fe.filter((e) => e.kind === 'file.updated').length === 3, `file events ${JSON.stringify(countKinds(fe))}`)
expect(fe.every((e) => e.data.name === 'plan.md'), 'file event without name')
// g: a second row at the same path is refused by the index
const dup = await sb.from('hg_files').insert({ project_id: projectId, item_id: itemId, name: 'plan.md', storage_path: `${projectId}/${itemId}/dup_plan.md`, size: 2, repo_path: 'docs/plan.md', uploaded_by: me })
expect(dup.error?.code === '23505', `duplicate insert gave ${JSON.stringify(dup.error)}`)
// h: the same path on another item is its own file, and files without a path still pile up
const hItem = must(await sb.from('hg_items').insert({ project_id: projectId, title: 'smoke 11 h', status: 'parked', created_by: me }).select('id').single(), 'insert item h')
extraItems.push(hItem.id)
const h11 = await put('v1', 'docs/plan.md', hItem.id)
smokeObjects.push(h11.file.storage_path)
expect(h11.outcome === 'added' && h11.file.id !== a11.file.id, 'same path on another item was treated as the same file')
const n1 = await put('x', null)
smokeObjects.push(n1.file.storage_path)
const n2 = await put('x', null)
smokeObjects.push(n2.file.storage_path)
expect(n1.outcome === 'added' && n2.outcome === 'added' && n1.file.id !== n2.file.id, 'files without a path were merged')
passed++
```

`readEvents` already selects `kind, data` on `itemId`.

- [ ] **Step 8: Run** `npm run smoke:hg`. Expected: `ok 11/11`. Then `npm run test` (all vitest green) and `npm run build`.

- [ ] **Step 9: Hand check from the shell** (the CLI signs in as the service user on Heimir's PC): `node cli/huginn.mjs file add <an open item id> docs/superpowers/specs/2026-11-03-skjal-uppfaert-design.md --repo-path ./docs\superpowers\specs\2026-11-03-skjal-uppfaert-design.md` twice. First prints `Skrá ... hlaðið upp`, second prints `Skjal ... óbreytt`. Use the item of this plan if Heimir has one on the board, otherwise skip and say so.

- [ ] **Step 10: Commit**

`git add cli/lib/write.mjs cli/lib/write.test.mjs cli/lib/ops.mjs cli/lib/commands.mjs scripts/hg-smoke.mjs`, message `feat(vinnubord): file add replaces the file at the same repo path, smoke 11`.

---

### Task 3: Web lib: types, `fileStamp`, history and unread

**Files:**
- Modify: `src/vinnubord/lib/types.ts:84-95` (`FileRow`), `src/vinnubord/lib/history.ts`, `src/vinnubord/lib/history.test.ts`, `src/vinnubord/lib/reads.ts`, `src/vinnubord/lib/reads.test.ts`
- Create: `src/vinnubord/lib/files.ts`, `src/vinnubord/lib/files.test.ts`

**Interfaces:**
- Produces: `FileRow.updated_at: string | null`, `FileRow.updated_by: string | null`; `fileStamp(file: Pick<FileRow, 'created_at' | 'uploaded_by' | 'updated_at' | 'updated_by'>): FileStamp` with `type FileStamp = { at: string | null; by: string; updated: boolean }`; `sortFiles(files: FileRow[]): FileRow[]` (new array, ascending by stamp time, a null time first, ties by `id`); history line key `fileUpdated` with `params { name }`; unread kind `'file'` for `file.updated`.

- [ ] **Step 1: Types.** Add `updated_at: string | null` and `updated_by: string | null` to `FileRow`. Run `npx tsc -b` and fix every object literal that builds a `FileRow` in tests (expected: `panel.test.ts`, `cards.test.ts` or wherever a `FileRow` fixture lives; add the two null fields).

- [ ] **Step 2: Failing tests** in `src/vinnubord/lib/files.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { fileStamp, sortFiles } from './files'
import type { FileRow } from './types'

const row = (p: Partial<FileRow>): FileRow => ({
  id: 'f', created_at: '2026-11-03T06:07:00Z', project_id: 'p', item_id: 'i', name: 'a.md', storage_path: 'p/i/x_a.md',
  size: 1, mime: null, repo_path: null, uploaded_by: 'arni', updated_at: null, updated_by: null, ...p,
})

describe('fileStamp', () => {
  it('a never replaced file is stamped by its upload', () => {
    expect(fileStamp(row({}))).toEqual({ at: '2026-11-03T06:07:00Z', by: 'arni', updated: false })
  })
  it('a replaced file is stamped by its last replace, by the replacer', () => {
    expect(fileStamp(row({ updated_at: '2026-11-03T07:55:00Z', updated_by: 'claude' }))).toEqual({
      at: '2026-11-03T07:55:00Z', by: 'claude', updated: true,
    })
  })
  it('updated_at without updated_by keeps the uploader as author', () => {
    expect(fileStamp(row({ updated_at: '2026-11-03T07:55:00Z' })).by).toBe('arni')
  })
})

describe('sortFiles', () => {
  it('orders by the stamp, so a replaced file moves to where a new one would', () => {
    const a = row({ id: 'a', created_at: '2026-11-01T10:00:00Z', updated_at: '2026-11-03T09:00:00Z', updated_by: 'claude' })
    const b = row({ id: 'b', created_at: '2026-11-02T10:00:00Z' })
    const c = row({ id: 'c', created_at: null })
    expect(sortFiles([a, b, c]).map((f) => f.id)).toEqual(['c', 'b', 'a'])
  })
  it('does not change the input', () => {
    const list = [row({ id: 'b', created_at: '2026-11-02T10:00:00Z' }), row({ id: 'a', created_at: '2026-11-01T10:00:00Z' })]
    sortFiles(list)
    expect(list.map((f) => f.id)).toEqual(['b', 'a'])
  })
})
```

- [ ] **Step 3: Run** `npx vitest run src/vinnubord/lib/files.test.ts`. Expected: FAIL, cannot find module `./files`.

- [ ] **Step 4: Implement** `src/vinnubord/lib/files.ts` with a two line header comment (one rule for the Skjöl tab, the sort and the fresh mark: a replaced file is stamped by its last replace). `fileStamp` and `sortFiles` as in Interfaces; time of a null or unparsable `at` is `Number.NEGATIVE_INFINITY` like `timeOf` in `history.ts`.

- [ ] **Step 5: Run** the file test. Expected: PASS.

- [ ] **Step 6: History.** In `src/vinnubord/lib/history.test.ts` next to the `file.added` assertion (line 68) add:

```ts
expect(describeEvent(ev('e2', null, 'file.updated', { name: 'spec.md', file_id: 'f1' }), nameOf)).toMatchObject({ key: 'fileUpdated', params: { name: 'spec.md' } })
```

Run, expected FAIL (key `other`). In `history.ts` add `case 'file.updated': return line('fileUpdated', { name: str(data.name) ?? '?' })` after the `file.added` case. Run, PASS.

- [ ] **Step 7: Unread.** In `src/vinnubord/lib/reads.test.ts` add a test in the `summarizeUnread` describe:

```ts
it('file.updated counts as a file', () => {
  const m = summarizeUnread([{ item_id: 'i1', kind: 'file.updated', n: 1, latest: '2026-11-03T07:55:00Z' }])
  expect(m.get('i1')?.kinds).toEqual([{ kind: 'file', n: 1 }])
})
```

Run, expected FAIL (empty map). Add `'file.updated': 'file'` to `KIND_OF` in `reads.ts` under `'file.added'`. Run, PASS.

- [ ] **Step 8:** `npm run test` and `npm run build` green. Commit: `git add src/vinnubord/lib/types.ts src/vinnubord/lib/files.ts src/vinnubord/lib/files.test.ts src/vinnubord/lib/history.ts src/vinnubord/lib/history.test.ts src/vinnubord/lib/reads.ts src/vinnubord/lib/reads.test.ts` plus any fixture files from Step 1, message `feat(vinnubord): file stamp rule, file.updated in history and unread`.

---

### Task 4: Files tab and copy

**Files:**
- Modify: `src/vinnubord/components/panel/FilesTab.tsx:126-157`, `src/shared/i18n/locales/en.json` (`vinnubord.panel.files`, `vinnubord.history`), `src/shared/i18n/locales/is.json` (generated, then checked)

**Interfaces:**
- Consumes: `fileStamp`, `sortFiles` from `../../lib/files` (Task 3).

- [ ] **Step 1: Copy.** In `en.json` add `"updatedBy": "Updated: {{name}}, {{when}}"` under `vinnubord.panel.files` (after `"by"`) and `"fileUpdated": "updated {{name}}"` under `vinnubord.history` after `"fileAdded"`. Run `npm run translate`. In `is.json` the two keys must read `"updatedBy": "Uppfært: {{name}}, {{when}}"` and `"fileUpdated": "uppfærði {{name}}"` (alphabetical position); correct by hand if the generator gave something else, and check `git diff src/shared/i18n/locales/is.json` shows only those two lines.

- [ ] **Step 2: Tab.** In `FilesTab`, `files.map(...)` becomes `sortFiles(files).map(...)`; per file `const stamp = fileStamp(f)`, `by = participants.find((p) => p.user_id === stamp.by)`, `isNew = fresh(stamp.at, stamp.by)`, and the meta text is `t(stamp.updated ? 'vinnubord.panel.files.updatedBy' : 'vinnubord.panel.files.by', { name: by?.display_name ?? '?', when: stamp.at ? formatStamp(stamp.at) : '' })`. Update the comment above the component (line 20 to 23) to say a replaced file shows its last replace.

- [ ] **Step 3: Verify in the browser.** `npm run dev`, open an item on metta that has a replaced file (after Task 2 Step 9, or any item Claude writes to twice during this build): the Skjöl tab lists that path once with "Uppfært: Claude, ..." and Saga has "uppfærði <name>". If no replaced file exists yet, say so in the report and leave the check to the handover.

- [ ] **Step 4:** `npm run build`, `npm run test`. Commit: `git add src/vinnubord/components/panel/FilesTab.tsx src/shared/i18n/locales/en.json src/shared/i18n/locales/is.json`, message `feat(vinnubord): files tab shows one file per path with its update stamp`.

---

### Task 5: Mirror suffix, docs and handover

**Files:**
- Modify: `cli/lib/mirror.mjs:194-200` (`fileLine`), `cli/lib/mirror.test.mjs`, `cli/README.md` (the `file add` row and the Skrár bullet at line 75), `CLAUDE.md`
- Create: `docs/progress/11-skjal-uppfaert.md`

- [ ] **Step 1: Failing test** in `cli/lib/mirror.test.mjs`, in the `renderItemMd` describe (fixtures from line 103; add a file row with `repo_path: 'docs/plan.md'`, `updated_at: '2026-11-03T07:55:28.517Z'` to the item used there, or build a second item for the test):

```js
it('a replaced file carries its update stamp, an untouched one is unchanged', () => {
  const md = renderItemMd(it, data.plans, data.actions, data.questions, data.rulings, participants, {
    files: fileTargets(it, [...files, replaced], projectId),
  })
  expect(md).toContain('í repoinu, docs/plan.md (uppfært 2026-11-03T07:55:28.517Z)')
  expect(md).not.toMatch(/\(uppfært[^)]*\)\n.*(afrit|bendiskrá)/)
})
```

Shape the fixture names to the existing test (`it`, `data`, `participants`, `projectId` as that file names them).

- [ ] **Step 2: Run** `npx vitest run cli/lib/mirror.test.mjs`. Expected: FAIL (no suffix).

- [ ] **Step 3: Implement.** `fileLine` appends `` ` (uppfært ${iso(file.updated_at)})` `` to the returned line when `file.updated_at` is set, for every kind. `iso` is the existing helper in `mirror.mjs` (the spec's `YYYY-MM-DD HH:MM` is rendered as the file's existing ISO form, so `item.md` stamps stay one format: planner's call).

- [ ] **Step 4: Run** the mirror test, PASS. `npm run test`.

- [ ] **Step 5: `cli/README.md`.** The `file add` row example stays; add after the table row text: `(sama --repo-path á sama verki uppfærir skjalið í stað þess að bæta við eintaki; óbreytt skjal skrifar ekkert)`. In the Skrár bullet at line 75 add one sentence: `Skrá með --repo-path er eitt skjal á hverja slóð á hverju verki: sama slóð aftur uppfærir röðina og eintakið, sömu bæti gera ekkert, og slóðin er stöðluð (bakstrik, ./, bil).`

- [ ] **Step 6: `CLAUDE.md`.** Current state: add a Plan 11 paragraph after Plan 10 in the style of the others (what it is, migration 0014, test count from `npm run test`, `npm run smoke:hg` printed `ok 11/11`, handover path). Supabase `hg_` tables: `hg_files` line gets `updated_at`, `updated_by` (0014). Migrations list: a `0014_hg_file_replace` line in the style of 0012 (applied through MCP 2026-11-03, what it does, "Heimir ran the duplicate cleanup first", smoke scenario 11). Key Patterns: a new bullet **Same repo path is the same file.** (`putFile` in `cli/lib/ops.mjs`, byte compare, `fileStamp` in `lib/files.ts`, one document counts once in `hg_unread`, web uploads carry no path). Commands: none. Tech stack test file list: `src/vinnubord/lib/files.ts` is covered by the existing `lib/` wording. Folder structure comment for `lib/`: add `files (file stamp and order)` to the list.

- [ ] **Step 7: Handover** `docs/progress/11-skjal-uppfaert.md` in the style of `docs/progress/10-listi.md`: date, branch and commit range, plan and spec paths, status, "Hvað var gert" per task, what Heimir checks (open an item Claude wrote to twice: one row in Skjöl with "Uppfært: Claude", "uppfærði" in Saga, the card says "+1 skjal" not "+N skjöl" after several replaces, the cleanup count he saw), what is open (orphaned storage objects from the cleanup, nothing else known).

- [ ] **Step 8:** `npm run build`, `npm run test`. Commit: `git add cli/lib/mirror.mjs cli/lib/mirror.test.mjs cli/README.md CLAUDE.md docs/progress/11-skjal-uppfaert.md`, message `docs(vinnubord): plan 11 handover, mirror stamp, CLI and CLAUDE.md`.

---

## After the tasks

Final whole branch review on Fable, fix round reviewed again until clean (global rule). Then merge to `main`, check the repo is clean and not behind `origin`, push (Claude pushes, never Heimir). Vercel deploys `main`.
