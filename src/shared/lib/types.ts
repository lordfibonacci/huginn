export type ThoughtSource = 'text' | 'voice'
export type ThoughtStatus = 'inbox' | 'filed' | 'archived'
export type ThoughtType = 'idea' | 'task' | 'note'
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
  created_at: string
}

export interface Task {
  id: string
  user_id: string
  project_id: string
  title: string
  notes: string | null
  status: TaskStatus
  from_thought_id: string | null
  due_date: string | null
  created_at: string
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
