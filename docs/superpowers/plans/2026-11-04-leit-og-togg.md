# Leit og tögg: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ctrl+F reaches the board search, the search reads everything on an item plus hidden keywords, tags come from a fixed per project list managed in the settings, and the existing tags are cleaned once.

**Architecture:** Migration 0016 adds `hg_tags` (seeded with the 36 starting tags for metta), `hg_items.keywords`, three security invoker RPCs for rename, merge and delete that silence the item stamp, touch and event triggers through a `when` clause on `hg.silent`, and the touch trigger ignores `keywords`. Migration 0016b, applied after Heimir runs the computed cleanup script and after hg-analyse version 12 is live, adds the trigger that canonicalises item tags against the list and refuses the rest. The web gets a pure search index (`lib/search.ts`) fed to `matches` through `ctx.text`, a `searchRequest` counter from `BoardPage` to `TopBar` for Ctrl+F, a `TagsEditor` settings section, and a new item sheet that picks from the list. The CLI gets `tag list`, `tag add`, `--keywords` and the `Leitarorð:` line in `item.md`. hg-analyse picks tags from the list and writes keywords.

**Tech Stack:** React 19 + TypeScript, vitest, react-i18next, Supabase (Postgres triggers and RPC, Realtime), Node ESM CLI, Deno edge function (`npm:@anthropic-ai/sdk`), Supabase MCP for migrations and the function deploy.

**Spec:** `docs/superpowers/specs/2026-11-04-leit-og-togg-design.md`

## Global Constraints

- Supabase project `czdjxtsjgughimlazdmu` is shared: only `hg_` objects. Migrations are applied with the MCP `apply_migration` (name without `.sql`), never `supabase db push`. No DROP and no DELETE in a migration (`create or replace trigger` replaces the three item triggers without a drop). Heimir runs `supabase/manual/2026-11-04-hg-tag-cleanup.sql` himself in the SQL editor.
- Order of the database work: 0016 first (Task 1), hg-analyse version 12 live (Task 8) before Heimir runs the cleanup, 0016b only after the cleanup (Task 11). 0016b before version 12 would make every analysis fail with `22023`.
- **Never a coloured left border, stripe or bar** on a tag row, a chip or a menu row.
- No em dashes or hyphen dashes as punctuation anywhere: code comments, copy, docs, SQL comments, commit messages. Commas, periods or colons.
- Icelandic UI copy. New i18n keys go in `en.json` by hand under `vinnubord.*`, `npm run translate` regenerates `is.json`, then check the `is.json` diff and set the Icelandic exactly as this plan gives it (keys alphabetical). Validation reasons and database error texts are Icelandic strings in code.
- Rules below the token block in `vinnubord.css` read only tokens. This plan adds no CSS rule unless a task says so.
- Pure logic in `src/vinnubord/lib/` with a vitest file beside it; test files import from `vitest` explicitly. CLI copies in `cli/lib/*.mjs` with `parity.test.mjs` pinning them. `supabase/functions/hg-analyse/lib.ts` stays import free and Deno free.
- Branch `vinnubord-14` off `main`. Commit prefixes `feat(vinnubord):`, `fix(vinnubord):`, `test(vinnubord):`, `docs(vinnubord):`, `chore(vinnubord):`, with the `Co-Authored-By:` trailer of the model that authored the commit.
- `npm run build` and `npm run test` green at the end of every task. Tasks that touch `supabase/functions/hg-analyse/index.ts` also run `npx -y deno@2 check --no-lock --node-modules-dir=none supabase/functions/hg-analyse/index.ts`.
- Implementer budget per task: about 60 tool calls or 150k context, then commit what is green and report DONE_WITH_CONCERNS. Read code in large ranges with Read, not sed slices.
- Model routing (global rules): Tasks 2, 6, 10 and 12 are transcription of code, copy and docs in this plan and go to Sonnet; Tasks 1, 3, 4, 5, 7, 8, 9 and 11 need judgment and go to Opus. Every code task gets a review (Opus), the final whole branch review runs on Fable.
- Each task names its verification set. The implementer checks nothing else; reviewers judge the whole diff.

## Review Focus

1. Esc in the search field while it holds text: the query is cleared and the field loses focus in one press, and the side panel behind stays open. Pinned in Task 4 (manual check 2) since `TopBar` is JSX.
2. A rename to a name that differs from another tag only in case (`Smokes` beside `smokes`): the unique index on `lower(name)` refuses it, the web shows `Taggið er þegar á listanum.` and nothing on any item changes. Pinned in Task 11 (smoke 13 step g) and Task 5 (`tagErrorMessage` test).
3. `huginn item set <id> --keywords ...` on an open item: `updated_at` does not move, no event is logged, nothing becomes unread for anyone. Pinned in Task 11 (smoke 13 step h).
4. An analysis whose model tags are all off the list: the item gets no tags, every model tag lands in keywords, `óflokkað` is added only when it is on the list, and `summary` and `body` still write. Pinned in Task 8 (`applyAnalysis` tests).
5. `foldSearch` keeps ð, þ and æ, so "þ" never matches "th" and "sæti" never matches "saeti", while "sýning" and "syning" are the same; a query of only spaces matches everything. Pinned in Task 3 (`foldSearch` and `matches` tests).

## Size table

| Task | Files | Size |
|---|---|---|
| 1 Migration 0016, types, board load | `supabase/migrations/0016_hg_tags_keywords.sql` (new), `supabase/migrations/README.md`, `src/vinnubord/lib/types.ts`, `src/vinnubord/lib/api.ts`, `src/vinnubord/hooks/useBoardData.ts`, `cli/lib/client.mjs` | M |
| 2 Tag rule, web and CLI | `src/vinnubord/lib/tags.ts` (new), `src/vinnubord/lib/tags.test.ts` (new), `cli/lib/write.mjs`, `cli/lib/write.test.mjs`, `cli/lib/parity.test.mjs` | S |
| 3 Search index and fold | `src/vinnubord/lib/search.ts` (new), `src/vinnubord/lib/search.test.ts` (new), `src/vinnubord/lib/filters.ts`, `src/vinnubord/lib/filters.test.ts`, `src/vinnubord/lib/cards.ts`, `src/vinnubord/lib/cards.test.ts`, `src/vinnubord/lib/views.ts`, `src/vinnubord/pages/BoardPage.tsx` | M |
| 4 Ctrl+F and Esc | `src/vinnubord/pages/BoardPage.tsx`, `src/vinnubord/components/TopBar.tsx` | S |
| 5 Tag API and settings editor | `src/vinnubord/lib/api.ts`, `src/vinnubord/lib/tags.ts`, `src/vinnubord/lib/tags.test.ts`, `src/vinnubord/components/settings/TagsEditor.tsx` (new), `src/vinnubord/pages/ProjectSettingsPage.tsx`, `src/shared/i18n/locales/en.json`, `src/shared/i18n/locales/is.json` | M |
| 6 New item sheet picks from the list | `src/vinnubord/components/NewItemSheet.tsx`, `src/vinnubord/pages/BoardPage.tsx`, `src/vinnubord/lib/newItem.ts`, `src/vinnubord/lib/newItem.test.ts`, `en.json`, `is.json` | S |
| 7 CLI: tag list, tag add, keywords, mirror | `cli/lib/commands.mjs`, `cli/lib/ops.mjs`, `cli/lib/write.mjs`, `cli/lib/write.test.mjs`, `cli/lib/mirror.mjs`, `cli/lib/mirror.test.mjs`, `cli/README.md` | M |
| 8 hg-analyse version 12 | `supabase/functions/hg-analyse/lib.ts`, `supabase/functions/hg-analyse/lib.test.ts`, `supabase/functions/hg-analyse/index.ts` | M |
| 9 Cleanup script, 0016b file, action on Heimir | `supabase/manual/2026-11-04-hg-tag-cleanup.sql` (new), `supabase/migrations/0016b_hg_tags_check.sql` (new), `supabase/migrations/README.md` | M |
| 10 Skill rules and keywords on the existing items | `D:/Claude Code/metta2/metta2_new/.claude/skills/huginn/SKILL.md`, data writes through the CLI | M |
| 11 Apply 0016b, smoke 13 | `scripts/hg-smoke.mjs` | M |
| 12 Handover and CLAUDE.md | `docs/progress/14-leit-og-togg.md` (new), `CLAUDE.md` | S |

No L task. Task 1 touches 6 files but they are one change: the schema and the two loaders that read it. Task 3 touches 8 files because `matches` gains a field and every caller and test follows; a reviewer judges it as one signature change.

---

### Task 1: Migration 0016, types, board load

**Files:**
- Create: `supabase/migrations/0016_hg_tags_keywords.sql`
- Modify: `supabase/migrations/README.md` (the Files list)
- Modify: `src/vinnubord/lib/types.ts` (`Item`, new `Tag`, `BoardData`)
- Modify: `src/vinnubord/lib/api.ts:52-140` (`loadBoard`)
- Modify: `src/vinnubord/hooks/useBoardData.ts:9-24` (`REALTIME_TABLES`)
- Modify: `cli/lib/client.mjs:112-154` (`loadBoard`)

**Interfaces:**
- Produces: `type Tag = { id: string; created_at: string | null; project_id: string; name: string; created_by: string | null }`, `Item.keywords: string[]`, `BoardData.tags: Tag[]`, CLI `loadBoard(...).tags`. Database: table `hg_tags`, column `hg_items.keywords`, functions `hg_tags_dedupe(text[])`, `hg_tags_json_replace(jsonb, text, text)`, `hg_tag_rename(uuid, text)`, `hg_tag_merge(uuid, uuid) returns integer`, `hg_tag_delete(uuid) returns integer`, the GUC `hg.silent`.

- [ ] **Step 1: Write the migration file**

`supabase/migrations/0016_hg_tags_keywords.sql`, verbatim:

