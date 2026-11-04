// Types mirror supabase/migrations/0001_hg_schema.sql. Timestamps and uuids are strings.
// created_at columns have a default but no not null, so they are nullable.

export type ItemStatus = 'new' | 'waiting' | 'ready' | 'building' | 'parked' | 'done' | 'dropped'
export type PlanStatus = 'todo' | 'building' | 'done'

export type Project = {
  id: string
  created_at: string | null
  slug: string
  name: string
  repo_path: string | null
  context_bundle: string | null
  context_bundle_at: string | null
}

export type Participant = {
  id: string
  created_at: string | null
  project_id: string
  user_id: string
  display_name: string
  short: string
  is_service: boolean
}

export type Package = {
  id: string
  created_at: string | null
  project_id: string
  name: string
  position: number
  pos_x: number
  pos_y: number
}

export type Module = {
  id: string
  created_at: string | null
  project_id: string
  package_id: string | null
  slug: string
  name: string
  status_line: string | null
  color: string
  is_ghost: boolean
  position: number
}

export type Item = {
  id: string
  created_at: string | null
  project_id: string
  module_id: string | null
  title: string
  summary: string | null
  body: string | null
  status: ItemStatus
  waiting_on: string | null
  tags: string[]
  keywords: string[]
  pos_x: number
  pos_y: number
  source_ref: string | null
  next_step: string | null
  next_prompt: string | null
  created_by: string
  updated_by: string | null
  updated_at: string
  closed_at: string | null
}

export type Plan = {
  id: string
  created_at: string | null
  project_id: string
  item_id: string
  name: string
  path: string | null
  status: PlanStatus
  position: number
  updated_at: string
}

export type FileRow = {
  id: string
  created_at: string | null
  project_id: string
  item_id: string
  name: string
  storage_path: string
  size: number
  mime: string | null
  repo_path: string | null
  note: string | null
  uploaded_by: string
  updated_at: string | null
  updated_by: string | null
}

export type Question = {
  id: string
  created_at: string | null
  project_id: string
  item_id: string
  body: string
  asked_by: string
  asked_to: string | null
  answer: string | null
  answered_by: string | null
  answered_at: string | null
}

export type Action = {
  id: string
  created_at: string | null
  project_id: string
  item_id: string
  body: string
  owner: string
  created_by: string | null
  payload: string | null
  done_at: string | null
  done_by: string | null
  updated_at: string | null
  updated_by: string | null
  cancelled: boolean
  cancel_reason: string | null
}

export type Ruling = {
  id: string
  created_at: string | null
  project_id: string
  plan_id: string
  code: string
  body: string
  cost: string | null
  reversed: boolean
}

export type Comment = {
  id: string
  created_at: string | null
  project_id: string
  item_id: string | null
  module_id: string | null
  body: string
  user_id: string
}

export type Event = {
  id: string
  created_at: string | null
  project_id: string
  item_id: string | null
  module_id: string | null
  actor: string | null
  kind: string
  data: Record<string, unknown>
}

// Composite primary key (item_id, user_id), no own id.
export type Read = {
  project_id: string
  item_id: string
  user_id: string
  read_at: string
}

// One row of the hg_unread rpc: unread events of one kind on one item.
export type UnreadRow = { item_id: string; kind: string; n: number; latest: string }

// A saved shared view: a filter plus its own card positions (hg_views).
export type ViewFilterJson = { tones?: string[]; packages?: string[]; tags?: string[] }

export type View = {
  id: string
  created_at: string | null
  project_id: string
  name: string
  filter: ViewFilterJson
  position: number
  created_by: string | null
}

// One tag of the project's fixed list (hg_tags). Items carry names, not ids.
export type Tag = {
  id: string
  created_at: string | null
  project_id: string
  name: string
  created_by: string | null
}

// Where one item sits inside one view (hg_view_positions).
export type ViewPosition = {
  project_id: string
  view_id: string
  item_id: string
  pos_x: number
  pos_y: number
}

// Where one pack column sits inside one view (hg_view_pack_positions).
export type ViewPackPosition = {
  project_id: string
  view_id: string
  package_id: string
  pos_x: number
  pos_y: number
}

export type BoardData = {
  project: Project
  participants: Participant[]
  packages: Package[]
  modules: Module[]
  items: Item[]
  plans: Plan[]
  files: FileRow[]
  questions: Question[]
  actions: Action[]
  rulings: Ruling[]
  comments: Comment[]
  events: Event[]
  reads: Read[]
  unread: UnreadRow[]
  views: View[]
  tags: Tag[]
  viewPositions: ViewPosition[]
  viewPackPositions: ViewPackPosition[]
}
