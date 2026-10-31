-- 0003_hg_triggers_storage: updated_at, closed_at, attribution stamping, event log,
-- answer moves the ball, private hg-files bucket. Touches only hg_ objects, the
-- hg-files bucket row and the hg_files_* policies on storage.objects.

-- 1. updated_at on hg_items and hg_plans
create or replace function hg_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger hg_items_touch_trg
  before update on hg_items
  for each row execute function hg_touch_updated_at();

create trigger hg_plans_touch_trg
  before update on hg_plans
  for each row execute function hg_touch_updated_at();

-- 2. closed_at on hg_items. Entering done or dropped sets it, leaving clears it,
-- moving between done and dropped keeps it.
create or replace function hg_item_closed_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status in ('done', 'dropped') then
    if tg_op = 'INSERT' or old.status not in ('done', 'dropped') then
      new.closed_at := now();
    else
      new.closed_at := coalesce(old.closed_at, now());
    end if;
  else
    new.closed_at := null;
  end if;
  return new;
end;
$$;

create trigger hg_items_closed_at_trg
  before insert or update on hg_items
  for each row execute function hg_item_closed_at();

-- 3. Attribution stamping. A signed in user is always the author of what they
-- write. The service role (auth.uid() null) keeps the supplied value. Author
-- columns cannot be rewritten on update.
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
    else
      new.asked_by := old.asked_by;
      if old.answer is null and new.answer is not null then
        new.answered_by := coalesce(auth.uid(), new.answered_by);
        new.answered_at := coalesce(new.answered_at, now());
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
    -- owner is the assignee, never stamped
    if tg_op = 'UPDATE' then
      if old.done_at is null and new.done_at is not null then
        new.done_by := coalesce(auth.uid(), new.done_by);
      elsif new.done_at is null then
        new.done_by := null;
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger hg_items_stamp_trg
  before insert or update on hg_items
  for each row execute function hg_stamp_author();

create trigger hg_questions_stamp_trg
  before insert or update on hg_questions
  for each row execute function hg_stamp_author();

create trigger hg_files_stamp_trg
  before insert or update on hg_files
  for each row execute function hg_stamp_author();

create trigger hg_comments_stamp_trg
  before insert or update on hg_comments
  for each row execute function hg_stamp_author();

create trigger hg_actions_stamp_trg
  before update on hg_actions
  for each row execute function hg_stamp_author();

-- 4. Event log. hg_events is written only here (security definer).
-- Actor is auth.uid(), else the row's own author column.
-- created_at uses clock_timestamp() so events in one transaction keep their order.
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
      if new.status is distinct from old.status then
        insert into hg_events (created_at, project_id, item_id, module_id, actor, kind, data)
        values (clock_timestamp(), new.project_id, new.id, new.module_id,
                coalesce(v_uid, new.updated_by), 'item.status',
                jsonb_build_object('from', old.status, 'to', new.status,
                                   'waiting_on', new.waiting_on));
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
              jsonb_build_object('name', new.name));
    end if;

  elsif tg_table_name = 'hg_questions' then
    if tg_op = 'INSERT' then
      insert into hg_events (created_at, project_id, item_id, actor, kind, data)
      values (clock_timestamp(), new.project_id, new.item_id,
              coalesce(v_uid, new.asked_by), 'question.asked', '{}');
    elsif old.answer is null and new.answer is not null then
      insert into hg_events (created_at, project_id, item_id, actor, kind, data)
      values (clock_timestamp(), new.project_id, new.item_id,
              coalesce(v_uid, new.answered_by), 'question.answered', '{}');
    end if;

  elsif tg_table_name = 'hg_actions' then
    if tg_op = 'INSERT' then
      insert into hg_events (created_at, project_id, item_id, actor, kind, data)
      values (clock_timestamp(), new.project_id, new.item_id, v_uid, 'action.added', '{}');
    elsif old.done_at is null and new.done_at is not null then
      insert into hg_events (created_at, project_id, item_id, actor, kind, data)
      values (clock_timestamp(), new.project_id, new.item_id,
              coalesce(v_uid, new.done_by), 'action.done', '{}');
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

create trigger hg_items_log_event_trg
  after insert or update on hg_items
  for each row execute function hg_log_event();

create trigger hg_plans_log_event_trg
  after insert or update on hg_plans
  for each row execute function hg_log_event();

create trigger hg_files_log_event_trg
  after insert on hg_files
  for each row execute function hg_log_event();

create trigger hg_questions_log_event_trg
  after insert or update on hg_questions
  for each row execute function hg_log_event();

create trigger hg_actions_log_event_trg
  after insert or update on hg_actions
  for each row execute function hg_log_event();

create trigger hg_rulings_log_event_trg
  after insert on hg_rulings
  for each row execute function hg_log_event();

create trigger hg_comments_log_event_trg
  after insert on hg_comments
  for each row execute function hg_log_event();

-- 5. Answer moves the ball. When the last open question on an item is answered,
-- the item goes to waiting on the project's service user (null if none).
-- Named so it fires after hg_questions_log_event_trg (alphabetical order).
create or replace function hg_question_answered()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.answer is not null and old.answer is null
     and not exists (
       select 1 from hg_questions
       where item_id = new.item_id
         and answer is null
     ) then
    update hg_items
       set status = 'waiting',
           waiting_on = hg_service_user(project_id),
           updated_by = coalesce(auth.uid(), new.answered_by)
     where id = new.item_id;
  end if;
  return null;
end;
$$;

create trigger hg_questions_move_ball_trg
  after update of answer on hg_questions
  for each row execute function hg_question_answered();

-- 6. Storage path guard. storage.objects is shared with other buckets, so the
-- first path segment is checked against the uuid pattern before any cast.
create or replace function hg_can_access_path(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_seg text := split_part(p_name, '/', 1);
begin
  if v_seg is null
     or v_seg !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return false;
  end if;
  return hg_is_participant(v_seg::uuid);
end;
$$;

revoke execute on function hg_can_access_path(text) from public, anon;
grant execute on function hg_can_access_path(text) to authenticated;

-- 7. Private bucket, 50 MB per file. Path pattern: <project_id>/...
insert into storage.buckets (id, name, public, file_size_limit)
values ('hg-files', 'hg-files', false, 52428800)
on conflict (id) do nothing;

create policy hg_files_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'hg-files' and public.hg_can_access_path(name));
create policy hg_files_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'hg-files' and public.hg_can_access_path(name));
create policy hg_files_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'hg-files' and public.hg_can_access_path(name));
