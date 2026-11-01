-- 0010b_hg_unread_open_only
-- hg_unread returns groups for open items only. Groups on done and dropped
-- items were never cleared by hg_mark_all_read and grew without bound toward
-- the PostgREST row cap, where rows would be cut without an error. The web
-- never showed them (cards are open items only). Same signature and grants as
-- 0010.

create or replace function hg_unread(p_project uuid)
returns table (item_id uuid, kind text, n bigint, latest timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select e.item_id, e.kind, count(*)::bigint as n, max(e.created_at) as latest
  from hg_events e
  join hg_items i on i.id = e.item_id and i.status not in ('done', 'dropped')
  left join hg_reads r on r.item_id = e.item_id and r.user_id = auth.uid()
  where e.project_id = p_project
    and e.actor is distinct from auth.uid()
    and (r.read_at is null or e.created_at > r.read_at)
  group by e.item_id, e.kind
$$;

revoke all on function hg_unread(uuid) from public;
grant execute on function hg_unread(uuid) to authenticated;
