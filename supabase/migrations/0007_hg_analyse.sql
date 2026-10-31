-- 0007_hg_analyse: quick analysis of new items. Two columns on hg_items, a
-- lock RPC and an event RPC for the hg-analyse edge function, and pg_net
-- triggers that call the function when an item is created with status new or
-- a file lands on an item that is still new. The function URL and the bearer
-- secret are read from Vault (names hg_analyse_url and hg_analyse_secret), so
-- neither is in the repo. Touches only hg_ objects. No drop, no delete.

-- 1. analysed_at is set when an analysis is written. analyse_lock_until is
-- the run lock, taken by hg_claim_analysis and cleared by the function.
alter table hg_items
  add column analysed_at timestamptz,
  add column analyse_lock_until timestamptz;

-- 2. updated_at on hg_items and hg_plans, as in 0004, with analyse_lock_until
-- added to the ignored columns. A lock only update, like a drag, keeps the old
-- updated_at and updated_by, so taking or releasing the lock marks nothing
-- unread and credits nobody as last mover.
create or replace function hg_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_table_name = 'hg_items'
     and to_jsonb(new) - 'pos_x' - 'pos_y' - 'updated_at' - 'updated_by' - 'analyse_lock_until'
       = to_jsonb(old) - 'pos_x' - 'pos_y' - 'updated_at' - 'updated_by' - 'analyse_lock_until' then
    new.updated_at := old.updated_at;
    new.updated_by := old.updated_by;
    return new;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- 3. The run lock. One atomic update takes the lock for 2 minutes when the
-- item is still new and not locked, and says whether it got it. Of two
-- concurrent calls the second waits on the row lock, then sees the lock taken
-- and updates nothing. Security invoker: RLS applies, the caller must be a
-- participant. The lock is released with a plain update of the column.
create or replace function hg_claim_analysis(p_item uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  update hg_items
     set analyse_lock_until = now() + interval '2 minutes'
   where id = p_item
     and status = 'new'
     and (analyse_lock_until is null or analyse_lock_until < now());
  return found;
end;
$$;

revoke execute on function hg_claim_analysis(uuid) from public, anon;
grant execute on function hg_claim_analysis(uuid) to authenticated;

-- 4. analysis.done and analysis.failed events. hg_events is written only by
-- security definer code, so the function logs through this RPC. Only the
-- service participant of the item's project may call it, and only for these
-- two kinds.
create or replace function hg_log_analysis(p_item uuid, p_kind text, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project uuid;
  v_module uuid;
begin
  select i.project_id, i.module_id into v_project, v_module
    from hg_items i
   where i.id = p_item;

  if not exists (
    select 1 from hg_participants
     where project_id = v_project
       and user_id = auth.uid()
       and is_service
  ) then
    raise exception 'Aðeins þjónustunotandi verkefnisins skráir greiningu'
      using errcode = '42501';
  end if;

  if p_kind is null or p_kind not in ('analysis.done', 'analysis.failed') then
    raise exception 'Óþekkt tegund greiningaratburðar: %', p_kind
      using errcode = '22023';
  end if;

  insert into hg_events (created_at, project_id, item_id, module_id, actor, kind, data)
  values (clock_timestamp(), v_project, p_item, v_module, auth.uid(), p_kind,
          coalesce(p_data, '{}'));
end;
$$;

revoke execute on function hg_log_analysis(uuid, text, jsonb) from public, anon;
grant execute on function hg_log_analysis(uuid, text, jsonb) to authenticated;

-- 5. Enqueue. After an insert on hg_items with status new, or on hg_files for
-- an item that is still new, pg_net posts { item_id } to hg-analyse with the
-- bearer secret. The call is asynchronous and returns at once. The 20 s
-- debounce lives in the edge function, so a spec and its files uploaded right
-- after the item give one analysis that sees them all, and the lock stops a
-- double run when several posts arrive. When either Vault secret is missing
-- nothing is sent, and an enqueue failure is only a warning, it never blocks
-- the insert.
create or replace function hg_enqueue_analyse()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
  v_item uuid;
begin
  if tg_table_name = 'hg_items' then
    if new.status is distinct from 'new' then
      return new;
    end if;
    v_item := new.id;
  elsif tg_table_name = 'hg_files' then
    if not exists (
      select 1 from hg_items
       where id = new.item_id
         and status = 'new'
    ) then
      return new;
    end if;
    v_item := new.item_id;
  else
    return new;
  end if;

  -- Vault and pg_net both sit inside the block, so a missing extension or
  -- secret view is a warning too.
  begin
    select decrypted_secret into v_url
      from vault.decrypted_secrets
     where name = 'hg_analyse_url';
    select decrypted_secret into v_secret
      from vault.decrypted_secrets
     where name = 'hg_analyse_secret';
    if v_url is null or v_secret is null then
      return new;
    end if;

    perform net.http_post(
      url := v_url,
      body := jsonb_build_object('item_id', v_item),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_secret
      ),
      timeout_milliseconds := 5000
    );
  exception when others then
    raise warning 'hg_enqueue_analyse: % (%)', sqlerrm, sqlstate;
  end;

  return new;
end;
$$;

revoke execute on function hg_enqueue_analyse() from public, anon, authenticated;

create trigger hg_items_analyse_trg
  after insert on hg_items
  for each row execute function hg_enqueue_analyse();

create trigger hg_files_analyse_trg
  after insert on hg_files
  for each row execute function hg_enqueue_analyse();
