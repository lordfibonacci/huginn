-- 0011_hg_views
-- Saved board views (spec 2026-11-01-olesid-og-synir-design.md, 5.1). A view is
-- a filter (tones, packages, tags as json, empty means all) and its own card
-- positions. Views are shared by the project's participants; which view a
-- person looks at is kept in their browser. No hg_events for views.

create table hg_views (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  project_id uuid not null references hg_projects(id) on delete cascade,
  name text not null,
  filter jsonb not null default '{}',
  position int not null default 0,
  created_by uuid
);

create table hg_view_positions (
  project_id uuid not null references hg_projects(id) on delete cascade,
  view_id uuid not null references hg_views(id) on delete cascade,
  item_id uuid not null references hg_items(id) on delete cascade,
  pos_x int not null,
  pos_y int not null,
  primary key (view_id, item_id)
);

create index hg_views_project_idx on hg_views (project_id);
create index hg_view_positions_project_idx on hg_view_positions (project_id);
create index hg_view_positions_item_idx on hg_view_positions (item_id);

alter table hg_views enable row level security;
alter table hg_view_positions enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['hg_views', 'hg_view_positions'] loop
    execute format(
      'create policy %I on %I for select to authenticated using (hg_is_participant(project_id))',
      t || '_select', t);
    execute format(
      'create policy %I on %I for insert to authenticated with check (hg_is_participant(project_id))',
      t || '_insert', t);
    execute format(
      'create policy %I on %I for update to authenticated using (hg_is_participant(project_id)) with check (hg_is_participant(project_id))',
      t || '_update', t);
    execute format(
      'create policy %I on %I for delete to authenticated using (hg_is_participant(project_id))',
      t || '_delete', t);
  end loop;
end
$$;

-- created_by is the signed in user, kept on update
create or replace function hg_views_stamp()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
  else
    new.created_by := old.created_by;
  end if;
  return new;
end;
$$;

create trigger hg_views_stamp_trg
  before insert or update on hg_views
  for each row execute function hg_views_stamp();

alter publication supabase_realtime add table hg_views, hg_view_positions;
