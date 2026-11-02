-- 0013_hg_view_pack_positions
-- Pack column positions per view, the same rule as hg_view_positions for
-- cards (0011): a pack dragged inside a view moves only in that view, a
-- pack without a row in the view rests at hg_packages.pos_x and pos_y.
-- Composite keys as in 0011b, so the view and the package are in the row's
-- own project. hg_packages has hg_packages_id_project_key from 0002.

create table hg_view_pack_positions (
  project_id uuid not null references hg_projects(id) on delete cascade,
  view_id uuid not null references hg_views(id) on delete cascade,
  package_id uuid not null references hg_packages(id) on delete cascade,
  pos_x int not null,
  pos_y int not null,
  primary key (view_id, package_id),
  constraint hg_view_pack_positions_view_project_fk
    foreign key (view_id, project_id) references hg_views (id, project_id) on delete cascade,
  constraint hg_view_pack_positions_package_project_fk
    foreign key (package_id, project_id) references hg_packages (id, project_id) on delete cascade
);

create index hg_view_pack_positions_project_idx on hg_view_pack_positions (project_id);
create index hg_view_pack_positions_package_idx on hg_view_pack_positions (package_id);

alter table hg_view_pack_positions enable row level security;

create policy hg_view_pack_positions_select on hg_view_pack_positions
  for select to authenticated using (hg_is_participant(project_id));
create policy hg_view_pack_positions_insert on hg_view_pack_positions
  for insert to authenticated with check (hg_is_participant(project_id));
create policy hg_view_pack_positions_update on hg_view_pack_positions
  for update to authenticated using (hg_is_participant(project_id)) with check (hg_is_participant(project_id));
create policy hg_view_pack_positions_delete on hg_view_pack_positions
  for delete to authenticated using (hg_is_participant(project_id));

alter publication supabase_realtime add table hg_view_pack_positions;