```sql
-- 0016_hg_tags_keywords
-- Fixed tag list per project, hidden search keywords on items, and the three
-- tag RPCs (spec 2026-11-04-leit-og-togg-design.md, 4.3 and 4.4). The RPCs
-- set hg.silent for their transaction, and the item stamp, touch and event
-- triggers are redefined with a when clause that skips them while it is on,
-- so a rename, merge or delete writes no stamp and no item.updated. The touch
-- trigger also ignores keywords, so a keywords write marks nothing. The 36
-- starting tags of metta are inserted here so the list is never empty; the
-- computed cleanup in supabase/manual runs after this and before 0016b.

alter table hg_items add column keywords text[] not null default '{}';

create or replace function hg_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_table_name = 'hg_items'
     and to_jsonb(new) - 'pos_x' - 'pos_y' - 'updated_at' - 'updated_by' - 'analyse_lock_until' - 'keywords'
       = to_jsonb(old) - 'pos_x' - 'pos_y' - 'updated_at' - 'updated_by' - 'analyse_lock_until' - 'keywords' then
    new.updated_at := old.updated_at;
    new.updated_by := old.updated_by;
    return new;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace trigger hg_items_stamp_trg
  before insert or update on hg_items
  for each row
  when (current_setting('hg.silent', true) is distinct from 'on')
  execute function hg_stamp_author();

create or replace trigger hg_items_touch_trg
  before update on hg_items
  for each row
  when (current_setting('hg.silent', true) is distinct from 'on')
  execute function hg_touch_updated_at();

create or replace trigger hg_items_log_event_trg
  after insert or update on hg_items
  for each row
  when (current_setting('hg.silent', true) is distinct from 'on')
  execute function hg_log_event();

create table hg_tags (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  project_id uuid not null references hg_projects(id) on delete cascade,
  name text not null,
  created_by uuid,
  constraint hg_tags_name_check check (
    name = btrim(name) and name <> '' and char_length(name) <= 40 and position(',' in name) = 0
  )
);

create unique index hg_tags_project_name_key on hg_tags (project_id, lower(name));

alter table hg_tags enable row level security;

create policy hg_tags_select on hg_tags for select to authenticated
  using (hg_is_participant(project_id));
create policy hg_tags_insert on hg_tags for insert to authenticated
  with check (hg_is_participant(project_id));
create policy hg_tags_update on hg_tags for update to authenticated
  using (hg_is_participant(project_id)) with check (hg_is_participant(project_id));
create policy hg_tags_delete on hg_tags for delete to authenticated
  using (hg_is_participant(project_id));

-- created_by from auth.uid(), kept on update (same rule as hg_views)
create trigger hg_tags_stamp_trg
  before insert or update on hg_tags
  for each row execute function hg_views_stamp();

alter publication supabase_realtime add table hg_tags;

-- Exact duplicates dropped, first occurrence kept, order kept.
create or replace function hg_tags_dedupe(p_tags text[])
returns text[]
language sql
immutable
set search_path = public
as $$
  select coalesce(array_agg(s.t order by s.n), '{}')
  from (
    select u.t, min(u.n) as n
    from unnest(coalesce(p_tags, '{}')) with ordinality as u(t, n)
    group by u.t
  ) s;
$$;

-- A view's tag list with p_old replaced by p_new (removed when p_new is null),
-- duplicates dropped, order kept.
create or replace function hg_tags_json_replace(p_tags jsonb, p_old text, p_new text)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select coalesce(jsonb_agg(s.t order by s.n), '[]'::jsonb)
  from (
    select u.t, min(u.n) as n
    from (
      select case when x.value = p_old then p_new else x.value end as t, x.ordinality as n
      from jsonb_array_elements_text(coalesce(p_tags, '[]'::jsonb)) with ordinality as x
    ) u
    where u.t is not null
    group by u.t
  ) s;
$$;

create or replace function hg_tag_rename(p_tag uuid, p_name text)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_project uuid;
  v_old text;
  v_name text := btrim(p_name);
begin
  select project_id, name into v_project, v_old from hg_tags where id = p_tag;
  if v_project is null then
    raise exception 'Taggið fannst ekki.' using errcode = '22023';
  end if;
  if v_name = v_old then
    return;
  end if;
  perform set_config('hg.silent', 'on', true);
  update hg_tags set name = v_name where id = p_tag;
  update hg_items set tags = hg_tags_dedupe(array_replace(tags, v_old, v_name))
    where project_id = v_project and v_old = any(tags);
  update hg_views set filter = jsonb_set(filter, '{tags}', hg_tags_json_replace(filter->'tags', v_old, v_name))
    where project_id = v_project and filter->'tags' ? v_old;
end;
$$;

create or replace function hg_tag_merge(p_from uuid, p_into uuid)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_project uuid;
  v_from text;
  v_into_project uuid;
  v_into text;
  v_n integer;
begin
  if p_from = p_into then
    raise exception 'Ekki hægt að sameina tagg við sjálft sig.' using errcode = '22023';
  end if;
  select project_id, name into v_project, v_from from hg_tags where id = p_from;
  select project_id, name into v_into_project, v_into from hg_tags where id = p_into;
  if v_project is null or v_into_project is null then
    raise exception 'Taggið fannst ekki.' using errcode = '22023';
  end if;
  if v_project <> v_into_project then
    raise exception 'Töggin eru ekki í sama verkefni.' using errcode = '22023';
  end if;
  perform set_config('hg.silent', 'on', true);
  update hg_items set tags = hg_tags_dedupe(array_replace(tags, v_from, v_into))
    where project_id = v_project and v_from = any(tags);
  get diagnostics v_n = row_count;
  update hg_views set filter = jsonb_set(filter, '{tags}', hg_tags_json_replace(filter->'tags', v_from, v_into))
    where project_id = v_project and filter->'tags' ? v_from;
  delete from hg_tags where id = p_from;
  return v_n;
end;
$$;

create or replace function hg_tag_delete(p_tag uuid)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_project uuid;
  v_name text;
  v_view text;
  v_n integer;
begin
  select project_id, name into v_project, v_name from hg_tags where id = p_tag;
  if v_project is null then
    raise exception 'Taggið fannst ekki.' using errcode = '22023';
  end if;
  -- An empty tag list on a view means every tag, so a view whose only tag
  -- this is would open up without anyone seeing it.
  select name into v_view from hg_views
    where project_id = v_project and filter->'tags' = to_jsonb(array[v_name])
    limit 1;
  if v_view is not null then
    raise exception 'Taggið er eina taggið í sýninni "%". Breyttu sýninni fyrst.', v_view using errcode = '22023';
  end if;
  perform set_config('hg.silent', 'on', true);
  update hg_items set tags = array_remove(tags, v_name)
    where project_id = v_project and v_name = any(tags);
  get diagnostics v_n = row_count;
  update hg_views set filter = jsonb_set(filter, '{tags}', hg_tags_json_replace(filter->'tags', v_name, null))
    where project_id = v_project and filter->'tags' ? v_name;
  delete from hg_tags where id = p_tag;
  return v_n;
end;
$$;

revoke all on function hg_tag_rename(uuid, text) from public;
revoke all on function hg_tag_merge(uuid, uuid) from public;
revoke all on function hg_tag_delete(uuid) from public;
grant execute on function hg_tag_rename(uuid, text) to authenticated;
grant execute on function hg_tag_merge(uuid, uuid) to authenticated;
grant execute on function hg_tag_delete(uuid) to authenticated;

-- The starting list of metta (spec 4.5): tags used twice or more after the
-- spelling merges, tags on an open item, hönnun and óflokkað.
insert into hg_tags (project_id, name)
select p.id, t.name
from hg_projects p
cross join unnest(array[
  'smokes', 'tækniskuld', 'efni', 'fyrir sýningu', 'prófun', 'ákvörðun', 'pakki árna', 'kennsla', 'villa',
  'eftir sýningu', 'árni leiðarvísir', 'hitamælingar', 'hugmynd', 'plan', 'vélbúnaður', 'afköst', 'askur',
  'redeploy', 'hugmyndavinna', 'efnaskrá', 'lítið', 'öryggi', 'skynjarar', 'stóreldhúsið', 'sýning',
  'áhættumat', 'dvali', 'edge function', 'eftirlit', 'gámes', 'gervigreind', 'sala', 'skjár', 'uppgjör',
  'hönnun', 'óflokkað'
]) as t(name)
where p.slug = 'metta'
on conflict do nothing;
```

- [ ] **Step 2: Apply it**

Run the Supabase MCP `apply_migration` with name `0016_hg_tags_keywords` and the file's content on project `czdjxtsjgughimlazdmu`. Then `execute_sql`: `select count(*) from hg_tags;` Expected: 36. And `select tgname, pg_get_triggerdef(t.oid) from pg_trigger t where tgrelid = 'public.hg_items'::regclass and not tgisinternal order by 1;` Expected: `hg_items_stamp_trg`, `hg_items_touch_trg` and `hg_items_log_event_trg` each show `WHEN ((current_setting('hg.silent'::text, true) IS DISTINCT FROM 'on'::text))`, `hg_items_closed_at_trg` and `hg_items_analyse_trg` unchanged.

- [ ] **Step 3: Add the README line**

Append to the Files list in `supabase/migrations/README.md`:

`- 0016_hg_tags_keywords: hg_tags (fixed tag list per project, seeded with the 36 metta tags), hg_items.keywords (ignored by the touch trigger), hg.silent when clauses on the item stamp, touch and event triggers, and the RPCs hg_tag_rename, hg_tag_merge and hg_tag_delete.`

- [ ] **Step 4: Types**

In `src/vinnubord/lib/types.ts`: add `keywords: string[]` to `Item` after `tags`; add after `View`:

```ts
// One tag of the project's fixed list (hg_tags). Items carry names, not ids.
export type Tag = {
  id: string
  created_at: string | null
  project_id: string
  name: string
  created_by: string | null
}
```

and `tags: Tag[]` to `BoardData` after `views`.

- [ ] **Step 5: Load it, web and CLI**

`src/vinnubord/lib/api.ts` `loadBoard`: add `byProject('hg_tags').order('name')` to the `Promise.all` (after `views`), to the `results` array, and `tags: (tags.data ?? []) as Tag[]` to the returned object; import `Tag`. `src/vinnubord/hooks/useBoardData.ts`: add `'hg_tags'` to `REALTIME_TABLES`. `cli/lib/client.mjs` `loadBoard`: add `byProject('hg_tags').order('name')` and `tags: tags.data ?? []` the same way.

- [ ] **Step 6: Build and test**

`tsc -b` compiles the test files, so every typed `Item` fixture needs `keywords: []` after `tags`: the `item()` helpers in `src/vinnubord/lib/{cards,continuation,files,filters,layout,list,panel,reads,status,views}.test.ts` (grep `updated_by: null` to find them all). `cli/lib/mirror.test.mjs` is untyped and is changed in Task 7.

