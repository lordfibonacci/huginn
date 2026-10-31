-- 0006_hg_reads_clock_and_guards: read marks take the server clock, and
-- hg_add_participant checks the short name and turns a race on the unique
-- constraint into the Icelandic message. Touches only hg_ objects. No drop,
-- no delete.

-- 1. hg_reads.read_at is always the database time. isUnread compares it with
-- hg_items.updated_at, which the server stamps, so a device clock behind the
-- server would write a mark older than the change it has just seen and the
-- glow would never clear. The client no longer sends read_at. An upsert (insert
-- ... on conflict do update) fires the insert trigger and, on conflict, the
-- update trigger, so both paths are stamped.
create or replace function hg_reads_stamp()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.read_at := now();
  return new;
end;
$$;

create trigger hg_reads_stamp_trg
  before insert or update on hg_reads
  for each row execute function hg_reads_stamp();

-- 2. hg_add_participant: the short name is not empty, at most three characters
-- after trim, and not used by another participant of the project (compared
-- case insensitively, like validateShort in the settings page). Short name
-- errors use 22023 like the other input errors, so the client shows the
-- message as is. A unique violation on the insert (two people adding the same
-- user at once) returns the same Icelandic "already a participant" text as
-- the check before it.
create or replace function hg_add_participant(
  p_project uuid,
  p_email text,
  p_short text,
  p_name text
)
returns hg_participants
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_short text := btrim(coalesce(p_short, ''));
  v_row hg_participants;
begin
  if auth.uid() is null or not hg_is_participant(p_project) then
    raise exception 'Þú ert ekki þátttakandi í þessu verkefni.'
      using errcode = '42501';
  end if;

  if coalesce(btrim(p_email), '') = ''
     or v_short = ''
     or coalesce(btrim(p_name), '') = '' then
    raise exception 'Netfang, stutt nafn og nafn þurfa öll að vera fyllt út.'
      using errcode = '22023';
  end if;

  if char_length(v_short) > 3 then
    raise exception 'Stutt nafn má vera mest þrír stafir.'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from hg_participants
    where project_id = p_project
      and (btrim(short) = v_short or lower(btrim(short)) = lower(v_short))
  ) then
    raise exception 'Annar þátttakandi hefur þegar þetta stutta nafn.'
      using errcode = '22023';
  end if;

  select id into v_user
  from auth.users
  where lower(email) = lower(btrim(p_email))
  limit 1;

  if v_user is null then
    raise exception 'Notandi fannst ekki' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from hg_participants
    where project_id = p_project and user_id = v_user
  ) then
    raise exception 'Notandinn er þegar þátttakandi í verkefninu.'
      using errcode = '23505';
  end if;

  begin
    insert into hg_participants (project_id, user_id, display_name, short, is_service)
    values (p_project, v_user, btrim(p_name), v_short, false)
    returning * into v_row;
  exception when unique_violation then
    raise exception 'Notandinn er þegar þátttakandi í verkefninu.'
      using errcode = '23505';
  end;

  return v_row;
end;
$$;

revoke execute on function hg_add_participant(uuid, text, text, text) from public, anon;
grant execute on function hg_add_participant(uuid, text, text, text) to authenticated;
