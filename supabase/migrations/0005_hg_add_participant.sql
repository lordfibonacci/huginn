-- 0005_hg_add_participant: a participant adds another user to the project by
-- email. auth.users is not readable from the web, so the lookup runs in a
-- security definer function. Only a participant of the project may call it,
-- and the new row is never a service participant. Touches only hg_ objects.
-- No drop, no delete.

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
  v_row hg_participants;
begin
  if auth.uid() is null or not hg_is_participant(p_project) then
    raise exception 'Þú ert ekki þátttakandi í þessu verkefni.'
      using errcode = '42501';
  end if;

  if coalesce(btrim(p_email), '') = ''
     or coalesce(btrim(p_short), '') = ''
     or coalesce(btrim(p_name), '') = '' then
    raise exception 'Netfang, stutt nafn og nafn þurfa öll að vera fyllt út.'
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

  insert into hg_participants (project_id, user_id, display_name, short, is_service)
  values (p_project, v_user, btrim(p_name), btrim(p_short), false)
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function hg_add_participant(uuid, text, text, text) from public, anon;
grant execute on function hg_add_participant(uuid, text, text, text) to authenticated;
