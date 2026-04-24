export type ThoughtSource = 'text' | 'voice'
export type ThoughtStatus = 'inbox' | 'filed' | 'archived'
export type ThoughtType = 'idea' | 'task' | 'note'
export type ThoughtPriority = 'low' | 'medium' | 'high'
export type ProjectStatus = 'idea' | 'active' | 'hold' | 'done'
export type TaskStatus = 'todo' | 'doing' | 'done'

export interface Thought {
  id: string
  user_id: string
  body: string
  source: ThoughtSource
  audio_url: string | null
  status: ThoughtStatus
  type: ThoughtType | null
  tags: string[]
  priority: ThoughtPriority | null
  due_date: string | null
  project_id: string | null
  created_at: string
}

export interface Project {
  id: string
  user_id: string
  name: string
  description: string | null
  color: string
  status: ProjectStatus
  pinned: boolean
  background: string
  position: number
  created_at: string
}

export interface Task {
  id: string
  user_id: string
  project_id: string | null
  list_id: string | null
  title: string
  notes: string | null
  status: TaskStatus
  priority: ThoughtPriority | null
  position: number
  from_thought_id: string | null
  start_date: string | null
  due_date: string | null
  recurring: 'never' | 'daily' | 'weekly' | 'monthly' | 'yearly' | null
  archived: boolean
  starred: boolean
  created_at: string
  updated_at: string
}

export interface List {
  id: string
  project_id: string
  user_id: string
  name: string
  position: number
  archived: boolean
  created_at: string
}

export interface Checklist {
  id: string
  task_id: string
  user_id: string
  name: string
  position: number
  created_at: string
}

export interface Comment {
  id: string
  task_id: string
  user_id: string
  body: string
  created_at: string
}

export interface Activity {
  id: string
  task_id: string
  user_id: string
  action: string
  details: Record<string, unknown> | null
  created_at: string
}

export interface ChecklistItem {
  id: string
  task_id: string
  checklist_id: string | null
  user_id: string
  text: string
  checked: boolean
  position: number
  created_at: string
}

export interface Attachment {
  id: string
  task_id: string
  user_id: string
  name: string
  url: string
  type: string
  size: number | null
  is_cover: boolean
  created_at: string
}

export interface Label {
  id: string
  project_id: string
  user_id: string
  name: string
  color: string
  created_at: string
}

export interface TaskLabel {
  id: string
  task_id: string
  label_id: string
}

export interface BoardMember {
  id: string
  project_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
  status: 'pending' | 'active'
  invited_by: string | null
  created_at: string
}

export interface TaskMember {
  id: string
  task_id: string
  user_id: string
  created_at: string
}

export interface Profile {
  id: string
  display_name: string | null
  email: string | null
  avatar_url: string | null
  locale: string | null
  updated_at: string
}

export interface Note {
  id: string
  user_id: string
  project_id: string
  title: string | null
  body: string
  from_thought_id: string | null
  created_at: string
}

export interface Mention {
  id: string
  task_id: string
  comment_id: string | null
  mentioned_user_id: string
  mentioner_id: string
  created_at: string
}

export interface CardView {
  task_id: string
  user_id: string
  viewed_at: string
}

export interface BoardRune {
  project_id: string
  rune_id: string
  enabled: boolean
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}
