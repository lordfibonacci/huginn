-- 0004_hg_trigger_fixes: answering no longer reopens closed or parked items, a
-- ball move logs an event, attribution columns cannot be forged, dragging a card
-- is not a change, hg_service_user is not callable from the web, and an insert
-- keeps a supplied closed_at. Touches only hg_ objects. No drop, no delete.

-- 1. updated_at on hg_items and hg_plans. Drag guard for hg_items.
-- BEFORE triggers on hg_items fire alphabetically by name:
--   hg_items_closed_at_trg, hg_items_stamp_trg, hg_items_touch_trg.
-- hg_items_touch_trg runs last, so the drag guard is folded into this function
-- (no new trigger). When only pos_x, pos_y, updated_at and updated_by differ,
-- the old updated_at and updated_by are kept, undoing both the stamp and the
-- touch. A drag then marks nothing unread and credits nobody as last mover.
create or replace function hg_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_table_name = 'hg_items'
     and to_jsonb(new) - 'pos_x' - 'pos_y' - 'updated_at' - 'updated_by'
       = to_jsonb(old) - 'pos_x' - 'pos_y' - 'updated_at' - 'updated_by' then
    new.updated_at := old.updated_at;
    new.updated_by := old.updated_by;
    return new;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- 2. closed_at on hg_items. An insert keeps a supplied closed_at (backfills),
-- update behaviour is unchanged.
create or replace function hg_item_closed_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status in ('done', 'dropped') then
    if tg_op = 'INSERT' then
      new.closed_at := coalesce(new.closed_at, now());
    elsif old.status not in ('done', 'dropped') then
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

-- 3. Attribution stamping.
-- Questions: an answer edit keeps the first answerer and time, clearing the
-- answer clears both, a new answer is always timed by the server. A question
-- inserted with an answer is stamped the same way, one inserted without an
-- answer carries no answer stamp.
-- Actions: done_by is stamped on insert too, and a later edit of a done action
-- keeps the first done_by.
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
    -- owner is the assignee, never stamped
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

-- hg_actions had only a BEFORE UPDATE stamp trigger. This one covers INSERT
-- and does not overlap it.
create trigger hg_actions_stamp_ins_trg
  before insert on hg_actions
  for each row execute function hg_stamp_author();

-- 4. Event log.
-- Items: item.status is written when status or waiting_on changes, so a ball
-- move between people with status already waiting is logged. pos, updated_at,
-- updated_by and closed_at only changes still write nothing.
-- Questions: an insert with an answer writes question.asked and question.answered.
-- Actions: an insert with done_at writes action.added and action.done.
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
              jsonb_build_object('name', new.name));
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

-- 5. Answer moves the ball, but only for open work. Done, dropped and parked
-- items stay where they are. A question inserted already answered never moves
-- the ball (this trigger fires on update only).
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
     where id = new.item_id
       and status not in ('done', 'dropped', 'parked');
  end if;
  return null;
end;
$$;

-- 6. hg_service_user is used only inside security definer triggers, which run
-- as the owner. The web never calls it.
revoke execute on function hg_service_user(uuid) from authenticated;
