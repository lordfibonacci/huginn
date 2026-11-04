-- 0017_hg_zones
-- Boxes on the whiteboard (spec 2026-11-04-kassar-og-tiltekt-design.md, 4.1):
-- a named, coloured rectangle with an optional note, shared by the project's
-- participants, with its own position per view like cards (0011) and pack
-- columns (0013). The size is shared, the position is per view. No events,
-- no updated_at: a box is board arrangement, not a work item, like a view.
-- Composite project keys as in 0011b.

create table hg_zones (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  project_id uuid not null references hg_projects(id) on delete cascade,
  title text not null,
  color text not null default 'lilac',
  note text,
  pos_x int not null,
  pos_y int not null,
  w int not null,
  h int not null,
  created_by uuid,
  constraint hg_zones_title_check check (btrim(title) <> '' and char_length(title) <= 60),
  constraint hg_zones_color_check check (color in ('gold', 'lilac', 'coral', 'teal', 'stone')),
  constraint hg_zones_note_check check (note is null or char_length(note) <= 200),
  constraint hg_zones_size_check check (w >= 160 and h >= 120),
  constraint hg_zones_id_project_key unique (id, project_id)
);

create index hg_zones_project_idx on hg_zones (project_id);

create table hg_view_zone_positions (
  project_id uuid not null references hg_projects(id) on delete cascade,
  view_id uuid not null references hg_views(id) on delete cascade,
  zone_id uuid not null references hg_zones(id) on delete cascade,
  pos_x int not null,
  pos_y int not null,
  primary key (view_id, zone_id),
  constraint hg_view_zone_positions_view_project_fk
    foreign key (view_id, project_id) references hg_views (id, project_id) on delete cascade,
  constraint hg_view_zone_positions_zone_project_fk
    foreign key (zone_id, project_id) references hg_zones (id, project_id) on delete cascade
);

create index hg_view_zone_positions_project_idx on hg_view_zone_positions (project_id);
create index hg_view_zone_positions_zone_idx on hg_view_zone_positions (zone_id);

alter table hg_zones enable row level security;
alter table hg_view_zone_positions enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['hg_zones', 'hg_view_zone_positions'] loop
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

-- created_by from auth.uid(), kept on update (same rule as hg_views and hg_tags)
create trigger hg_zones_stamp_trg
  before insert or update on hg_zones
  for each row execute function hg_views_stamp();

alter publication supabase_realtime add table hg_zones, hg_view_zone_positions;
