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
  -- Clear the flag so later statements in the same transaction stamp and log again.
  perform set_config('hg.silent', '', true);
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
  -- Clear the flag so later statements in the same transaction stamp and log again.
  perform set_config('hg.silent', '', true);
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
  -- Clear the flag so later statements in the same transaction stamp and log again.
  perform set_config('hg.silent', '', true);
  return v_n;
end;
$$;

revoke all on function hg_tag_rename(uuid, text) from public, anon;
revoke all on function hg_tag_merge(uuid, uuid) from public, anon;
revoke all on function hg_tag_delete(uuid) from public, anon;
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
