-- 0001_hg_schema: Huginn vinnubord schema, RLS, indexes, realtime.
-- All objects are prefixed hg_. The project is shared, touch nothing else.

-- Projects (created via MCP or service role, no web insert path)
create table hg_projects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  slug text unique not null,
  name text not null,
  repo_path text,
  context_bundle text,
  context_bundle_at timestamptz
);

create table hg_participants (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  project_id uuid not null references hg_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  display_name text not null,
  short text not null,
  is_service boolean not null default false,
  unique (project_id, user_id)
);

-- Helper functions (after hg_participants, which they query)
create function hg_is_participant(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from hg_participants
    where project_id = p_project
      and user_id = auth.uid()
  );
$$;

create function hg_service_user(p_project uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select user_id from hg_participants
  where project_id = p_project
    and is_service = true
  limit 1;
$$;

create table hg_packages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  project_id uuid not null references hg_projects(id) on delete cascade,
  name text not null,
  position int not null default 0,
  pos_x int not null default 0,
  pos_y int not null default 0
);

create table hg_modules (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  project_id uuid not null references hg_projects(id) on delete cascade,
  package_id uuid references hg_packages(id) on delete set null,
  slug text not null,
  name text not null,
  status_line text,
  color text not null default 'stone',
  is_ghost boolean not null default false,
  position int not null default 0,
  unique (project_id, slug)
);

create table hg_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  project_id uuid not null references hg_projects(id) on delete cascade,
  module_id uuid references hg_modules(id) on delete set null,
  title text not null,
  summary text,
  body text,
  status text not null default 'new'
    check (status in ('new','waiting','ready','building','parked','done','dropped')),
  waiting_on uuid references auth.users(id),
  tags text[] not null default '{}',
  pos_x int not null default 0,
  pos_y int not null default 0,
  source_ref text,
  next_step text,
  next_prompt text,
  created_by uuid not null,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create table hg_plans (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  project_id uuid not null references hg_projects(id) on delete cascade,
  item_id uuid not null references hg_items(id) on delete cascade,
  name text not null,
  path text,
  status text not null default 'todo'
    check (status in ('todo','building','done')),
  position int not null default 0,
  updated_at timestamptz not null default now()
);

create table hg_files (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  project_id uuid not null references hg_projects(id) on delete cascade,
  item_id uuid not null references hg_items(id) on delete cascade,
  name text not null,
  storage_path text not null,
  size bigint not null,
  mime text,
  repo_path text,
  uploaded_by uuid not null
);

create table hg_questions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  project_id uuid not null references hg_projects(id) on delete cascade,
  item_id uuid not null references hg_items(id) on delete cascade,
  body text not null,
  asked_by uuid not null,
  asked_to uuid,
  answer text,
  answered_by uuid,
  answered_at timestamptz
);

create table hg_actions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  project_id uuid not null references hg_projects(id) on delete cascade,
  item_id uuid not null references hg_items(id) on delete cascade,
  body text not null,
  owner uuid not null,
  payload text,
  done_at timestamptz,
  done_by uuid
);

create table hg_rulings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  project_id uuid not null references hg_projects(id) on delete cascade,
  plan_id uuid not null references hg_plans(id) on delete cascade,
  code text not null,
  body text not null,
  cost text,
  reversed boolean not null default false
);

create table hg_comments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  project_id uuid not null references hg_projects(id) on delete cascade,
  item_id uuid references hg_items(id) on delete cascade,
  module_id uuid references hg_modules(id) on delete cascade,
  body text not null,
  user_id uuid not null,
  check (item_id is not null or module_id is not null)
);

-- Written only by security definer triggers (Task 2)
create table hg_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  project_id uuid not null references hg_projects(id) on delete cascade,
  item_id uuid references hg_items(id) on delete cascade,
  module_id uuid,
  actor uuid,
  kind text not null,
  data jsonb not null default '{}'
);

-- No own id, composite primary key
create table hg_reads (
  project_id uuid not null references hg_projects(id) on delete cascade,
  item_id uuid not null references hg_items(id) on delete cascade,
  user_id uuid not null,
  read_at timestamptz not null default now(),
  primary key (item_id, user_id)
);

-- Indexes
create index hg_participants_project_idx on hg_participants (project_id);
create index hg_packages_project_idx on hg_packages (project_id);
create index hg_modules_project_idx on hg_modules (project_id);
create index hg_modules_package_idx on hg_modules (package_id);
create index hg_items_project_idx on hg_items (project_id);
create index hg_items_project_status_idx on hg_items (project_id, status);
create index hg_items_module_idx on hg_items (module_id);
create index hg_plans_project_idx on hg_plans (project_id);
create index hg_plans_item_idx on hg_plans (item_id);
create index hg_files_project_idx on hg_files (project_id);
create index hg_files_item_idx on hg_files (item_id);
create index hg_questions_project_idx on hg_questions (project_id);
create index hg_questions_item_idx on hg_questions (item_id);
create index hg_actions_project_idx on hg_actions (project_id);
create index hg_actions_item_idx on hg_actions (item_id);
create index hg_rulings_project_idx on hg_rulings (project_id);
create index hg_rulings_plan_idx on hg_rulings (plan_id);
create index hg_comments_project_idx on hg_comments (project_id);
create index hg_comments_item_idx on hg_comments (item_id);
create index hg_comments_module_idx on hg_comments (module_id);
create index hg_events_project_idx on hg_events (project_id);
create index hg_events_item_idx on hg_events (item_id);
create index hg_reads_project_idx on hg_reads (project_id);
create index hg_reads_item_idx on hg_reads (item_id);

-- RLS
alter table hg_projects enable row level security;
alter table hg_participants enable row level security;
alter table hg_packages enable row level security;
alter table hg_modules enable row level security;
alter table hg_items enable row level security;
alter table hg_plans enable row level security;
alter table hg_files enable row level security;
alter table hg_questions enable row level security;
alter table hg_actions enable row level security;
alter table hg_rulings enable row level security;
alter table hg_comments enable row level security;
alter table hg_events enable row level security;
alter table hg_reads enable row level security;

-- hg_projects: keyed on its own id
create policy hg_projects_select on hg_projects for select to authenticated
  using (hg_is_participant(id));
create policy hg_projects_insert on hg_projects for insert to authenticated
  with check (hg_is_participant(id));
create policy hg_projects_update on hg_projects for update to authenticated
  using (hg_is_participant(id)) with check (hg_is_participant(id));
create policy hg_projects_delete on hg_projects for delete to authenticated
  using (hg_is_participant(id));

-- hg_events: select only, writes come from security definer triggers
create policy hg_events_select on hg_events for select to authenticated
  using (hg_is_participant(project_id));

-- All other tables: four policies on project_id
do $$
declare
  t text;
begin
  foreach t in array array[
    'hg_participants', 'hg_packages', 'hg_modules', 'hg_items', 'hg_plans',
    'hg_files', 'hg_questions', 'hg_actions', 'hg_rulings', 'hg_comments',
    'hg_reads'
  ] loop
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

-- Realtime
alter publication supabase_realtime add table
  hg_items, hg_plans, hg_files, hg_questions, hg_actions, hg_rulings,
  hg_comments, hg_events, hg_reads, hg_modules, hg_packages;
