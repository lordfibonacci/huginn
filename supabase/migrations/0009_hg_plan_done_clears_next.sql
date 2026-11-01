-- 0009_hg_plan_done_clears_next
-- A plan entering done clears next_step and next_prompt of its item whenever
-- the 0008 rules move the item (ready, waiting or done), because the prompt
-- that ran the plan is spent. The session end list of the /huginn skill sets
-- the plan done before it writes the item, so a new next step written after
-- it stays. A plan done beside a building plan still leaves the item alone,
-- and plan building keeps the prompt that resumes it. Otherwise as 0008.

create or replace function hg_plan_moves_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_other_building boolean;
  v_other_todo boolean;
  v_waiting_on uuid;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return null;
  end if;
  if new.status = 'todo' then
    return null;
  end if;

  select status into v_status from hg_items where id = new.item_id;
  if not found or v_status in ('done', 'dropped') then
    return null;
  end if;

  if new.status = 'building' then
    if v_status <> 'building' then
      update hg_items
         set status = 'building',
             waiting_on = null,
             updated_by = coalesce(auth.uid(), updated_by)
       where id = new.item_id;
    end if;
    return null;
  end if;

  -- new.status = 'done'
  select coalesce(bool_or(status = 'building'), false),
         coalesce(bool_or(status = 'todo'), false)
    into v_other_building, v_other_todo
    from hg_plans
   where item_id = new.item_id
     and id <> new.id;

  if v_other_building then
    return null;
  end if;

  if v_other_todo then
    update hg_items
       set status = 'ready',
           waiting_on = null,
           next_step = null,
           next_prompt = null,
           updated_by = coalesce(auth.uid(), updated_by)
     where id = new.item_id;
    return null;
  end if;

  select owner into v_waiting_on
    from hg_actions
   where item_id = new.item_id
     and done_at is null
   order by created_at, id
   limit 1;
  if found then
    update hg_items
       set status = 'waiting',
           waiting_on = v_waiting_on,
           next_step = null,
           next_prompt = null,
           updated_by = coalesce(auth.uid(), updated_by)
     where id = new.item_id;
    return null;
  end if;

  select asked_to into v_waiting_on
    from hg_questions
   where item_id = new.item_id
     and answer is null
   order by created_at, id
   limit 1;
  if found then
    update hg_items
       set status = 'waiting',
           waiting_on = v_waiting_on,
           next_step = null,
           next_prompt = null,
           updated_by = coalesce(auth.uid(), updated_by)
     where id = new.item_id;
    return null;
  end if;

  update hg_items
     set status = 'done',
         waiting_on = null,
         next_step = null,
         next_prompt = null,
         updated_by = coalesce(auth.uid(), updated_by)
   where id = new.item_id;
  return null;
end;
$$;
