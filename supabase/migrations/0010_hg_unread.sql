-- 0010_hg_unread
-- Unread per viewer from hg_events (spec 2026-11-01-olesid-og-synir-design.md, 4.1).
-- 1. hg_actions.created_by, stamped like the other author columns, so a fresh
--    action has an author. Old rows stay null and null counts as someone else.
-- 2. hg_unread(p_project): the viewer's unread events per item and kind. An
--    event is unread when its actor is not the viewer (null included) and it is
--    newer than the viewer's read mark on the item, or there is no mark.
-- 3. hg_mark_all_read(p_project): a read mark on every open item for the viewer.

-- 1. created_by on hg_actions
alter table hg_actions add column created_by uuid;

create or replace function hg_stamp_author()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_table_name = 'hg_items' then
    if tg_op = 'INSERT' then
      new.created_by := coalesce(auth.uid(), new.created_by);
    else
      new.created_by := old.created_by;
      new.updated_by := coalesce(auth.uid(), new.updated_by);
    end if;

  elsif tg_table_name = 'hg_questions' then
    if tg_op = 'INSERT' then
      new.asked_by := coalesce(auth.uid(), new.asked_by);
      if new.answer is not null then
        new.answered_by := coalesce(auth.uid(), new.answered_by);
        new.answered_at := now();
      else
        new.answered_by := null;
        new.answered_at := null;
      end if;
    else
      new.asked_by := old.asked_by;
      if new.answer is null then
        new.answered_by := null;
        new.answered_at := null;
      elsif old.answer is not null then
        new.answered_by := old.answered_by;
        new.answered_at := old.answered_at;
      else
        new.answered_by := coalesce(auth.uid(), new.answered_by);
        new.answered_at := now();
      end if;
    end if;

  elsif tg_table_name = 'hg_files' then
    if tg_op = 'INSERT' then
      new.uploaded_by := coalesce(auth.uid(), new.uploaded_by);
    else
      new.uploaded_by := old.uploaded_by;
    end if;

  elsif tg_table_name = 'hg_comments' then
    if tg_op = 'INSERT' then
      new.user_id := coalesce(auth.uid(), new.user_id);
    else
      new.user_id := old.user_id;
    end if;

  elsif tg_table_name = 'hg_actions' then
    -- owner is the assignee, never stamped. created_by is the author (0010).
    if tg_op = 'INSERT' then
      new.created_by := coalesce(auth.uid(), new.created_by);
    else
      new.created_by := old.created_by;
    end if;
    if new.done_at is null then
      new.done_by := null;
    elsif tg_op = 'INSERT' or old.done_at is null then
      new.done_by := coalesce(auth.uid(), new.done_by);
    else
      new.done_by := old.done_by;
    end if;
  end if;

  return new;
end;
$$;

-- 2. unread events per item and kind for the signed in viewer
create index hg_events_project_created_idx on hg_events (project_id, created_at);

create or replace function hg_unread(p_project uuid)
returns table (item_id uuid, kind text, n bigint, latest timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select e.item_id, e.kind, count(*)::bigint as n, max(e.created_at) as latest
  from hg_events e
  left join hg_reads r on r.item_id = e.item_id and r.user_id = auth.uid()
  where e.project_id = p_project
    and e.item_id is not null
    and e.actor is distinct from auth.uid()
    and (r.read_at is null or e.created_at > r.read_at)
  group by e.item_id, e.kind
$$;

revoke all on function hg_unread(uuid) from public;
grant execute on function hg_unread(uuid) to authenticated;

-- 3. mark every open item of the project read for the signed in viewer
create or replace function hg_mark_all_read(p_project uuid)
returns void
language sql
security invoker
set search_path = public
as $$
  insert into hg_reads (project_id, item_id, user_id)
  select i.project_id, i.id, auth.uid()
  from hg_items i
  where i.project_id = p_project
    and i.status not in ('done', 'dropped')
    and auth.uid() is not null
  on conflict (item_id, user_id) do update set read_at = now()
$$;

revoke all on function hg_mark_all_read(uuid) from public;
grant execute on function hg_mark_all_read(uuid) to authenticated;
