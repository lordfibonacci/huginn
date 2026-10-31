-- 0002_hg_rls_hardening: composite parent FKs, participant trust, own read marks,
-- project policies and function grants. Touches only hg_ objects.

-- 1. Parents expose (id, project_id) so children can reference both
alter table hg_packages add constraint hg_packages_id_project_key unique (id, project_id);
alter table hg_modules add constraint hg_modules_id_project_key unique (id, project_id);
alter table hg_items add constraint hg_items_id_project_key unique (id, project_id);
alter table hg_plans add constraint hg_plans_id_project_key unique (id, project_id);

-- Replace single column parent FKs with composite FKs on (parent_id, project_id).
-- A child can no longer point at a parent in another project.
alter table hg_modules drop constraint hg_modules_package_id_fkey;
alter table hg_modules add constraint hg_modules_package_id_fkey
  foreign key (package_id, project_id) references hg_packages (id, project_id)
  on delete set null (package_id);

alter table hg_items drop constraint hg_items_module_id_fkey;
alter table hg_items add constraint hg_items_module_id_fkey
  foreign key (module_id, project_id) references hg_modules (id, project_id)
  on delete set null (module_id);

alter table hg_plans drop constraint hg_plans_item_id_fkey;
alter table hg_plans add constraint hg_plans_item_id_fkey
  foreign key (item_id, project_id) references hg_items (id, project_id)
  on delete cascade;

alter table hg_files drop constraint hg_files_item_id_fkey;
alter table hg_files add constraint hg_files_item_id_fkey
  foreign key (item_id, project_id) references hg_items (id, project_id)
  on delete cascade;

alter table hg_questions drop constraint hg_questions_item_id_fkey;
alter table hg_questions add constraint hg_questions_item_id_fkey
  foreign key (item_id, project_id) references hg_items (id, project_id)
  on delete cascade;

alter table hg_actions drop constraint hg_actions_item_id_fkey;
alter table hg_actions add constraint hg_actions_item_id_fkey
  foreign key (item_id, project_id) references hg_items (id, project_id)
  on delete cascade;

alter table hg_rulings drop constraint hg_rulings_plan_id_fkey;
alter table hg_rulings add constraint hg_rulings_plan_id_fkey
  foreign key (plan_id, project_id) references hg_plans (id, project_id)
  on delete cascade;

alter table hg_comments drop constraint hg_comments_item_id_fkey;
alter table hg_comments add constraint hg_comments_item_id_fkey
  foreign key (item_id, project_id) references hg_items (id, project_id)
  on delete cascade;

alter table hg_comments drop constraint hg_comments_module_id_fkey;
alter table hg_comments add constraint hg_comments_module_id_fkey
  foreign key (module_id, project_id) references hg_modules (id, project_id)
  on delete cascade;

alter table hg_reads drop constraint hg_reads_item_id_fkey;
alter table hg_reads add constraint hg_reads_item_id_fkey
  foreign key (item_id, project_id) references hg_items (id, project_id)
  on delete cascade;

-- 2. Participants: no self promotion to service, only name fields editable,
-- at most one service participant per project
drop policy hg_participants_insert on hg_participants;
create policy hg_participants_insert on hg_participants for insert to authenticated
  with check (hg_is_participant(project_id) and is_service = false);

revoke update on hg_participants from authenticated;
grant update (display_name, short) on hg_participants to authenticated;

create unique index hg_participants_one_service on hg_participants (project_id) where is_service;

-- 3. Read marks: anyone in the project can see them, only the owner writes them
drop policy hg_reads_insert on hg_reads;
drop policy hg_reads_update on hg_reads;
drop policy hg_reads_delete on hg_reads;

create policy hg_reads_insert on hg_reads for insert to authenticated
  with check (hg_is_participant(project_id) and user_id = auth.uid());
create policy hg_reads_update on hg_reads for update to authenticated
  using (hg_is_participant(project_id) and user_id = auth.uid())
  with check (hg_is_participant(project_id) and user_id = auth.uid());
create policy hg_reads_delete on hg_reads for delete to authenticated
  using (hg_is_participant(project_id) and user_id = auth.uid());

-- 4. Projects: no web insert, no web delete (service role only)
drop policy hg_projects_insert on hg_projects;
drop policy hg_projects_delete on hg_projects;

-- 5. Function grants
revoke execute on function hg_is_participant(uuid) from public, anon;
grant execute on function hg_is_participant(uuid) to authenticated;
revoke execute on function hg_service_user(uuid) from public, anon;