Run: `npm run build && npm run test`
Expected: both green, 571 tests.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0016_hg_tags_keywords.sql supabase/migrations/README.md src/vinnubord/lib/types.ts src/vinnubord/lib/api.ts src/vinnubord/hooks/useBoardData.ts cli/lib/client.mjs
git commit -m "feat(vinnubord): hg_tags, item keywords and the silent tag RPCs"
```

Verification set: the MCP checks in Step 2, `npm run build`, `npm run test`. Nothing else.

---

### Task 2: Tag rule, web and CLI

**Files:**
- Create: `src/vinnubord/lib/tags.ts`, `src/vinnubord/lib/tags.test.ts`
- Modify: `cli/lib/write.mjs` (after `normalizeNote`, line 189), `cli/lib/write.test.mjs`, `cli/lib/parity.test.mjs`

**Interfaces:**
- Produces: `TAG_MAX = 40`; `normalizeTag(input: string | null | undefined): { ok: true; name: string } | { ok: false; reason: string }`; `tagRows(tags: Tag[], items: Pick<Item, 'tags'>[]): TagRow[]` with `type TagRow = { id: string; name: string; count: number }`; `tagNameTaken(name: string, tags: Pick<Tag, 'id' | 'name'>[], selfId?: string): string | null`; CLI `normalizeTag` and `parseKeywords(text: string): string[]` in `write.mjs`.

- [ ] **Step 1: Write the failing tests**

`src/vinnubord/lib/tags.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { TAG_MAX, normalizeTag, tagNameTaken, tagRows } from './tags'

const tag = (id: string, name: string) => ({ id, created_at: null, project_id: 'pr', name, created_by: null })

describe('normalizeTag', () => {
  it('lowercases with Icelandic letters, collapses whitespace and trims', () => {
    expect(normalizeTag('  Fyrir   SÝNINGU ')).toEqual({ ok: true, name: 'fyrir sýningu' })
    expect(normalizeTag('Árni\tleiðarvísir')).toEqual({ ok: true, name: 'árni leiðarvísir' })
  })
  it('refuses empty, over 40 characters and a comma', () => {
    expect(normalizeTag('')).toEqual({ ok: false, reason: 'Taggið þarf nafn.' })
    expect(normalizeTag('   ')).toEqual({ ok: false, reason: 'Taggið þarf nafn.' })
    expect(normalizeTag('x'.repeat(TAG_MAX + 1))).toEqual({ ok: false, reason: 'Tagg má mest vera 40 stafir.' })
    expect(normalizeTag('x'.repeat(TAG_MAX)).ok).toBe(true)
    expect(normalizeTag('a, b')).toEqual({ ok: false, reason: 'Tagg má ekki hafa kommu.' })
    expect(normalizeTag(null).ok).toBe(false)
  })
})

describe('tagRows', () => {
  it('counts items by exact name and sorts by count, then name in Icelandic order', () => {
    const tags = [tag('t1', 'öryggi'), tag('t2', 'efni'), tag('t3', 'askur')]
    const items = [{ tags: ['efni', 'askur'] }, { tags: ['efni'] }, { tags: [] }]
    expect(tagRows(tags, items)).toEqual([
      { id: 't2', name: 'efni', count: 2 },
      { id: 't3', name: 'askur', count: 1 },
      { id: 't1', name: 'öryggi', count: 0 },
    ])
  })
})

describe('tagNameTaken', () => {
  const tags = [tag('t1', 'efni'), tag('t2', 'askur')]
  it('is taken ignoring case, except by itself', () => {
    expect(tagNameTaken('Efni', tags)).toBe('Taggið er þegar á listanum.')
    expect(tagNameTaken('efni', tags, 't1')).toBeNull()
    expect(tagNameTaken('nýtt', tags)).toBeNull()
  })
})
```

`cli/lib/write.test.mjs`, new describe blocks (import `normalizeTag` and `parseKeywords` from `./write.mjs`):

```js
describe('normalizeTag', () => {
  it('lowercases, collapses whitespace and refuses empty, long and comma', () => {
    expect(normalizeTag('  Fyrir   SÝNINGU ')).toEqual({ ok: true, name: 'fyrir sýningu' })
    expect(normalizeTag('')).toEqual({ ok: false, reason: 'Taggið þarf nafn.' })
    expect(normalizeTag('x'.repeat(41))).toEqual({ ok: false, reason: 'Tagg má mest vera 40 stafir.' })
    expect(normalizeTag('a, b')).toEqual({ ok: false, reason: 'Tagg má ekki hafa kommu.' })
  })
})

describe('parseKeywords', () => {
  it('splits on commas, lowercases, trims, drops empties and duplicates', () => {
    expect(parseKeywords('Social Media, efni ,SOCIAL MEDIA,,instagram')).toEqual(['social media', 'efni', 'instagram'])
    expect(parseKeywords('')).toEqual([])
  })
})
```

`cli/lib/parity.test.mjs`, inside `describe('write helpers parity with the web')` (import `TAG_MAX`, `normalizeTag` from `./write.mjs` and `* as webTags from '../../src/vinnubord/lib/tags.ts'`):

```js
  it('TAG_MAX and normalizeTag agree with tags.ts', () => {
    expect(TAG_MAX).toBe(webTags.TAG_MAX)
    for (const v of ['  Fyrir   SÝNINGU ', '', '   ', 'x'.repeat(40), 'x'.repeat(41), 'a, b', 'Árni\tleiðarvísir', null])
      expect(normalizeTag(v)).toEqual(webTags.normalizeTag(v))
  })
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/vinnubord/lib/tags.test.ts cli/lib/write.test.mjs cli/lib/parity.test.mjs`
Expected: FAIL, `tags.ts` not found and `normalizeTag` not exported.

- [ ] **Step 3: Implement `src/vinnubord/lib/tags.ts`**

```ts
import type { Item, Tag } from './types'

// The fixed tag list of a project (spec 4.4): the name rule, the settings
// rows and the duplicate check. The database canonicalises spelling against
// the list (0016b) and refuses names off it.

export const TAG_MAX = 40
export const TAG_TAKEN = 'Taggið er þegar á listanum.'

export type TagRow = { id: string; name: string; count: number }

