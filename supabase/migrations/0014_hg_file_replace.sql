-- 0014_hg_file_replace
-- A file added on a repo path that already has a row replaces that row instead of
-- piling up (spec 2026-11-03-skjal-uppfaert-design.md, same repo path is the same
-- file). hg_files gets updated_at and updated_by, stamped when storage_path
-- changes and logged as file.updated. Both file events carry file_id, hg_unread
-- counts one document once however often it was replaced, and (item_id,
-- repo_path) is unique where repo_path is set. Heimir runs the duplicate cleanup
-- from the spec before this is applied.

alter table hg_files
  add column updated_at timestamptz,
  add column updated_by uuid;

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

  elsif tg_table_name = 'hg_comments' then
    if tg_op = 'INSERT' then
      new.user_id := coalesce(auth.uid(), new.user_id);
    else
      new.user_id := old.user_id;
    end if;

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

  return new;
end;
$$;

create or replace function hg_log_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_fields text[] := '{}';
  v_item uuid;
begin
  if tg_table_name = 'hg_items' then
    if tg_op = 'INSERT' then
      insert into hg_events (created_at, project_id, item_id, module_id, actor, kind, data)
      values (clock_timestamp(), new.project_id, new.id, new.module_id,
              coalesce(v_uid, new.created_by), 'item.created', '{}');
    else
      if new.status is distinct from old.status
         or new.waiting_on is distinct from old.waiting_on then
        insert into hg_events (created_at, project_id, item_id, module_id, actor, kind, data)
        values (clock_timestamp(), new.project_id, new.id, new.module_id,
                coalesce(v_uid, new.updated_by), 'item.status',
                jsonb_build_object('from', old.status, 'to', new.status,
                                   'waiting_on', new.waiting_on,
                                   'waiting_on_from', old.waiting_on));
      end if;

      if new.title is distinct from old.title then
        v_fields := array_append(v_fields, 'title');
      end if;
      if new.summary is distinct from old.summary then
        v_fields := array_append(v_fields, 'summary');
      end if;
      if new.body is distinct from old.body then
        v_fields := array_append(v_fields, 'body');
      end if;
      if new.module_id is distinct from old.module_id then
        v_fields := array_append(v_fields, 'module_id');
      end if;
      if new.tags is distinct from old.tags then
        v_fields := array_append(v_fields, 'tags');
      end if;
      if new.next_step is distinct from old.next_step then
        v_fields := array_append(v_fields, 'next_step');
      end if;
      if new.next_prompt is distinct from old.next_prompt then
        v_fields := array_append(v_fields, 'next_prompt');
      end if;

      if cardinality(v_fields) > 0 then
        insert into hg_events (created_at, project_id, item_id, module_id, actor, kind, data)
        values (clock_timestamp(), new.project_id, new.id, new.module_id,
                coalesce(v_uid, new.updated_by), 'item.updated',
                jsonb_build_object('fields', to_jsonb(v_fields)));
      end if;
    end if;

  elsif tg_table_name = 'hg_plans' then
    if tg_op = 'INSERT' then
      insert into hg_events (created_at, project_id, item_id, actor, kind, data)
      values (clock_timestamp(), new.project_id, new.item_id, v_uid, 'plan.added', '{}');
    elsif new.status is distinct from old.status then
      insert into hg_events (created_at, project_id, item_id, actor, kind, data)
      values (clock_timestamp(), new.project_id, new.item_id, v_uid, 'plan.status',
              jsonb_build_object('from', old.status, 'to', new.status));
    end if;

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

  elsif tg_table_name = 'hg_questions' then
    if tg_op = 'INSERT' then
      insert into hg_events (created_at, project_id, item_id, actor, kind, data)
      values (clock_timestamp(), new.project_id, new.item_id,
              coalesce(v_uid, new.asked_by), 'question.asked', '{}');
      if new.answer is not null then
        insert into hg_events (created_at, project_id, item_id, actor, kind, data)
        values (clock_timestamp(), new.project_id, new.item_id,
                coalesce(v_uid, new.answered_by), 'question.answered', '{}');
      end if;
    elsif old.answer is null and new.answer is not null then
      insert into hg_events (created_at, project_id, item_id, actor, kind, data)
      values (clock_timestamp(), new.project_id, new.item_id,
              coalesce(v_uid, new.answered_by), 'question.answered', '{}');
    end if;

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

  elsif tg_table_name = 'hg_rulings' then
    if tg_op = 'INSERT' then
      select p.item_id into v_item from hg_plans p where p.id = new.plan_id;
      insert into hg_events (created_at, project_id, item_id, actor, kind, data)
      values (clock_timestamp(), new.project_id, v_item, v_uid, 'ruling.added', '{}');
    end if;

  elsif tg_table_name = 'hg_comments' then
    if tg_op = 'INSERT' then
      insert into hg_events (created_at, project_id, item_id, module_id, actor, kind, data)
      values (clock_timestamp(), new.project_id, new.item_id, new.module_id,
              coalesce(v_uid, new.user_id), 'comment.added', '{}');
    end if;
  end if;

  return null;
end;
$$;

create or replace trigger hg_files_log_event_trg
  after insert or update on hg_files
  for each row execute function hg_log_event();

-- One document counts once however often it was replaced: file.updated is
-- reported under file.added, so an add and its replaces are one group. Events
-- without file_id (every other kind, and file events from before 0014) count
-- one each.
create or replace function hg_unread(p_project uuid)
returns table (item_id uuid, kind text, n bigint, latest timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select e.item_id,
         case when e.kind = 'file.updated' then 'file.added' else e.kind end as kind,
         count(distinct coalesce(e.data->>'file_id', e.id::text))::bigint as n,
         max(e.created_at) as latest
  from hg_events e
  join hg_items i on i.id = e.item_id and i.status not in ('done', 'dropped')
  left join hg_reads r on r.item_id = e.item_id and r.user_id = auth.uid()
  where e.project_id = p_project
    and e.actor is distinct from auth.uid()
    and (r.read_at is null or e.created_at > r.read_at)
  group by e.item_id, 2
$$;

revoke all on function hg_unread(uuid) from public;
grant execute on function hg_unread(uuid) to authenticated;

create unique index hg_files_item_repo_path_key
  on hg_files (item_id, repo_path) where repo_path is not null;
