-- 0008_hg_plan_moves_item
-- A plan that moves moves its item (spec 2026-11-01-stada-ur-gognum-design.md, 4.1).
-- Rules, in order: a plan entering building puts the item in building; a plan
-- entering done leaves the item alone while another plan is building, puts it
-- in ready while another plan is todo, otherwise the item waits on the owner
-- of the oldest open action, else on the recipient of the oldest unanswered
-- question, else it is done. Items in done or dropped are never touched. A
-- plan inserted directly as building or done counts as that transition.

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
           updated_by = coalesce(auth.uid(), updated_by)
     where id = new.item_id;
    return null;
  end if;

  update hg_items
     set status = 'done',
         waiting_on = null,
         updated_by = coalesce(auth.uid(), updated_by)
   where id = new.item_id;
  return null;
end;
$$;

create trigger hg_plans_move_item_trg
after insert or update of status on hg_plans
for each row execute function hg_plan_moves_item();