export function normalizeTag(input: string | null | undefined): { ok: true; name: string } | { ok: false; reason: string } {
  const name = (input ?? '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('is')
  if (name === '') return { ok: false, reason: 'Taggið þarf nafn.' }
  if (name.length > TAG_MAX) return { ok: false, reason: 'Tagg má mest vera 40 stafir.' }
  if (name.includes(',')) return { ok: false, reason: 'Tagg má ekki hafa kommu.' }
  return { ok: true, name }
}
```

`tagRows`: count items whose `tags` includes the exact name; sort by count descending, then `localeCompare(name, 'is')`. `tagNameTaken`: `TAG_TAKEN` when another tag (id not `selfId`) has the same `toLocaleLowerCase('is')` name, else `null`.

- [ ] **Step 4: Implement the CLI copies in `cli/lib/write.mjs`**

After `normalizeNote`: `export const TAG_MAX = 40` and `export function normalizeTag(input)` with the same body and the same three reasons; `export function parseKeywords(text)` as `[...new Set(parseTags(text).map((k) => k.toLocaleLowerCase('is')))]`.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/vinnubord/lib/tags.test.ts cli/lib/write.test.mjs cli/lib/parity.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/vinnubord/lib/tags.ts src/vinnubord/lib/tags.test.ts cli/lib/write.mjs cli/lib/write.test.mjs cli/lib/parity.test.mjs
git commit -m "feat(vinnubord): tag name rule, web and CLI"
```

Verification set: the three test files and `npm run build`. Nothing else.

---

### Task 3: Search index and fold

**Files:**
- Create: `src/vinnubord/lib/search.ts`, `src/vinnubord/lib/search.test.ts`
- Modify: `src/vinnubord/lib/filters.ts:20-35` (`matches`), `src/vinnubord/lib/filters.test.ts:29-73`
- Modify: `src/vinnubord/lib/cards.ts:36-47` (`CardContext`) and `:120-125`, `src/vinnubord/lib/cards.test.ts:37-43`
- Modify: `src/vinnubord/lib/views.ts:56`
- Modify: `src/vinnubord/pages/BoardPage.tsx:106-121`

**Interfaces:**
- Produces: `foldSearch(s: string): string`; `searchIndex(data: Pick<BoardData, 'items' | 'files' | 'questions' | 'actions' | 'comments'>): Map<string, string>`; `matches(item, ctx: { tone: Tone; packageId: string | null; unread: boolean; text: string }, f)`; `CardContext.search: Map<string, string>`.

- [ ] **Step 1: Write the failing tests**

`src/vinnubord/lib/search.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { foldSearch, searchIndex } from './search'
import type { Item } from './types'

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'i1', created_at: null, project_id: 'pr', module_id: null, title: 'Sýning', summary: null, body: null,
    status: 'new', waiting_on: null, tags: [], keywords: [], pos_x: 0, pos_y: 0, source_ref: null, next_step: null,
    next_prompt: null, created_by: 'u', updated_by: null, updated_at: '2026-01-01T00:00:00Z', closed_at: null, ...over,
  }
}

describe('foldSearch', () => {
  it('lowercases and strips accents, keeps ð þ æ, collapses whitespace', () => {
    expect(foldSearch('SÝNING')).toBe('syning')
    expect(foldSearch('Árni  leiðarvísir')).toBe('arni leiðarvisir')
    expect(foldSearch('Þór æfir')).toBe('þor æfir')
    expect(foldSearch('  a \n b ')).toBe('a b')
  })
})

describe('searchIndex', () => {
  const base = { items: [item({ id: 'i1', title: 'Efnaskrá', summary: 'Sam', body: 'Megin', tags: ['Prófun'], keywords: ['social media'] }), item({ id: 'i2', title: 'Annað' })] }
  const rows = {
    files: [{ item_id: 'i1', name: 'Skýrsla.pdf', note: 'Fyrir Árna' }, { item_id: 'i2', name: 'other.md', note: null }],
    questions: [{ item_id: 'i1', body: 'Hvaða litur?', answer: 'Blár' }, { item_id: 'i2', body: 'x', answer: null }],
    actions: [{ item_id: 'i1', body: 'Keyra SQL' }],
    comments: [{ item_id: 'i1', module_id: null, body: 'Lítur vel út' }, { item_id: null, module_id: 'm1', body: 'módúlspjall' }],
  }
  it('folds every part of an item into one text and nothing of other items', () => {
    const idx = searchIndex({ ...base, ...rows } as never)
    const t = idx.get('i1') ?? ''
    for (const s of ['efnaskra', 'sam', 'megin', 'profun', 'social media', 'skyrsla.pdf', 'fyrir arna', 'hvaða litur?', 'blar', 'keyra sql', 'litur vel ut']) expect(t).toContain(s)
    expect(t).not.toContain('annað')
    expect(t).not.toContain('other.md')
    expect(t).not.toContain('modulspjall')
    expect(idx.get('i2')).toContain('annað')
  })
  it('gives an entry for an item with nothing attached', () => {
    expect(searchIndex({ items: [item({ id: 'i3', title: 'Tómt' })], files: [], questions: [], actions: [], comments: [] } as never).get('i3')).toBe('tomt')
  })
})
```

`src/vinnubord/lib/filters.test.ts`: every existing `matches(...)` call gets `text: ''` in its ctx; the query test (lines 62 to 73) becomes:

```ts
  it('query searches the folded text the caller gives, ignoring case and accents', () => {
    const f = withQuery(emptyFilter(), 'Zzz')
    const ctx = (text: string) => ({ tone: 'gold' as Tone, packageId: null, unread: false, text })
    expect(matches(item(), ctx('abc'), f)).toBe(false)
    expect(matches(item(), ctx('og zzz'), f)).toBe(true)
    expect(matches(item(), ctx('og zzz'), withQuery(emptyFilter(), 'ZZZ')), 'case').toBe(true)
    expect(matches(item(), ctx('syning'), withQuery(emptyFilter(), 'sýning')), 'accent in query').toBe(true)
    expect(matches(item(), ctx('syning'), withQuery(emptyFilter(), 'þyning')), 'þ is not t').toBe(false)
    expect(matches(item(), ctx('abc'), withQuery(emptyFilter(), '   ')), 'blank query').toBe(true)
  })
```

`src/vinnubord/lib/cards.test.ts:37-43`: add `search: new Map()` to `base`, and one test:

```ts
  it('a query dims a card whose index text lacks it and keeps one whose text has it', () => {
    const f = withQuery(emptyFilter(), 'sýning')
    const search = new Map([['i1', 'syning i dag'], ['i2', 'annad']])
    expect(cardModels([item({ id: 'i1' })], ctx({ filter: f, search }))[0].visible).toBe(true)
    expect(cardModels([item({ id: 'i2' })], ctx({ filter: f, search }))[0].visible).toBe(false)
  })
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/vinnubord/lib/search.test.ts src/vinnubord/lib/filters.test.ts src/vinnubord/lib/cards.test.ts`
Expected: FAIL (`search.ts` missing, `text` not read).

- [ ] **Step 3: Implement `src/vinnubord/lib/search.ts`**

```ts
import type { BoardData } from './types'

// The board search (spec 4.2): one folded text per item, built once from the
// board data, and the fold both sides use. Accents go, ð þ æ stay.

export function foldSearch(s: string): string {
  return s
    .toLocaleLowerCase('is')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
```

`searchIndex`: for every item, join with `\n` the lines title, summary, body, each tag, each keyword, then for the item's files `name` and `note`, questions `body` and `answer`, actions `body`, comments with that `item_id` `body` (skip null and empty), fold the whole string once, `map.set(item.id, text)`. Group the four row arrays by `item_id` first (one pass each), not a filter per item.

- [ ] **Step 4: Thread `text` through `matches`, `cards.ts`, `views.ts`, `BoardPage.tsx`**

`filters.ts` `matches`: ctx gains `text: string`; the query branch becomes `const q = foldSearch(f.q); if (q !== '' && !ctx.text.includes(q)) return false` (import `foldSearch` from `./search`; `search.ts` imports nothing from `filters.ts`). `cards.ts`: `CardContext.search: Map<string, string>`; in `cardModels` pass `text: ctx.search.get(item.id) ?? ''`. `views.ts:56`: pass `text: ''`. `BoardPage.tsx`: `const search = useMemo(() => (loaded ? searchIndex(data) : new Map<string, string>()), [loaded, data])` next to `unreadByItem`, and `search` in the `cardModels` context (add it to the memo deps).

- [ ] **Step 5: Run everything**

Run: `npm run build && npm run test`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add src/vinnubord/lib/search.ts src/vinnubord/lib/search.test.ts src/vinnubord/lib/filters.ts src/vinnubord/lib/filters.test.ts src/vinnubord/lib/cards.ts src/vinnubord/lib/cards.test.ts src/vinnubord/lib/views.ts src/vinnubord/pages/BoardPage.tsx
git commit -m "feat(vinnubord): search index over files, questions, actions, chat and keywords"
```

Verification set: the three test files, `npm run build`, `npm run test`, and one manual check on `npm run dev` at 1280 px: type `syning` in the search, a card whose question answer holds "sýning" stays lit. Nothing else.

---

### Task 4: Ctrl+F and Esc

**Files:**
- Modify: `src/vinnubord/pages/BoardPage.tsx` (state, one effect, one prop)
- Modify: `src/vinnubord/components/TopBar.tsx:68-80` and `:136-156`

**Interfaces:**
- Produces: `TopBar` prop `searchRequest: number` (every increment opens the search field, focuses it and selects its text).

- [ ] **Step 1: `BoardPage`**

Add `const [searchRequest, setSearchRequest] = useState(0)`. Add this effect next to the Esc effect (line 216). `readerOpen` is defined at line 258, below the early returns, so compute `const readerIsOpen = readerFileId !== null` just above the effect:

```ts
  // Ctrl+F or Cmd+F goes to the board search unless a field has focus or the
  // reader is open, where the browser's own find is the right one (spec 4.1).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'f') return
      if (readerIsOpen) return
      const active = document.activeElement
      if (active instanceof HTMLElement && (active.closest('input, textarea, select') || active.isContentEditable)) return
      e.preventDefault()
      setSearchRequest((n) => n + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [readerIsOpen])
```

Pass `searchRequest={searchRequest}` to `TopBar`.

- [ ] **Step 2: `TopBar`**

Add `searchRequest: number` to `Props`. Change `openSearch` to focus and select: `requestAnimationFrame(() => { searchRef.current?.focus(); searchRef.current?.select() })`. Add:

```ts
  useEffect(() => {
    if (searchRequest > 0) openSearch()
  }, [searchRequest, openSearch])
```

The field's `onKeyDown`: on Escape, `e.stopPropagation()`, then `if (f.q !== '') filter.setQuery('')`, then `e.currentTarget.blur()`.

- [ ] **Step 3: Build and manual checks**

Run: `npm run build && npm run test`. Expected: green.

On `npm run dev` at 1280 px (mouse): (1) Ctrl+F with nothing focused puts the caret in the search field, the browser find bar does not open; (2) type `efni`, open a card panel, press Ctrl+F, the field is focused with `efni` selected, press Esc once: the field is empty, unfocused, and the panel is still open; (3) open an md file in the reader, Ctrl+F opens the browser find bar; (4) at 800 px (two row bar) Ctrl+F shows the field and focuses it.

- [ ] **Step 4: Commit**

```bash
git add src/vinnubord/pages/BoardPage.tsx src/vinnubord/components/TopBar.tsx
git commit -m "feat(vinnubord): Ctrl+F opens the board search, Esc clears it"
```

Verification set: `npm run build`, `npm run test`, the four manual checks at 1280 px and 800 px. Nothing else.

---

### Task 5: Tag API and settings editor

**Files:**
- Modify: `src/vinnubord/lib/api.ts` (four functions after `removeParticipant`)
- Modify: `src/vinnubord/lib/tags.ts`, `src/vinnubord/lib/tags.test.ts` (`tagErrorMessage`)
- Create: `src/vinnubord/components/settings/TagsEditor.tsx`
- Modify: `src/vinnubord/pages/ProjectSettingsPage.tsx:56-58`
- Modify: `src/shared/i18n/locales/en.json`, `src/shared/i18n/locales/is.json`

**Interfaces:**
- Consumes: `normalizeTag`, `tagRows`, `tagNameTaken` (Task 2), `BoardData.tags` (Task 1).
- Produces: `addTag(projectId: string, name: string): Promise<Tag>`, `renameTag(id: string, name: string): Promise<void>`, `mergeTag(fromId: string, intoId: string): Promise<void>`, `deleteTag(id: string): Promise<void>`, `tagErrorMessage(code: string | undefined, message: string): string | null`.

- [ ] **Step 1: Failing test for the error map**

Append to `src/vinnubord/lib/tags.test.ts`:

```ts
describe('tagErrorMessage', () => {
  it('maps the unique violation to the fixed text, passes 22023 through, else null', () => {
    expect(tagErrorMessage('23505', 'duplicate key value')).toBe('Taggið er þegar á listanum.')
    expect(tagErrorMessage('22023', 'Taggið er eina taggið í sýninni "Sýning". Breyttu sýninni fyrst.')).toBe('Taggið er eina taggið í sýninni "Sýning". Breyttu sýninni fyrst.')
    expect(tagErrorMessage('42501', 'permission denied')).toBeNull()
    expect(tagErrorMessage(undefined, 'x')).toBeNull()
  })
})
```

Run: `npx vitest run src/vinnubord/lib/tags.test.ts`. Expected: FAIL, not exported.

- [ ] **Step 2: `tagErrorMessage` and the API**

`tags.ts`: `export function tagErrorMessage(code: string | undefined, message: string): string | null` per the test. `api.ts`, after `removeParticipant`, with a shared `function tagFail(fallback: string, error: { code?: string; message: string } | null): never` that throws `new Error(tagErrorMessage(error?.code, error?.message ?? '') ?? (error ? `${fallback}: ${error.message}` : fallback))`:

- `addTag`: insert `{ project_id, name, created_by: await currentUserId() }` into `hg_tags`, `.select('*').single()`, fallback `'Gat ekki bætt tagginu við.'`, returns the row as `Tag`.
- `renameTag`: `supabase.rpc('hg_tag_rename', { p_tag: id, p_name: name })`, fallback `'Gat ekki endurnefnt taggið.'`.
- `mergeTag`: `rpc('hg_tag_merge', { p_from: fromId, p_into: intoId })`, fallback `'Gat ekki sameinað töggin.'`.
- `deleteTag`: `rpc('hg_tag_delete', { p_tag: id })`, fallback `'Gat ekki eytt tagginu.'`.

- [ ] **Step 3: Copy**

`en.json` under `vinnubord.settings`, a new `tags` object (place it between `modules` and `colors`, keys alphabetical inside):

```json
"tags": {
  "choose": "Choose a tag",
  "count_one": "{{count}} item",
  "count_other": "{{count}} items",
  "deleteConfirm": "Delete the tag {{name}}? It leaves {{count}} items.",
  "empty": "No tags yet.",
  "hint": "A fixed list. The quick analysis and Claude's sessions choose from it. Renaming, merging and deleting write to every item without marking it unread.",
  "merge": "Merge",
  "mergeConfirm": "Merge {{from}} into {{into}}? {{from}} leaves the list and its items get {{into}}.",
  "mergeInto": "Merge into",
  "name": "Name",
  "newTitle": "New tag",
  "title": "Tags"
}
```

Run `npm run translate`, then set `is.json` `vinnubord.settings.tags` to exactly:

```json
"tags": {
  "choose": "Veldu tagg",
  "count_one": "{{count}} verk",
  "count_other": "{{count}} verk",
  "deleteConfirm": "Eyða tagginu {{name}}? Það fer af {{count}} verkum.",
  "empty": "Engin tögg enn.",
  "hint": "Fastur listi. Skyndigreiningin og lotur Claude velja úr honum. Endurnefning, sameining og eyðing skrifa á öll verk án þess að merkja þau ólesin.",
  "merge": "Sameina",
  "mergeConfirm": "Sameina {{from}} við {{into}}? {{from}} fer af listanum og verkin þess fá {{into}}.",
  "mergeInto": "Sameina við",
  "name": "Nafn",
  "newTitle": "Nýtt tagg",
  "title": "Tögg"
}
```

Check the rest of the `is.json` diff: nothing else may change.

- [ ] **Step 4: `TagsEditor.tsx`**

`export function TagsEditor({ projectId, tags, items, onChange }: { projectId: string; tags: Tag[]; items: Item[]; onChange: () => void })`, built like `PackagesEditor` and `ModulesEditor`: a `section.hg-set-sec` with `h2#hg-set-tags` (`vinnubord.settings.tags.title`), `p.hg-set-hint`, `ul.hg-set-list` of `TagRow` from `tagRows(tags, items)` (`vinnubord.settings.tags.empty` when none), then `NewTag`.

`TagRow` (`form.hg-set-row`, `useAsyncAction`): a `Field` name input (draft starts at the name, `dirty` when it differs); a `p.hg-set-meta` with `t('vinnubord.settings.tags.count', { count })`; a `Field` labelled `mergeInto` holding a `select` whose first option is `choose` (value `''`) followed by the other tags sorted by name; `Actions` with three buttons: Sameina (`hg-btn hg-btn-ghost`, disabled until a target is chosen; `window.confirm(mergeConfirm { from, into })`, then `mergeTag(row.id, targetId)`), Eyða (`hg-btn hg-btn-ghost hg-btn-danger`; `window.confirm(deleteConfirm { name, count })`, then `deleteTag(row.id)`), Vista (`hg-btn`, `type="submit"`, disabled unless dirty; validates with `normalizeTag` then `tagNameTaken(name, tags, row.id)`, shows the reason through `Actions error`, else `renameTag(row.id, name)`). Every success calls `onChange()`. Key each `TagRow` by `${row.id}|${row.name}` so a realtime rename resets the draft, as `PackageRow` does.

`NewTag` (`form.hg-set-row hg-set-row-new`): `p.hg-set-row-title` `newTitle`, a `Field` name input, `Actions` with Bæta við (`hg-btn hg-btn-primary`, disabled while empty or busy); validates with `normalizeTag` then `tagNameTaken(name, tags)`, then `addTag(projectId, name)`, clears the field and calls `onChange()`.

No new CSS and no new token: `.hg-set-meta`, `.hg-set-field`, `.hg-set-actions` and the button classes already exist.

- [ ] **Step 5: Mount it**

`ProjectSettingsPage.tsx`: `<TagsEditor projectId={project.id} tags={data.tags} items={data.items} onChange={refresh} />` between `ModulesEditor` and `ParticipantsEditor`.

- [ ] **Step 6: Build, test, manual checks**

Run: `npm run build && npm run test`. Expected: green.

On `npm run dev` at 1280 px, `/p/metta/stillingar`: (1) the Tögg section lists 36 rows, `smokes` first with its count; (2) add `prufutagg`, it appears with 0; rename it to `PRUFUTAGG 2`, the row shows `prufutagg 2`; try renaming it to `Smokes`: the row shows `Taggið er þegar á listanum.` and nothing changes; (3) merge `prufutagg 2` into `smokes`: the row is gone, `smokes` count unchanged; (4) open the board in another tab beforehand: no card got the gold glow from any of this.

- [ ] **Step 7: Commit**

```bash
git add src/vinnubord/lib/api.ts src/vinnubord/lib/tags.ts src/vinnubord/lib/tags.test.ts src/vinnubord/components/settings/TagsEditor.tsx src/vinnubord/pages/ProjectSettingsPage.tsx src/shared/i18n/locales/en.json src/shared/i18n/locales/is.json
git commit -m "feat(vinnubord): tag list in the project settings"
```

Verification set: `tags.test.ts`, `npm run build`, `npm run test`, the four manual checks on `/p/metta/stillingar` at 1280 px. Nothing else.

---

### Task 6: New item sheet picks from the list

**Files:**
- Modify: `src/vinnubord/components/NewItemSheet.tsx` (`Props.tags`, state, the tag field block at lines 226 to 246)
- Modify: `src/vinnubord/pages/BoardPage.tsx` (the `NewItemSheet` element)
- Modify: `src/vinnubord/lib/newItem.ts`, `src/vinnubord/lib/newItem.test.ts` (remove `parseTags` and `toggleTagText` with their tests)
- Modify: `en.json`, `is.json`

**Interfaces:**
- Consumes: `tagRows` (Task 2), `BoardData.tags` (Task 1).
- Produces: `NewItemSheet` prop `tags: Tag[]`.

- [ ] **Step 1: Copy**

`en.json` `vinnubord.newItem`: remove `tagsHint`, add `"noTags": "No tags on the list yet. Add them in the project settings."`. Run `npm run translate`; in `is.json` remove `tagsHint` and set `"noTags": "Engin tögg á listanum enn. Bættu þeim við í stillingum verkefnisins."` (alphabetical: after `newItem.module`... keep the file's existing alphabetical order). Check that nothing else in the diff changed.

- [ ] **Step 2: The sheet**

`Props.tags: Tag[]` (comment: the project's tag list). Replace `tagText`/`chosenTags` with `const [chosen, setChosen] = useState<Set<string>>(new Set())`; `rows = useMemo(() => tagRows(tags, data.items), [tags, data.items])`; `dirty` uses `chosen.size > 0`; `createItem` gets `tags: [...chosen]`. The field block becomes a `div.hg-new-field` with a `span` label (`vinnubord.newItem.tags`), then either `p.hg-set-hint`-like text: use `<small>{t('vinnubord.newItem.noTags')}</small>` inside the label span when `rows.length === 0`, or `div.hg-new-tags` with one `button.hg-tag-pick` per row (all rows, no `QUICK_TAGS` slice; `hg-on` and `aria-pressed` when chosen; toggles the name in `chosen`; disabled while `locked`). Remove the `input`, `QUICK_TAGS`, and the `parseTags` and `toggleTagText` imports.

`BoardPage.tsx`: `<NewItemSheet ... tags={data.tags} ...>`.

- [ ] **Step 3: `newItem.ts`**

Remove `parseTags` and `toggleTagText` and their two describe blocks in `newItem.test.ts`. Grep `parseTags\|toggleTagText` under `src/`: no other user may remain.

- [ ] **Step 4: Build, test, manual check**

Run: `npm run build && npm run test`. Expected: green.

On `npm run dev` at 1280 px: "+ Nýtt verk" shows 36 tag buttons under Tögg, the most used first, no text field; pick two, create the item, its panel head shows the two tags in the list's spelling.

- [ ] **Step 5: Commit**

```bash
git add src/vinnubord/components/NewItemSheet.tsx src/vinnubord/pages/BoardPage.tsx src/vinnubord/lib/newItem.ts src/vinnubord/lib/newItem.test.ts src/shared/i18n/locales/en.json src/shared/i18n/locales/is.json
git commit -m "feat(vinnubord): new item picks tags from the list"
```

Verification set: `npm run build`, `npm run test`, the one manual check. Nothing else. (Delete the test item afterwards through the SQL editor is not needed: leave it, Heimir sees a real card; title it `Prufa taggalista` so he knows, and drop it with `huginn item close <id> --dropped` at the end of the task.)

---

### Task 7: CLI: tag list, tag add, keywords, mirror

**Files:**
- Modify: `cli/lib/commands.mjs` (imports, `item.create`, `item.set`, new `tag` group)
- Modify: `cli/lib/ops.mjs` (`createItem` row, new `addTag`)
- Modify: `cli/lib/mirror.mjs:212-213`, `cli/lib/mirror.test.mjs`
- Modify: `cli/README.md` (commands table, write table, rules)

**Interfaces:**
- Consumes: `normalizeTag`, `parseKeywords` (Task 2), `loadBoard(...).tags` (Task 1).
- Produces: `huginn tag list [--json]`, `huginn tag add <name>`, `--keywords a,b` on `item create` and `item set`, `addTag(client, { projectId, userId, name })` in `ops.mjs`, the `Leitarorð:` line.

- [ ] **Step 1: Failing mirror test**

`cli/lib/mirror.test.mjs`: in the `renderItemMd` fixture that carries `tags: ['efnaskra', 'honnun']` (line 114) add `keywords: ['Social Media', 'efni']`, and in the `renders every part` list (line 483) add `'Leitarorð: Social Media, efni'` right after `'Merki: efnaskra, honnun'`. Add one test: an item with `keywords: []` renders no `Leitarorð` line (`expect(md).not.toContain('Leitarorð')`).

Run: `npx vitest run cli/lib/mirror.test.mjs`. Expected: FAIL.

- [ ] **Step 2: Mirror**

`cli/lib/mirror.mjs` after the `Merki:` push: `const keywords = (item.keywords ?? []).map(oneLine).filter(Boolean); if (keywords.length) meta.push(\`Leitarorð: ${keywords.join(', ')}\`)`.

- [ ] **Step 3: Ops and commands**

`ops.mjs` `createItem`: `keywords: input.keywords ?? []` in the row. New:

```js
// One tag on the project's list. The unique index on lower(name) refuses a
// name already there, in any case.
export async function addTag(client, { projectId, userId, name }) {
  const { data, error } = await client
    .from('hg_tags')
    .insert({ project_id: projectId, name, created_by: userId })
    .select('*')
    .single()
  if (error?.code === '23505') fail('Taggið er þegar á listanum.')
  if (error || !data) fail('Gat ekki bætt tagginu við', error)
  return data
}
```

`commands.mjs`: import `normalizeTag`, `parseKeywords` and `addTag`. `item create` and `item set` get `keywords: 'value'` in `spec`, `[--keywords a,b]` in `usage` (after `--tags a,b`), and `keywords: parseKeywords(flags.keywords)` in the create input / `patch.keywords = parseKeywords(flags.keywords)` when the flag is given. Wrap the `createItem` call in `item create` and the `guardedUpdate` call in `item set` with:

```js
// The 0016b trigger refuses a tag off the list; say where the list is.
async function withTagHint(fn) {
  try {
    return await fn()
  } catch (error) {
    if (/taggalista verkefnisins/.test(error.message)) {
      error.message += ' huginn tag list sýnir hann, huginn tag add bætir við.'
    }
    throw error
  }
}
```

New group after `comment` (or wherever `bundle` sits, keep the file's order):

```js
  tag: {
    list: {
      usage: 'tag list',
      args: 0,
      spec: {},
      async run(flags) {
        const { client, project } = await context(flags)
        const board = await loadBoard(client, project.id)
        const rows = board.tags
          .map((tg) => ({ id: tg.id, name: tg.name, count: board.items.filter((i) => (i.tags ?? []).includes(tg.name)).length }))
          .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'is'))
        return {
          json: rows,
          text: rows.length ? rows.map((r) => `${r.name} (${r.count})`).join('\n') : 'Engin tögg á listanum.',
        }
      },
    },
    add: {
      usage: 'tag add <name>',
      args: 1,
      spec: {},
      async run(flags, [raw]) {
        const check = normalizeTag(raw)
        if (!check.ok) throw new Error(check.reason)
        const { client, user, project } = await context(flags)
        const tag = await addTag(client, { projectId: project.id, userId: user.id, name: check.name })
        return { json: { ok: true, id: tag.id }, text: `Tagg bætt við: ${tag.name}` }
      },
    },
  },
```

`huginn.mjs` needs no change: `WRITE_GROUPS` registers the group.

- [ ] **Step 4: README**

`cli/README.md`: in the Skipanir table add `| \`huginn tag list\` | Taggalisti verkefnisins með fjölda verka á hverju taggi, raðað eftir fjölda. \`--json\` gefur \`[{ id, name, count }]\` |` after `sync --out`; in the Skrifskipanir table add `| \`tag add <nafn>\` | \`huginn tag add "edge function"\` (lágstafir, mest 40 stafir, engin komma; tvítak er villa) |` after `comment add`, and extend the `item create` example with `--keywords "social media,efni,instagram"`; in the rules list add `- **Tögg og leitarorð.** \`--tags\` tekur aðeins tögg af listanum (\`tag list\`); gagnagrunnurinn skrifar stafsetningu listans á verkið og hafnar öðru. \`--keywords a,b\` eru falin leitarorð (lágstafir, komma á milli), 10 til 15 á verk, íslensk og ensk; \`item set --keywords\` skiptir listanum út, \`--keywords ""\` tæmir. Þau standa í \`item.md\` sem \`Leitarorð:\`.` and change the Hreinsun rule to mention `--keywords ""` too.

- [ ] **Step 5: Test and try it live**

Run: `npm run test`. Expected: green.

Then from the repo root: `node cli/huginn.mjs tag list --project metta` prints 36 lines, `smokes (N)` first. `node cli/huginn.mjs tag add "Prufa CLI" --project metta` prints `Tagg bætt við: prufa cli`; a second time prints the error `Taggið er þegar á listanum.` with exit code 1. Remove the test tag in the settings page (Eyða) or leave it for Task 11's cleanup note; prefer removing it now.

- [ ] **Step 6: Commit**

```bash
git add cli/lib/commands.mjs cli/lib/ops.mjs cli/lib/mirror.mjs cli/lib/mirror.test.mjs cli/README.md
git commit -m "feat(vinnubord): huginn tag list, tag add, --keywords and the Leitarorð line"
```

Verification set: `cli/lib/mirror.test.mjs`, `npm run test`, the two live commands. Nothing else.

---

### Task 8: hg-analyse version 12

**Files:**
- Modify: `supabase/functions/hg-analyse/lib.ts`, `supabase/functions/hg-analyse/lib.test.ts`
- Modify: `supabase/functions/hg-analyse/index.ts:44-56` (`Item`), `:116-124` (`readItem`), `:183-196` (`readProject`), `:258-278` (`runAnalysis`)

**Interfaces:**
- Produces: `MessageInput.tags: string[]`, `Analysis.keywords: string[]`, `MAX_KEYWORDS = 20`, `applyAnalysis(result: unknown, modules, tagNames: string[]): Analysis`, `mergeIntoItem(item: { body; module_id; tags; keywords: string[] }, analysis): ItemFields` with `ItemFields.keywords: string[]`.

- [ ] **Step 1: Failing tests**

In `lib.test.ts`:

- `buildUserMessage` fixture `input` gets `tags: ['efni', 'prófun']`; the order test adds `'# Tögg verkefnisins'` between modules and participants; a new test `lists the project tags one per line, or says there are none`: `expect(msg).toContain('# Tögg verkefnisins\n- efni\n- prófun')`, and with `tags: []` `expect(msg).toContain('(engin tögg skráð)')`.
- `analysisTool and SYSTEM_PROMPT`: the strict tool test adds `'keywords'` to the required list; `SYSTEM_PROMPT` contains `'aðeins af listanum Tögg verkefnisins'` and `'10 til 15 leitarorð'`.
- `applyAnalysis`: every call gets a third argument; the `describe` gets `const tagNames = ['greiðslur', 'hönnun', 'óflokkað']` and `base.keywords = ['Bókun', 'booking', 'greiðslur']`. New tests:
  - `keeps listed tags in the list spelling and moves the rest to keywords`: `applyAnalysis({ ...base, tags: ['Greiðslur', 'nýtt tagg'] }, modules, tagNames)` gives `tags: ['greiðslur']` and `keywords` containing `'nýtt tagg'`.
  - `review focus 4: all tags off the list give no tags, keywords for each, and óflokkað only when listed`: `applyAnalysis({ ...base, module_slug: null, tags: ['a', 'b'] }, modules, ['x'])` gives `tags: []`, keywords containing `'a'` and `'b'`; with `tagNames` instead it gives `tags: ['óflokkað']`.
  - `keywords are lowercased, deduped, stripped of the item's tags and capped at MAX_KEYWORDS`: `keywords: ['Bókun', 'bókun', 'greiðslur', ...Array.from({ length: 30 }, (_, i) => \`k${i}\`)]` with `tags: ['greiðslur']` gives keywords starting `['bókun', 'k0', ...]`, no `'greiðslur'`, length 20.
  - `survives a malformed tool input` stays and passes `[]` as the list.
- `mergeIntoItem`: fixtures get `keywords`; `item` gets `keywords: []`; new test `puts the item keywords first and dedupes`: `mergeIntoItem({ ...item, keywords: ['a', 'b'] }, { ...matched, keywords: ['B', 'c'] }).keywords` equals `['a', 'b', 'c']` (the analysis keywords are already lowercase from `applyAnalysis`; `mergeIntoItem` dedupes ignoring case like tags).

Run: `npx vitest run supabase/functions/hg-analyse/lib.test.ts`. Expected: FAIL.

- [ ] **Step 2: `lib.ts`**

- `MessageInput.tags: string[]`; `buildUserMessage` adds `tagPart` between `modulePart` and `peoplePart`: `['# Tögg verkefnisins', ...(tags.length > 0 ? tags.map((t) => \`- ${t}\`) : ['(engin tögg skráð)'])].join('\n')`.
- `export const MAX_KEYWORDS = 20`; `Analysis.keywords: string[]`.
- `SYSTEM_PROMPT` rule 6 becomes `6. tags: 1 til 4 tögg, aðeins af listanum Tögg verkefnisins, stafrétt. Búðu aldrei til nýtt tagg.` and a new rule 7 `7. keywords: 10 til 15 leitarorð, á íslensku og ensku, í lágstöfum: samheiti, orðin sem fólk mundi slá inn til að finna atriðið, nöfn á hlutum og þjónustum sem koma við sögu. Aldrei orð sem eru þegar tagg.`; the old rules 7 to 10 become 8 to 11.
- Tool: `tags.description` `'1 til 4 tögg af listanum Tögg verkefnisins, stafrétt.'`; new `keywords: { type: 'array', items: { type: 'string' }, description: '10 til 15 leitarorð á íslensku og ensku, í lágstöfum.' }`; `required` adds `'keywords'`.
- `applyAnalysis(result, modules, tagNames)`: after `cleanTags`, split into `listed` (each tag whose `toLowerCase()` matches a `tagNames` entry's `toLowerCase()`, replaced by that entry) and `unlisted`; `óflokkað` is pushed only when `unmatchedModule` and `tagNames` holds it (case insensitive, use the list spelling); `keywords = cleanKeywords([...(Array.isArray(r.keywords) ? r.keywords : []), ...unlisted], listed)` where `cleanKeywords` applies `cleanTag`, `toLowerCase()`, drops empties, duplicates and anything equal to a listed tag, then `slice(0, MAX_KEYWORDS)`.
- `ItemFields.keywords`; `mergeIntoItem` takes `item.keywords: string[]` and returns `keywords` deduped ignoring case, item first.

- [ ] **Step 3: `index.ts`**

`Item` gets `keywords: string[]`; `readItem` selects `keywords` too; `readProject` adds `db.from('hg_tags').select('name').eq('project_id', projectId).order('name')` to its `Promise.all`, checks its error (`Gat ekki lesið töggin: ...`) and returns `tags: (tags.data ?? []).map((t) => t.name)`; `runAnalysis` passes `tags` to `buildUserMessage` and `tags` to `applyAnalysis(input, modules, tags)`. `writeAnalysis` spreads `mergeIntoItem`, so `keywords` lands with the rest.

- [ ] **Step 4: Tests, type check, deploy**

Run: `npx vitest run supabase/functions/hg-analyse/lib.test.ts && npx -y deno@2 check --no-lock --node-modules-dir=none supabase/functions/hg-analyse/index.ts`. Expected: green.

Deploy with the MCP `deploy_edge_function` (name `hg-analyse`, `verify_jwt` false, the two files `index.ts` and `lib.ts`, entrypoint `index.ts`). As in plan 13, send the Icelandic characters as unicode escapes if the connector mangles them, then `get_edge_function` and compare the deployed text with the repo files: identical after unescaping. Expected: version 12.

Live check: create one item on the web (title `Prufa greiningar 12`, body two lines about Instagram posts for the fair) and wait about a minute: its panel shows 1 to 4 tags from the list, `select keywords from hg_items where title = 'Prufa greiningar 12'` through `execute_sql` shows 10 to 15 lowercase words with `instagram` among them. Then `huginn item close <id> --dropped --force`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/hg-analyse/lib.ts supabase/functions/hg-analyse/lib.test.ts supabase/functions/hg-analyse/index.ts
git commit -m "feat(vinnubord): hg-analyse picks tags from the list and writes keywords"
```

Verification set: `lib.test.ts`, the deno check, the deployed text comparison, the one live item. Nothing else.

---

### Task 9: Cleanup script, 0016b file, action on Heimir

**Files:**
- Create: `supabase/manual/2026-11-04-hg-tag-cleanup.sql`
- Create: `supabase/migrations/0016b_hg_tags_check.sql` (written now, applied in Task 11)
- Modify: `supabase/migrations/README.md`

- [ ] **Step 1: The cleanup script, verbatim**

```sql
-- 2026-11-04-hg-tag-cleanup.sql
-- Run by Heimir in the SQL editor, once, after migration 0016 is applied and
-- hg-analyse version 12 is live, and before 0016b is applied
-- (spec 2026-11-04-leit-og-togg-design.md, 4.5). Computed, not hardcoded:
-- correct whenever it runs. One transaction, hg.silent on, so nothing gets a
-- stamp or an event. The last statement prints the report.

begin;

select set_config('hg.silent', 'on', true);

create temp table cleanup_project on commit drop as
  select id from hg_projects where slug = 'metta';

create temp table tag_map (old_name text primary key, new_name text not null) on commit drop;
insert into tag_map values
  ('syning', 'sýning'),
  ('hitamaelingar', 'hitamælingar'),
  ('efnaskra', 'efnaskrá'),
  ('honnun', 'hönnun'),
  ('postur', 'póstur'),
  ('brainstorm', 'hugmyndavinna');

create temp table views_before on commit drop as
  select id, name from hg_views
  where project_id = (select id from cleanup_project)
    and jsonb_array_length(coalesce(filter->'tags', '[]'::jsonb)) > 0;

create temp table report (step text, detail text) on commit drop;

-- 1 and 2: lowercase, trim, spelling merges, duplicates dropped, on items
update hg_items i
set tags = hg_tags_dedupe((
  select coalesce(array_agg(coalesce(m.new_name, u.t) order by u.n), '{}')
  from (select lower(btrim(x)) as t, n from unnest(i.tags) with ordinality as a(x, n) where btrim(x) <> '') u
  left join tag_map m on m.old_name = u.t
))
where i.project_id = (select id from cleanup_project) and cardinality(i.tags) > 0;

-- 3: the same on views
update hg_views v
set filter = jsonb_set(v.filter, '{tags}', (
  select coalesce(jsonb_agg(distinct s.t), '[]'::jsonb)
  from (
    select coalesce(m.new_name, lower(btrim(x.value))) as t
    from jsonb_array_elements_text(v.filter->'tags') as x
    left join tag_map m on m.old_name = lower(btrim(x.value))
    where btrim(x.value) <> ''
  ) s
))
where v.project_id = (select id from cleanup_project)
  and jsonb_array_length(coalesce(v.filter->'tags', '[]'::jsonb)) > 0;

-- 4: a tag on an open item that is not on the list joins it
with added as (
  insert into hg_tags (project_id, name)
  select distinct i.project_id, u.t
  from hg_items i
  cross join unnest(i.tags) as u(t)
  where i.project_id = (select id from cleanup_project)
    and i.status not in ('done', 'dropped')
    and not exists (
      select 1 from hg_tags g where g.project_id = i.project_id and lower(g.name) = lower(u.t)
    )
  on conflict do nothing
  returning name
)
insert into report select 'bætt á listann', name from added;

-- 5: tags off the list leave closed items and views
update hg_items i
set tags = (
  select coalesce(array_agg(u.t order by u.n), '{}')
  from unnest(i.tags) with ordinality as u(t, n)
  where exists (select 1 from hg_tags g where g.project_id = i.project_id and lower(g.name) = lower(u.t))
)
where i.project_id = (select id from cleanup_project)
  and i.status in ('done', 'dropped')
  and exists (
    select 1 from unnest(i.tags) as u(t)
    where not exists (select 1 from hg_tags g where g.project_id = i.project_id and lower(g.name) = lower(u.t))
  );

update hg_views v
set filter = jsonb_set(v.filter, '{tags}', (
  select coalesce(jsonb_agg(x.value order by x.ordinality), '[]'::jsonb)
  from jsonb_array_elements_text(v.filter->'tags') with ordinality as x
  where exists (select 1 from hg_tags g where g.project_id = v.project_id and lower(g.name) = lower(x.value))
))
where v.project_id = (select id from cleanup_project)
  and exists (
    select 1 from jsonb_array_elements_text(coalesce(v.filter->'tags', '[]'::jsonb)) as x
    where not exists (select 1 from hg_tags g where g.project_id = v.project_id and lower(g.name) = lower(x.value))
  );

-- 6: the report
insert into report
select 'tögg á listanum', count(*)::text from hg_tags where project_id = (select id from cleanup_project);

insert into report
select 'verk með tagg utan lista (á að vera 0)', count(*)::text
from hg_items i
where i.project_id = (select id from cleanup_project)
  and exists (
    select 1 from unnest(i.tags) as u(t)
    where not exists (select 1 from hg_tags g where g.project_id = i.project_id and lower(g.name) = lower(u.t))
  );

insert into report
select 'sýn án taggs eftir hreinsun (lagaðu í Sýn valmyndinni)', b.name
from views_before b
join hg_views v on v.id = b.id
where jsonb_array_length(coalesce(v.filter->'tags', '[]'::jsonb)) = 0;

select * from report order by step, detail;

commit;
```

The `select` sits before `commit` because the temp tables are `on commit drop`. The SQL editor shows the last result set that returned rows, so the report is what Heimir sees; `commit` returns none.

- [ ] **Step 2: 0016b, verbatim**

`supabase/migrations/0016b_hg_tags_check.sql`:

```sql
-- 0016b_hg_tags_check
-- Item tags must be on the project's list (spec 4.4). Applied after Heimir
-- ran supabase/manual/2026-11-04-hg-tag-cleanup.sql and after hg-analyse
-- version 12 is live (version 11 wrote free tags). Every tag is replaced by
-- the list's spelling, duplicates drop, order stays, and a tag off the list
-- is refused with 22023.

create or replace function hg_items_check_tags()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_bad text;
  v_tags text[];
begin
  if new.tags is null or cardinality(new.tags) = 0 then
    new.tags := '{}';
    return new;
  end if;

  select u.t into v_bad
  from unnest(new.tags) with ordinality as u(t, n)
  where not exists (
    select 1 from hg_tags g where g.project_id = new.project_id and lower(g.name) = lower(btrim(u.t))
  )
  order by u.n
  limit 1;
  if v_bad is not null then
    raise exception 'Taggið "%" er ekki á taggalista verkefnisins.', v_bad using errcode = '22023';
  end if;

  select coalesce(array_agg(s.name order by s.n), '{}') into v_tags
  from (
    select g.name, min(u.n) as n
    from unnest(new.tags) with ordinality as u(t, n)
    join hg_tags g on g.project_id = new.project_id and lower(g.name) = lower(btrim(u.t))
    group by g.name
  ) s;
  new.tags := v_tags;
  return new;
end;
$$;

create trigger hg_items_tags_trg
  before insert or update of tags on hg_items
  for each row execute function hg_items_check_tags();
```

- [ ] **Step 3: README**

`supabase/migrations/README.md`: add a paragraph before the Files list: `The folder \`supabase/manual/\` holds scripts Heimir runs himself in the SQL editor (cleanups with DELETE or data rewrites). They are not migrations and are never applied by an agent.` Add to the Files list: `- 0016b_hg_tags_check: trigger that canonicalises item tags against hg_tags and refuses a tag off the list (22023). Applied after the manual tag cleanup and after hg-analyse version 12.`

- [ ] **Step 4: Action on Heimir and tell him**

From `D:/Claude Code/metta2/metta2_new`, find the Huginn item for this plan if one exists (`huginn pull`); if none, skip the action and only tell Heimir in chat. Otherwise: `huginn action add <id> --owner H --body "Keyra taggahreinsunina í SQL editor (ein færsla, prentar skýrslu í lokin). Eftir hana beitir Claude 0016b." --payload-file supabase/manual/2026-11-04-hg-tag-cleanup.sql`. In chat, tell Heimir in two lines that the script is ready at that path, that it is safe to run now (0016 and version 12 are live), and that 0016b and smoke 13 wait on it.

- [ ] **Step 5: Commit**

```bash
git add supabase/manual/2026-11-04-hg-tag-cleanup.sql supabase/migrations/0016b_hg_tags_check.sql supabase/migrations/README.md
git commit -m "chore(vinnubord): tag cleanup script for Heimir and migration 0016b"
```

Verification set: `npm run build` (unchanged, a sanity run) and a syntax read of both SQL files by the reviewer. Nothing is applied in this task.

---

### Task 10: Skill rules and keywords on the existing items

**Files:**
- Modify: `D:/Claude Code/metta2/metta2_new/.claude/skills/huginn/SKILL.md` (the `item set` line in "Þegar nýtt verk er sótt", the `item create` line in Lotulok 6, the Reglur list)
- Data: `huginn item set <id> --keywords "..."` on every item `huginn sync` mirrors

- [ ] **Step 1: Skill**

In `SKILL.md`:
- "Þegar nýtt verk er sótt" step 2: the command becomes `huginn item set <id> --body-file <skrá> --summary "<1 til 3 línur>" --module <módúll> --tags a,b --keywords "..."`, and add after it: `Tögg aðeins af \`huginn tag list\`. Leitarorð: 10 til 15 orð á íslensku og ensku, komma á milli, lágstafir: samheiti, orðin sem fólk mundi slá inn, nöfn á hlutum og þjónustum. Aldrei orð sem er þegar tagg.`
- Lotulok 6: the `item create` command gets `--keywords "..."` after `--module <módúll>`.
- Reglur, three new lines after the first: `- Tögg koma af taggalistanum (\`huginn tag list\`). \`huginn tag add\` aðeins þegar ekkert tagg nær yfir verkið, og segðu Heimi frá nýja tagginu í lotulokum.`, `- Hvert \`item create\` og greiningin (\`item set\` með \`--body-file\` og \`--summary\`) ber \`--keywords\` eftir reglunni í Þegar nýtt verk er sótt.`, `- \`--keywords\` skiptir listanum út: lota sem bætir við byrjar á línunni \`Leitarorð:\` í \`item.md\` og skrifar allan listann aftur.`

Commit in metta2_new: `git -C "D:/Claude Code/metta2/metta2_new" add .claude/skills/huginn/SKILL.md && git -C "D:/Claude Code/metta2/metta2_new" commit -m "docs(huginn): tags from the list, keywords on every item"` and push it (`git push origin main` there, after `git pull --ff-only`).

- [ ] **Step 2: Keywords on the existing items**

From `D:/Claude Code/metta2/metta2_new`: `huginn sync`, then list the item folders under `docs/huginn/` (each ends with the 6 character id prefix; the full id is the `Auðkenni:` line in its `item.md`). Split the folders into batches of about 10 and dispatch one Sonnet subagent per batch with this brief: "For each folder listed, read `item.md`, write 10 to 15 search keywords in Icelandic and English (lowercase, comma separated, synonyms, the words a person would type to find it, names of things and services involved, never a word that is already a tag on the `Merki:` line), and run `node "D:/Claude Code/Huginn/huginn/cli/huginn.mjs" item set <full id> --keywords "<words>"` from `D:/Claude Code/metta2/metta2_new`. Write nothing else. Report the ids done and any command that failed." Run the batches in parallel (at most 3 at a time, no mass process spawning). Afterwards `execute_sql`: `select count(*) from hg_items where project_id = (select id from hg_projects where slug = 'metta') and status not in ('done','dropped') and cardinality(keywords) = 0;` Expected: 0. And `select max(updated_at) from hg_items ...` must not have moved past the last real edit (compare with the value before the batch).

- [ ] **Step 3: Record**

No commit in this repo; note the counts (items written, failures) for the handover in Task 12.

Verification set: the two `execute_sql` checks. Nothing else.

---

### Task 11: Apply 0016b, smoke 13

**Files:**
- Modify: `scripts/hg-smoke.mjs` (`TOTAL`, new scenario after 12, cleanup in `finally`)

- [ ] **Step 1: Check the cleanup ran**

`execute_sql`: `select count(*) from hg_items i where project_id = (select id from hg_projects where slug = 'metta') and exists (select 1 from unnest(i.tags) t where not exists (select 1 from hg_tags g where g.project_id = i.project_id and lower(g.name) = lower(t)));` Expected: 0 once Heimir has run the script. If it is not 0, stop this task: write the smoke scenario anyway (Steps 2 and 3), commit it, and report DONE_WITH_CONCERNS saying 0016b and the smoke run wait on the cleanup; Task 12 records that.

- [ ] **Step 2: Apply 0016b**

MCP `apply_migration` with name `0016b_hg_tags_check` and the file content. Then `execute_sql`: `update hg_items set tags = tags where id = (select id from hg_items where project_id = (select id from hg_projects where slug = 'metta') limit 1) returning tags;` Expected: the same tags back (the trigger accepts every current tag).

- [ ] **Step 3: Smoke scenario 13**

`TOTAL = 13`. A `let smokeTags = []` next to `smokeObjects`. After scenario 12's `passed++` and before `} finally {`:

```js
    scenario = '13 tags and keywords'
    const addTag13 = async (name) => {
      const row = must(await sb.from('hg_tags').insert({ project_id: projectId, name, created_by: me }).select('id, name').single(), `insert tag ${name}`)
      smokeTags.push(row.id)
      return row
    }
    const ta = await addTag13('smoke tag')
    const tb = await addTag13('smoke tag b')
    // a: canonical spelling and dedupe on write
    must(await sb.from('hg_items').update({ tags: ['Smoke Tag', 'SMOKE TAG', 'smoke tag b'] }).eq('id', itemId), 'set tags')
    let row13 = must(await sb.from('hg_items').select('tags, updated_at').eq('id', itemId).single(), 'read tags')
    expect(JSON.stringify(row13.tags) === JSON.stringify(['smoke tag', 'smoke tag b']), `tags after write ${JSON.stringify(row13.tags)}`)
    // b: a tag off the list is refused with 22023
    const bad13 = await sb.from('hg_items').update({ tags: ['smoke tag', 'ekki til'] }).eq('id', itemId)
    expect(bad13.error?.code === '22023' && /ekki til/.test(bad13.error.message), `off list tag gave ${JSON.stringify(bad13.error)}`)
    // c: rename moves no stamp and logs nothing
    const ev13Before = (await readEvents()).length
    const stamp13 = row13.updated_at
    must(await sb.rpc('hg_tag_rename', { p_tag: ta.id, p_name: 'smoke tag renamed' }), 'rename')
    row13 = must(await sb.from('hg_items').select('tags, updated_at').eq('id', itemId).single(), 'read after rename')
    expect(row13.tags[0] === 'smoke tag renamed' && row13.updated_at === stamp13, `rename ${JSON.stringify(row13)}`)
    expect((await readEvents()).length === ev13Before, 'rename logged an event')
    // d: a view with this tag alone blocks delete
    const view13 = must(
      await sb.from('hg_views').insert({ project_id: projectId, name: 'smoke tag view', filter: { tones: [], packages: [], tags: ['smoke tag renamed'] }, created_by: me }).select('id').single(),
      'insert tag view',
    )
    viewId = view13.id
    const blocked13 = await sb.rpc('hg_tag_delete', { p_tag: ta.id })
    expect(blocked13.error?.code === '22023' && /smoke tag view/.test(blocked13.error.message), `delete with a view gave ${JSON.stringify(blocked13.error)}`)
    // e: merge rewrites the item and the view, drops the from row
    must(await sb.rpc('hg_tag_merge', { p_from: ta.id, p_into: tb.id }), 'merge')
    row13 = must(await sb.from('hg_items').select('tags, updated_at').eq('id', itemId).single(), 'read after merge')
    expect(JSON.stringify(row13.tags) === JSON.stringify(['smoke tag b']) && row13.updated_at === stamp13, `merge ${JSON.stringify(row13)}`)
    const view13After = must(await sb.from('hg_views').select('filter').eq('id', view13.id).single(), 'view after merge')
    expect(JSON.stringify(view13After.filter.tags) === JSON.stringify(['smoke tag b']), `view after merge ${JSON.stringify(view13After.filter)}`)
    const gone13 = must(await sb.from('hg_tags').select('id').eq('id', ta.id), 'from row')
    expect(gone13.length === 0, 'merge kept the from row')
    // f: delete once the view has another tag
    must(await sb.from('hg_views').update({ filter: { tones: [], packages: [], tags: ['smoke tag b', 'smokes'] } }).eq('id', view13.id), 'widen view')
    must(await sb.rpc('hg_tag_delete', { p_tag: tb.id }), 'delete')
    row13 = must(await sb.from('hg_items').select('tags, updated_at').eq('id', itemId).single(), 'read after delete')
    expect(row13.tags.length === 0 && row13.updated_at === stamp13, `delete ${JSON.stringify(row13)}`)
    smokeTags = []
    // g: review focus 2, a rename that collides ignoring case is refused
    const tc = await addTag13('smoke tag c')
    const td = await addTag13('smoke tag d')
    const dup13 = await sb.rpc('hg_tag_rename', { p_tag: tc.id, p_name: 'SMOKE TAG D' })
    expect(dup13.error?.code === '23505', `case collision gave ${JSON.stringify(dup13.error)}`)
    void td
    // h: review focus 3, keywords move no stamp and log nothing
    must(await sb.from('hg_items').update({ keywords: ['social media', 'efni'] }).eq('id', itemId), 'set keywords')
    row13 = must(await sb.from('hg_items').select('keywords, updated_at').eq('id', itemId).single(), 'read keywords')
    expect(row13.keywords.length === 2 && row13.updated_at === stamp13, `keywords ${JSON.stringify(row13)}`)
    expect((await readEvents()).length === ev13Before, 'keywords logged an event')
    passed++
```

In `finally`, before the `viewId` block: delete every id left in `smokeTags` from `hg_tags` (`.delete().in('id', smokeTags)`), logging a leak like the others. The existing `viewId` cleanup removes the tag view.

- [ ] **Step 4: Run it**

Run: `npm run smoke:hg`. Expected: `ok 13/13`.

- [ ] **Step 5: Commit**

```bash
git add scripts/hg-smoke.mjs
git commit -m "test(vinnubord): smoke scenario 13, tags and keywords"
```

Verification set: the `execute_sql` checks in Steps 1 and 2 and `npm run smoke:hg`. Nothing else.

---

### Task 12: Handover and CLAUDE.md

**Files:**
- Create: `docs/progress/14-leit-og-togg.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Handover**

`docs/progress/14-leit-og-togg.md` in the shape of `docs/progress/13-skjol.md`: head (date, branch, plan, spec, state), "Hvað var gert" per task with commit hashes, "Ákvarðanir í byggingu", "Staðfesting" (test count, build, smoke result, deno check, version 12), "Það sem Heimir athugar" (Ctrl+F on the board, in a panel, in the reader; Esc; a search for `syning`; a rename in settings seen on a card head, the filter menu and a view with no glow anywhere; a new item with tags from the list; `huginn tag list`), and "Opið" (whether 0016b and smoke 13 are still waiting on the cleanup, the keyword counts from Task 10, the test tag or item left behind if any).

- [ ] **Step 2: CLAUDE.md**

Edit only the sections that changed: Current state (a "Plan 14 (leit og tögg)" paragraph in the style of the others, with the test count, and `docs/progress/14-leit-og-togg.md` in the open items list), Commands (`huginn tag list`, `tag add`, `--keywords`), Folder structure (`lib/search.ts`, `lib/tags.ts`, `settings/TagsEditor.tsx`, `supabase/manual/`), hg_ tables (`hg_tags`, `hg_items.keywords`), Migrations (`0016_hg_tags_keywords`, `0016b_hg_tags_check` with their applied dates or "not yet applied"), Edge function (version 12, the tag list in the message, keywords), Design System (no new classes; say the tag editor reuses `.hg-set-*`), Key Patterns (three new bullets: "Search is one folded index", "Tags are a fixed list", "Keywords are hidden and silent").

- [ ] **Step 3: Commit, merge, push**

```bash
git add docs/progress/14-leit-og-togg.md CLAUDE.md
git commit -m "docs(vinnubord): plan 14 handover and CLAUDE.md"
```

Then the controller runs the Fable whole branch review; after a clean round: `git checkout main && git pull --ff-only origin main && git merge --ff-only vinnubord-14 && npm run build && git push origin main`. Claude pushes, never Heimir.

Verification set: `npm run build` on main after the merge. Nothing else.

---

## After the tasks

- Final whole branch review on Fable, fix round reviewed too, loop until clean (global rules).
- If Heimir has not run the cleanup by the end: main carries 0016b unapplied and smoke 13 fails on scenario 13 step a (an uppercase tag is stored as typed). The handover says so and the next session applies 0016b and runs the smoke after he confirms.
