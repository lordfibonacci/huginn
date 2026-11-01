-- 0012_hg_action_edits
-- An open action can be changed and cancelled (spec 2026-11-01-olesid-og-synir-design.md, 5b).
-- updated_at and updated_by stamp a change of body, owner or payload. A cancelled
-- action is a closed action (done_at set) with cancelled = true and a reason, so
-- every rule that reads done_at (0009, waitsFor, guardClose) is unchanged.
-- Events: action.updated with the changed fields, action.cancelled instead of
-- action.done when done_at is set together with cancelled.

alter table hg_actions
  add column updated_at timestamptz,
  add column updated_by uuid,
  add column cancelled boolean not null default false,
  add column cancel_reason text;

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
