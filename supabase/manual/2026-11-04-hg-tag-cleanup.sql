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
