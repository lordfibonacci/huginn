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
