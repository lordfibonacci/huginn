# Project Detail Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full project detail page with three tabs (Thoughts, Tasks, Notes), kanban task view, note management, and project settings editing.

**Architecture:** Tabbed project detail page. Tasks use a responsive kanban (desktop) / grouped list (mobile) layout designed for future dnd-kit integration. Notes use a simple list. Thoughts tab reuses existing inbox components. Project settings in a drawer. All CRUD follows the optimistic-update-with-rollback pattern established in useThoughts.

**Tech Stack:** React, TypeScript, Tailwind CSS, Supabase JS, React Router

---

## Task 0: Extract shared date helpers

**Files:**
- Create: `src/shared/lib/dateUtils.ts`
- Modify: `src/features/inbox/components/ThoughtCard.tsx`

- [ ] **Step 1: Create dateUtils.ts**

Create `src/shared/lib/dateUtils.ts`:

```ts
export function timeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function formatDueDate(dateString: string): { text: string; urgent: boolean } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dateString + 'T00:00:00')
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return { text: `${Math.abs(diffDays)}d overdue`, urgent: true }
  if (diffDays === 0) return { text: 'due today', urgent: true }
  if (diffDays === 1) return { text: 'due tomorrow', urgent: false }
  if (diffDays <= 7) return { text: `due in ${diffDays}d`, urgent: false }

  const month = due.toLocaleString('en', { month: 'short' })
  return { text: `due ${month} ${due.getDate()}`, urgent: false }
}
```

- [ ] **Step 2: Update ThoughtCard to use shared helpers**

In `src/features/inbox/components/ThoughtCard.tsx`:
- Remove the `timeAgo` and `formatDueDate` function definitions (lines 3-25 approximately)
- Add import at top: `import { timeAgo, formatDueDate } from '../../../shared/lib/dateUtils'`
- Rest of the file stays the same

- [ ] **Step 3: Verify build + commit**

```bash
cd c:/Dropbox/Huginn/huginn && npx vite build
git add src/shared/lib/dateUtils.ts src/features/inbox/components/ThoughtCard.tsx
git commit -m "refactor: extract timeAgo and formatDueDate to shared dateUtils"
```

---

## Task 1: Create useProjectTasks and useProjectNotes hooks

**Files:**
- Create: `src/features/projects/hooks/useProjectTasks.ts`
- Create: `src/features/projects/hooks/useProjectNotes.ts`

- [ ] **Step 1: Create useProjectTasks**

Create `src/features/projects/hooks/useProjectTasks.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import type { Task, TaskStatus } from '../../../shared/lib/types'

export function useProjectTasks(projectId: string) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from('huginn_tasks')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch tasks:', error)
      return
    }
    setTasks(data as Task[])
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  async function addTask(title: string): Promise<Task | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const optimistic: Task = {
      id: crypto.randomUUID(),
      user_id: user.id,
      project_id: projectId,
      title,
      notes: null,
      status: 'todo',
      from_thought_id: null,
      due_date: null,
      created_at: new Date().toISOString(),
    }

    setTasks((prev) => [optimistic, ...prev])

    const { data, error } = await supabase
      .from('huginn_tasks')
      .insert({ title, status: 'todo', project_id: projectId, user_id: user.id })
      .select()
      .single()

    if (error) {
      console.error('Failed to add task:', error)
      setTasks((prev) => prev.filter((t) => t.id !== optimistic.id))
      return null
    }

    setTasks((prev) => prev.map((t) => (t.id === optimistic.id ? (data as Task) : t)))
    return data as Task
  }

  async function updateTask(
    taskId: string,
    updates: { title?: string; notes?: string | null; status?: TaskStatus; due_date?: string | null }
  ) {
    const prev = tasks
    setTasks((t) => t.map((tk) => (tk.id === taskId ? { ...tk, ...updates } : tk)))

    const { error } = await supabase
      .from('huginn_tasks')
      .update(updates)
      .eq('id', taskId)

    if (error) {
      console.error('Failed to update task:', error)
      setTasks(prev)
      return false
    }
    return true
  }

  async function deleteTask(taskId: string) {
    const prev = tasks
    setTasks((t) => t.filter((tk) => tk.id !== taskId))

    const { error } = await supabase
      .from('huginn_tasks')
      .delete()
      .eq('id', taskId)

    if (error) {
      console.error('Failed to delete task:', error)
      setTasks(prev)
      return false
    }
    return true
  }

  return { tasks, loading, addTask, updateTask, deleteTask }
}
```

- [ ] **Step 2: Create useProjectNotes**

Create `src/features/projects/hooks/useProjectNotes.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import type { Note } from '../../../shared/lib/types'

export function useProjectNotes(projectId: string) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)

  const fetchNotes = useCallback(async () => {
    const { data, error } = await supabase
      .from('huginn_notes')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch notes:', error)
      return
    }
    setNotes(data as Note[])
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  async function addNote(title: string | null, body: string): Promise<Note | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const optimistic: Note = {
      id: crypto.randomUUID(),
      user_id: user.id,
      project_id: projectId,
      title: title || null,
      body,
      from_thought_id: null,
      created_at: new Date().toISOString(),
    }

    setNotes((prev) => [optimistic, ...prev])

    const { data, error } = await supabase
      .from('huginn_notes')
      .insert({ title: title || null, body, project_id: projectId, user_id: user.id })
      .select()
      .single()

    if (error) {
      console.error('Failed to add note:', error)
      setNotes((prev) => prev.filter((n) => n.id !== optimistic.id))
      return null
    }

    setNotes((prev) => prev.map((n) => (n.id === optimistic.id ? (data as Note) : n)))
    return data as Note
  }

  async function updateNote(
    noteId: string,
    updates: { title?: string | null; body?: string }
  ) {
    const prev = notes
    setNotes((n) => n.map((nt) => (nt.id === noteId ? { ...nt, ...updates } : nt)))

    const { error } = await supabase
      .from('huginn_notes')
      .update(updates)
      .eq('id', noteId)

    if (error) {
      console.error('Failed to update note:', error)
      setNotes(prev)
      return false
    }
    return true
  }

  async function deleteNote(noteId: string) {
    const prev = notes
    setNotes((n) => n.filter((nt) => nt.id !== noteId))

    const { error } = await supabase
      .from('huginn_notes')
      .delete()
      .eq('id', noteId)

    if (error) {
      console.error('Failed to delete note:', error)
      setNotes(prev)
      return false
    }
    return true
  }

  return { notes, loading, addNote, updateNote, deleteNote }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/projects/hooks/useProjectTasks.ts src/features/projects/hooks/useProjectNotes.ts
git commit -m "feat: add useProjectTasks and useProjectNotes hooks"
```

---

## Task 2: Expand useProjects + create ProjectTabs

**Files:**
- Modify: `src/features/projects/hooks/useProjects.ts`
- Create: `src/features/projects/components/ProjectTabs.tsx`

- [ ] **Step 1: Add updateProject and deleteProject to useProjects**

Add these two functions after `addProject` in `src/features/projects/hooks/useProjects.ts`, before the return:

```ts
  async function updateProject(
    projectId: string,
    updates: { name?: string; description?: string | null; color?: string; status?: ProjectStatus }
  ) {
    const prev = projects
    setProjects((p) => p.map((pr) => (pr.id === projectId ? { ...pr, ...updates } : pr)))

    const { error } = await supabase
      .from('huginn_projects')
      .update(updates)
      .eq('id', projectId)

    if (error) {
      console.error('Failed to update project:', error)
      setProjects(prev)
      return false
    }
    return true
  }

  async function deleteProject(projectId: string) {
    const prev = projects
    setProjects((p) => p.filter((pr) => pr.id !== projectId))

    const { error } = await supabase
      .from('huginn_projects')
      .delete()
      .eq('id', projectId)

    if (error) {
      console.error('Failed to delete project:', error)
      setProjects(prev)
      return false
    }
    return true
  }
```

Update return to:
```ts
  return { projects, loading, addProject, updateProject, deleteProject, count: projects.length }
```

- [ ] **Step 2: Create ProjectTabs**

Create `src/features/projects/components/ProjectTabs.tsx`:

```tsx
type TabType = 'thoughts' | 'tasks' | 'notes'

interface ProjectTabsProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
}

const TABS: { value: TabType; label: string }[] = [
  { value: 'thoughts', label: 'Thoughts' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'notes', label: 'Notes' },
]

export function ProjectTabs({ activeTab, onTabChange }: ProjectTabsProps) {
  return (
    <div className="flex border-b border-[#2a2a4a]">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onTabChange(tab.value)}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            activeTab === tab.value
              ? 'text-white border-b-2 border-[#6c5ce7]'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/projects/hooks/useProjects.ts src/features/projects/components/ProjectTabs.tsx
git commit -m "feat: add updateProject/deleteProject and ProjectTabs component"
```

---

## Task 3: Create TaskCard and NoteCard

**Files:**
- Create: `src/features/projects/components/TaskCard.tsx`
- Create: `src/features/projects/components/NoteCard.tsx`

- [ ] **Step 1: Create TaskCard**

Create `src/features/projects/components/TaskCard.tsx`:

```tsx
import type { Task } from '../../../shared/lib/types'
import { formatDueDate } from '../../../shared/lib/dateUtils'

const STATUS_COLORS: Record<string, string> = {
  todo: 'bg-gray-500',
  doing: 'bg-[#6c5ce7]',
  done: 'bg-[#00b894]',
}

interface TaskCardProps {
  task: Task
  onClick?: () => void
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const dueInfo = task.due_date ? formatDueDate(task.due_date) : null

  return (
    <div
      className="bg-[#2a2a4a] rounded-xl p-3 mb-2 cursor-pointer active:bg-[#3a3a5a] transition-colors"
      onClick={onClick}
      data-task-id={task.id}
    >
      <div className="flex items-start gap-2">
        <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${STATUS_COLORS[task.status]}`} />
        <p className={`text-sm flex-1 ${task.status === 'done' ? 'text-gray-500 line-through' : 'text-gray-100'}`}>
          {task.title}
        </p>
      </div>
      {dueInfo && (
        <div className="mt-1.5 ml-4">
          <span className={`text-xs ${dueInfo.urgent ? 'text-[#e17055]' : 'text-gray-500'}`}>
            {dueInfo.text}
          </span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create NoteCard**

Create `src/features/projects/components/NoteCard.tsx`:

```tsx
import type { Note } from '../../../shared/lib/types'
import { timeAgo } from '../../../shared/lib/dateUtils'

interface NoteCardProps {
  note: Note
  onClick?: () => void
}

export function NoteCard({ note, onClick }: NoteCardProps) {
  const displayTitle = note.title || note.body.slice(0, 50) + (note.body.length > 50 ? '...' : '')

  return (
    <div
      className="bg-[#2a2a4a] rounded-xl p-3 mb-2 cursor-pointer active:bg-[#3a3a5a] transition-colors"
      onClick={onClick}
    >
      <p className="text-sm text-gray-100">{displayTitle}</p>
      <p className="text-xs text-gray-500 mt-1.5">{timeAgo(note.created_at)}</p>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/projects/components/TaskCard.tsx src/features/projects/components/NoteCard.tsx
git commit -m "feat: add TaskCard and NoteCard components"
```

---

## Task 4: Create TaskList (kanban desktop / grouped mobile)

**Files:**
- Create: `src/features/projects/components/TaskList.tsx`

- [ ] **Step 1: Create TaskList**

Create `src/features/projects/components/TaskList.tsx`:

```tsx
import { useState } from 'react'
import type { Task, TaskStatus } from '../../../shared/lib/types'
import { TaskCard } from './TaskCard'

interface TaskListProps {
  tasks: Task[]
  loading: boolean
  onTaskTap: (task: Task) => void
}

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: 'Todo' },
  { status: 'doing', label: 'Doing' },
  { status: 'done', label: 'Done' },
]

function KanbanView({ tasks, onTaskTap }: { tasks: Task[]; onTaskTap: (task: Task) => void }) {
  return (
    <div className="flex-1 flex gap-3 px-3 py-2 overflow-x-auto">
      {COLUMNS.map(({ status, label }) => {
        const columnTasks = tasks.filter((t) => t.status === status)
        return (
          <div
            key={status}
            className="flex-1 min-w-[200px] flex flex-col"
            data-status={status}
          >
            <div className="flex items-center gap-2 mb-2 px-1">
              <h3 className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{label}</h3>
              <span className="text-xs text-gray-600">{columnTasks.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {columnTasks.length === 0 ? (
                <p className="text-xs text-gray-600 px-1">No tasks</p>
              ) : (
                columnTasks.map((task) => (
                  <TaskCard key={task.id} task={task} onClick={() => onTaskTap(task)} />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function GroupedView({ tasks, onTaskTap }: { tasks: Task[]; onTaskTap: (task: Task) => void }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ done: true })

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2">
      {COLUMNS.map(({ status, label }) => {
        const columnTasks = tasks.filter((t) => t.status === status)
        const isCollapsed = collapsed[status] ?? false

        return (
          <div key={status} className="mb-3">
            <button
              onClick={() => setCollapsed((c) => ({ ...c, [status]: !isCollapsed }))}
              className="flex items-center gap-2 mb-2 px-1 w-full"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className={`w-3 h-3 text-gray-500 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
              >
                <path d="M6.3 2.8a.75.75 0 0 1 1.05.15L12 8.96l4.65-6.01a.75.75 0 1 1 1.2.9l-5.25 6.78a.75.75 0 0 1-1.2 0L6.15 3.85a.75.75 0 0 1 .15-1.05Z" />
              </svg>
              <h3 className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{label}</h3>
              <span className="text-xs text-gray-600">{columnTasks.length}</span>
            </button>
            {!isCollapsed &&
              columnTasks.map((task) => (
                <TaskCard key={task.id} task={task} onClick={() => onTaskTap(task)} />
              ))}
          </div>
        )
      })}
    </div>
  )
}

export function TaskList({ tasks, loading, onTaskTap }: TaskListProps) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500 text-sm">No tasks yet. Tap + to create one.</p>
      </div>
    )
  }

  return (
    <>
      <div className="hidden md:flex flex-1 min-h-0">
        <KanbanView tasks={tasks} onTaskTap={onTaskTap} />
      </div>
      <div className="md:hidden flex-1 min-h-0">
        <GroupedView tasks={tasks} onTaskTap={onTaskTap} />
      </div>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/projects/components/TaskList.tsx
git commit -m "feat: add TaskList with kanban desktop and grouped mobile layouts"
```

---

## Task 5: Create NoteList

**Files:**
- Create: `src/features/projects/components/NoteList.tsx`

- [ ] **Step 1: Create NoteList**

Create `src/features/projects/components/NoteList.tsx`:

```tsx
import type { Note } from '../../../shared/lib/types'
import { NoteCard } from './NoteCard'

interface NoteListProps {
  notes: Note[]
  loading: boolean
  onNoteTap: (note: Note) => void
}

export function NoteList({ notes, loading, onNoteTap }: NoteListProps) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    )
  }

  if (notes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500 text-sm">No notes yet. Tap + to create one.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2">
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} onClick={() => onNoteTap(note)} />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/projects/components/NoteList.tsx
git commit -m "feat: add NoteList component"
```

---

## Task 6: Create all drawers (NewTask, TaskDetail, NewNote, NoteDetail, ProjectSettings)

**Files:**
- Create: `src/features/projects/components/NewTaskDrawer.tsx`
- Create: `src/features/projects/components/TaskDetailDrawer.tsx`
- Create: `src/features/projects/components/NewNoteDrawer.tsx`
- Create: `src/features/projects/components/NoteDetailDrawer.tsx`
- Create: `src/features/projects/components/ProjectSettingsDrawer.tsx`

- [ ] **Step 1: Create NewTaskDrawer**

Create `src/features/projects/components/NewTaskDrawer.tsx`:

```tsx
import { useEffect, useState } from 'react'

interface NewTaskDrawerProps {
  onSave: (title: string) => Promise<void>
  onDone: () => void
}

export function NewTaskDrawer({ onSave, onDone }: NewTaskDrawerProps) {
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  function dismiss() {
    setVisible(false)
    setTimeout(onDone, 200)
  }

  async function handleSave() {
    const trimmed = title.trim()
    if (!trimmed || saving) return
    setSaving(true)
    await onSave(trimmed)
    setSaving(false)
    dismiss()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={dismiss}>
      <div
        className={`w-full bg-[#2a2a4a] rounded-t-2xl p-4 pb-[env(safe-area-inset-bottom,16px)] transition-transform duration-200 ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto mb-4" />
        <p className="text-sm text-gray-400 mb-3">New task</p>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title"
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
          className="w-full bg-[#1a1a2e] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6c5ce7] placeholder-gray-500 mb-4"
        />
        <div className="flex gap-2">
          <button onClick={dismiss} className="flex-1 text-sm text-gray-400 py-2">Cancel</button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || saving}
            className="flex-1 bg-[#6c5ce7] text-white text-sm font-semibold rounded-xl py-2 disabled:opacity-50"
          >
            {saving ? '...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create TaskDetailDrawer**

Create `src/features/projects/components/TaskDetailDrawer.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import type { Task, TaskStatus } from '../../../shared/lib/types'

interface TaskDetailDrawerProps {
  task: Task
  onUpdate: (id: string, updates: { title?: string; notes?: string | null; status?: TaskStatus; due_date?: string | null }) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
  onDone: () => void
}

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'Todo' },
  { value: 'doing', label: 'Doing' },
  { value: 'done', label: 'Done' },
]

export function TaskDetailDrawer({ task, onUpdate, onDelete, onDone }: TaskDetailDrawerProps) {
  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes ?? '')
  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [dueDate, setDueDate] = useState(task.due_date ?? '')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [visible, setVisible] = useState(false)
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    return () => { if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current) }
  }, [])

  function dismiss() {
    setVisible(false)
    setTimeout(onDone, 200)
  }

  async function handleSave() {
    const trimmed = title.trim()
    if (!trimmed || saving) return
    setSaving(true)
    await onUpdate(task.id, {
      title: trimmed,
      notes: notes.trim() || null,
      status,
      due_date: dueDate || null,
    })
    setSaving(false)
    dismiss()
  }

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      confirmTimerRef.current = setTimeout(() => setConfirmDelete(false), 3000)
      return
    }
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
    onDelete(task.id)
    dismiss()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={dismiss}>
      <div
        className={`w-full bg-[#2a2a4a] rounded-t-2xl p-4 pb-[env(safe-area-inset-bottom,16px)] transition-transform duration-200 max-h-[85vh] overflow-y-auto ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto mb-4" />
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-[#1a1a2e] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6c5ce7] placeholder-gray-500 mb-4"
          placeholder="Task title"
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          rows={3}
          className="w-full bg-[#1a1a2e] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6c5ce7] placeholder-gray-500 resize-none mb-4"
        />
        <p className="text-xs text-gray-500 mb-2">Status</p>
        <div className="flex gap-2 mb-4">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatus(opt.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                status === opt.value
                  ? 'bg-[#6c5ce7] text-white'
                  : 'bg-[#1a1a2e] text-gray-300 hover:bg-[#3a3a5a]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mb-2">Due date</p>
        <div className="flex items-center gap-2 mb-4">
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="flex-1 bg-[#1a1a2e] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6c5ce7] [color-scheme:dark]"
          />
          {dueDate && (
            <button onClick={() => setDueDate('')} className="text-gray-400 hover:text-white text-sm px-2">✕</button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDelete}
            className={`text-sm py-2 px-3 rounded-xl transition-colors ${
              confirmDelete ? 'text-red-400 bg-red-400/10 font-semibold' : 'text-red-400'
            }`}
          >
            {confirmDelete ? 'Are you sure?' : 'Delete'}
          </button>
          <div className="flex-1" />
          <button
            onClick={handleSave}
            disabled={!title.trim() || saving}
            className="bg-[#6c5ce7] text-white text-sm font-semibold rounded-xl py-2 px-6 disabled:opacity-50"
          >
            {saving ? '...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create NewNoteDrawer**

Create `src/features/projects/components/NewNoteDrawer.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'

interface NewNoteDrawerProps {
  onSave: (title: string | null, body: string) => Promise<void>
  onDone: () => void
}

export function NewNoteDrawer({ onSave, onDone }: NewNoteDrawerProps) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [visible, setVisible] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  function dismiss() {
    setVisible(false)
    setTimeout(onDone, 200)
  }

  async function handleSave() {
    const trimmedBody = body.trim()
    if (!trimmedBody || saving) return
    setSaving(true)
    await onSave(title.trim() || null, trimmedBody)
    setSaving(false)
    dismiss()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={dismiss}>
      <div
        className={`w-full bg-[#2a2a4a] rounded-t-2xl p-4 pb-[env(safe-area-inset-bottom,16px)] transition-transform duration-200 ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto mb-4" />
        <p className="text-sm text-gray-400 mb-3">New note</p>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          autoFocus
          className="w-full bg-[#1a1a2e] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6c5ce7] placeholder-gray-500 mb-3"
        />
        <textarea
          ref={bodyRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your note..."
          rows={4}
          className="w-full bg-[#1a1a2e] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6c5ce7] placeholder-gray-500 resize-none mb-4"
        />
        <div className="flex gap-2">
          <button onClick={dismiss} className="flex-1 text-sm text-gray-400 py-2">Cancel</button>
          <button
            onClick={handleSave}
            disabled={!body.trim() || saving}
            className="flex-1 bg-[#6c5ce7] text-white text-sm font-semibold rounded-xl py-2 disabled:opacity-50"
          >
            {saving ? '...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create NoteDetailDrawer**

Create `src/features/projects/components/NoteDetailDrawer.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import type { Note } from '../../../shared/lib/types'

interface NoteDetailDrawerProps {
  note: Note
  onUpdate: (id: string, updates: { title?: string | null; body?: string }) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
  onDone: () => void
}

export function NoteDetailDrawer({ note, onUpdate, onDelete, onDone }: NoteDetailDrawerProps) {
  const [title, setTitle] = useState(note.title ?? '')
  const [body, setBody] = useState(note.body)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [visible, setVisible] = useState(false)
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    return () => { if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current) }
  }, [])

  function dismiss() {
    setVisible(false)
    setTimeout(onDone, 200)
  }

  async function handleSave() {
    if (!body.trim() || saving) return
    setSaving(true)
    await onUpdate(note.id, { title: title.trim() || null, body: body.trim() })
    setSaving(false)
    dismiss()
  }

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      confirmTimerRef.current = setTimeout(() => setConfirmDelete(false), 3000)
      return
    }
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
    onDelete(note.id)
    dismiss()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={dismiss}>
      <div
        className={`w-full bg-[#2a2a4a] rounded-t-2xl p-4 pb-[env(safe-area-inset-bottom,16px)] transition-transform duration-200 max-h-[85vh] overflow-y-auto ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto mb-4" />
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          className="w-full bg-[#1a1a2e] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6c5ce7] placeholder-gray-500 mb-3"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your note..."
          rows={6}
          className="w-full bg-[#1a1a2e] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6c5ce7] placeholder-gray-500 resize-none mb-4"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={handleDelete}
            className={`text-sm py-2 px-3 rounded-xl transition-colors ${
              confirmDelete ? 'text-red-400 bg-red-400/10 font-semibold' : 'text-red-400'
            }`}
          >
            {confirmDelete ? 'Are you sure?' : 'Delete'}
          </button>
          <div className="flex-1" />
          <button
            onClick={handleSave}
            disabled={!body.trim() || saving}
            className="bg-[#6c5ce7] text-white text-sm font-semibold rounded-xl py-2 px-6 disabled:opacity-50"
          >
            {saving ? '...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create ProjectSettingsDrawer**

Create `src/features/projects/components/ProjectSettingsDrawer.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import type { Project, ProjectStatus } from '../../../shared/lib/types'

interface ProjectSettingsDrawerProps {
  project: Project
  onUpdate: (id: string, updates: { name?: string; description?: string | null; color?: string; status?: ProjectStatus }) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
  onDone: () => void
}

const PRESET_COLORS = [
  '#6c5ce7', '#00b894', '#fdcb6e', '#e17055',
  '#0984e3', '#e84393', '#636e72', '#2d3436',
]

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'idea', label: 'Idea' },
  { value: 'hold', label: 'On hold' },
  { value: 'done', label: 'Done' },
]

export function ProjectSettingsDrawer({ project, onUpdate, onDelete, onDone }: ProjectSettingsDrawerProps) {
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')
  const [color, setColor] = useState(project.color)
  const [status, setStatus] = useState<ProjectStatus>(project.status)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [visible, setVisible] = useState(false)
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    return () => { if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current) }
  }, [])

  function dismiss() {
    setVisible(false)
    setTimeout(onDone, 200)
  }

  async function handleSave() {
    const trimmed = name.trim()
    if (!trimmed || saving) return
    setSaving(true)
    await onUpdate(project.id, {
      name: trimmed,
      description: description.trim() || null,
      color,
      status,
    })
    setSaving(false)
    dismiss()
  }

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      confirmTimerRef.current = setTimeout(() => setConfirmDelete(false), 3000)
      return
    }
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
    onDelete(project.id)
    dismiss()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={dismiss}>
      <div
        className={`w-full bg-[#2a2a4a] rounded-t-2xl p-4 pb-[env(safe-area-inset-bottom,16px)] transition-transform duration-200 max-h-[85vh] overflow-y-auto ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto mb-4" />
        <p className="text-sm text-gray-400 mb-3">Project settings</p>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Project name"
          className="w-full bg-[#1a1a2e] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6c5ce7] placeholder-gray-500 mb-3"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={3}
          className="w-full bg-[#1a1a2e] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6c5ce7] placeholder-gray-500 resize-none mb-4"
        />
        <div className="flex gap-3 mb-4">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-8 h-8 rounded-full transition-all ${
                color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#2a2a4a]' : ''
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="flex gap-2 mb-4">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatus(opt.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                status === opt.value
                  ? 'bg-[#6c5ce7] text-white'
                  : 'bg-[#1a1a2e] text-gray-300 hover:bg-[#3a3a5a]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDelete}
            className={`text-sm py-2 px-3 rounded-xl transition-colors ${
              confirmDelete ? 'text-red-400 bg-red-400/10 font-semibold' : 'text-red-400'
            }`}
          >
            {confirmDelete ? 'Are you sure?' : 'Delete project'}
          </button>
          <div className="flex-1" />
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="bg-[#6c5ce7] text-white text-sm font-semibold rounded-xl py-2 px-6 disabled:opacity-50"
          >
            {saving ? '...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Commit all drawers**

```bash
git add src/features/projects/components/NewTaskDrawer.tsx src/features/projects/components/TaskDetailDrawer.tsx src/features/projects/components/NewNoteDrawer.tsx src/features/projects/components/NoteDetailDrawer.tsx src/features/projects/components/ProjectSettingsDrawer.tsx
git commit -m "feat: add task, note, and project settings drawers"
```

---

## Task 7: Update barrel export + build ProjectDetailPage

**Files:**
- Modify: `src/features/projects/index.ts`
- Modify: `src/pages/ProjectDetailPage.tsx`

- [ ] **Step 1: Update barrel export**

Replace `src/features/projects/index.ts`:

```ts
export { ProjectList } from './components/ProjectList'
export { ProjectCard } from './components/ProjectCard'
export { NewProjectDrawer } from './components/NewProjectDrawer'
export { ProjectTabs } from './components/ProjectTabs'
export { TaskList } from './components/TaskList'
export { TaskDetailDrawer } from './components/TaskDetailDrawer'
export { NewTaskDrawer } from './components/NewTaskDrawer'
export { NoteList } from './components/NoteList'
export { NoteDetailDrawer } from './components/NoteDetailDrawer'
export { NewNoteDrawer } from './components/NewNoteDrawer'
export { ProjectSettingsDrawer } from './components/ProjectSettingsDrawer'
export { useProjects } from './hooks/useProjects'
export { useProjectTasks } from './hooks/useProjectTasks'
export { useProjectNotes } from './hooks/useProjectNotes'
```

- [ ] **Step 2: Build full ProjectDetailPage**

Replace `src/pages/ProjectDetailPage.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../shared/lib/supabase'
import {
  ProjectTabs,
  TaskList,
  TaskDetailDrawer,
  NewTaskDrawer,
  NoteList,
  NoteDetailDrawer,
  NewNoteDrawer,
  ProjectSettingsDrawer,
  useProjects,
  useProjectTasks,
  useProjectNotes,
} from '../features/projects'
import { ThoughtCard } from '../features/inbox/components/ThoughtCard'
import { ThoughtDetailDrawer } from '../features/inbox/components/ThoughtDetailDrawer'
import { useThoughts } from '../features/inbox'
import type { Project, Task, Note, Thought } from '../shared/lib/types'

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [loadingProject, setLoadingProject] = useState(true)
  const [activeTab, setActiveTab] = useState<'thoughts' | 'tasks' | 'notes'>('tasks')

  // Hooks
  const { updateProject, deleteProject } = useProjects()
  const { tasks, loading: loadingTasks, addTask, updateTask, deleteTask } = useProjectTasks(id ?? '')
  const { notes, loading: loadingNotes, addNote, updateNote, deleteNote } = useProjectNotes(id ?? '')
  const { updateThought, deleteThought, archiveThought } = useThoughts()

  // Thoughts for this project
  const [thoughts, setThoughts] = useState<Thought[]>([])
  const [loadingThoughts, setLoadingThoughts] = useState(true)

  const fetchProjectThoughts = useCallback(async () => {
    if (!id) return
    const { data, error } = await supabase
      .from('huginn_thoughts')
      .select('*')
      .eq('project_id', id)
      .neq('status', 'archived')
      .order('created_at', { ascending: false })

    if (!error && data) setThoughts(data as Thought[])
    setLoadingThoughts(false)
  }, [id])

  useEffect(() => {
    fetchProjectThoughts()
  }, [fetchProjectThoughts])

  // Fetch project
  useEffect(() => {
    if (!id) return
    supabase
      .from('huginn_projects')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (!error) setProject(data as Project)
        setLoadingProject(false)
      })
  }, [id])

  // Drawer state
  const [showSettings, setShowSettings] = useState(false)
  const [showNewTask, setShowNewTask] = useState(false)
  const [showNewNote, setShowNewNote] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [editingThought, setEditingThought] = useState<Thought | null>(null)

  async function handleDeleteProject(projectId: string) {
    const success = await deleteProject(projectId)
    if (success) navigate('/projects')
    return success
  }

  async function handleUpdateProject(projectId: string, updates: { name?: string; description?: string | null; color?: string; status?: any }) {
    const success = await updateProject(projectId, updates)
    if (success && project) {
      setProject({ ...project, ...updates })
    }
    return success
  }

  if (loadingProject) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Project not found.</p>
      </div>
    )
  }

  const showFab = activeTab === 'tasks' || activeTab === 'notes'

  return (
    <>
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-[#2a2a4a]">
        <Link to="/projects" className="text-gray-400 hover:text-white">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12l4.58-4.59Z" />
          </svg>
        </Link>
        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
        <h1 className="text-lg font-bold flex-1">{project.name}</h1>
        <button onClick={() => setShowSettings(true)} className="text-gray-400 hover:text-white">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M12 8.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5ZM9.25 12a2.75 2.75 0 1 1 5.5 0 2.75 2.75 0 0 1-5.5 0Z" />
            <path d="M11.98 2a1.27 1.27 0 0 0-1.26 1.1l-.17 1.2a.86.86 0 0 1-.53.64 7.9 7.9 0 0 0-1.1.46.86.86 0 0 1-.82-.05l-1.02-.65a1.27 1.27 0 0 0-1.67.2l-.04.04a1.27 1.27 0 0 0-.2 1.67l.65 1.02c.15.24.16.54.05.82a7.9 7.9 0 0 0-.46 1.1.86.86 0 0 1-.64.53l-1.2.17A1.27 1.27 0 0 0 2 11.98v.04c0 .63.47 1.17 1.1 1.26l1.2.17c.28.04.52.24.64.53.13.38.28.74.46 1.1.11.28.1.58-.05.82l-.65 1.02a1.27 1.27 0 0 0 .2 1.67l.04.04c.44.44 1.15.52 1.67.2l1.02-.65a.86.86 0 0 1 .82-.05c.36.18.72.33 1.1.46.29.1.49.36.53.64l.17 1.2c.09.63.63 1.1 1.26 1.1h.04c.63 0 1.17-.47 1.26-1.1l.17-1.2a.86.86 0 0 1 .53-.64c.38-.13.74-.28 1.1-.46a.86.86 0 0 1 .82.05l1.02.65c.52.32 1.23.24 1.67-.2l.04-.04c.44-.44.52-1.15.2-1.67l-.65-1.02a.86.86 0 0 1-.05-.82c.18-.36.33-.72.46-1.1.1-.29.36-.49.64-.53l1.2-.17c.63-.09 1.1-.63 1.1-1.26v-.04c0-.63-.47-1.17-1.1-1.26l-1.2-.17a.86.86 0 0 1-.64-.53 7.9 7.9 0 0 0-.46-1.1.86.86 0 0 1 .05-.82l.65-1.02a1.27 1.27 0 0 0-.2-1.67l-.04-.04a1.27 1.27 0 0 0-1.67-.2l-1.02.65a.86.86 0 0 1-.82.05 7.9 7.9 0 0 0-1.1-.46.86.86 0 0 1-.53-.64l-.17-1.2A1.27 1.27 0 0 0 12.02 2h-.04Z" />
          </svg>
        </button>
      </header>

      {/* Tabs */}
      <ProjectTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab content */}
      {activeTab === 'thoughts' && (
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {loadingThoughts ? (
            <div className="flex-1 flex items-center justify-center py-12">
              <p className="text-gray-500 text-sm">Loading...</p>
            </div>
          ) : thoughts.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-12">
              <p className="text-gray-500 text-sm">No thoughts filed to this project yet.</p>
            </div>
          ) : (
            thoughts.map((t) => (
              <ThoughtCard key={t.id} thought={t} onClick={() => setEditingThought(t)} />
            ))
          )}
        </div>
      )}

      {activeTab === 'tasks' && (
        <TaskList tasks={tasks} loading={loadingTasks} onTaskTap={setEditingTask} />
      )}

      {activeTab === 'notes' && (
        <NoteList notes={notes} loading={loadingNotes} onNoteTap={setEditingNote} />
      )}

      {/* FAB */}
      {showFab && (
        <button
          onClick={() => activeTab === 'tasks' ? setShowNewTask(true) : setShowNewNote(true)}
          className="absolute bottom-20 right-4 w-12 h-12 bg-[#6c5ce7] rounded-full flex items-center justify-center shadow-lg active:bg-[#5b4bd5] transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
            <path d="M12 4a1 1 0 0 1 1 1v6h6a1 1 0 1 1 0 2h-6v6a1 1 0 1 1-2 0v-6H5a1 1 0 1 1 0-2h6V5a1 1 0 0 1 1-1Z" />
          </svg>
        </button>
      )}

      {/* Drawers */}
      {showSettings && (
        <ProjectSettingsDrawer
          project={project}
          onUpdate={handleUpdateProject}
          onDelete={handleDeleteProject}
          onDone={() => setShowSettings(false)}
        />
      )}
      {showNewTask && (
        <NewTaskDrawer
          onSave={async (title) => { await addTask(title) }}
          onDone={() => setShowNewTask(false)}
        />
      )}
      {editingTask && (
        <TaskDetailDrawer
          task={editingTask}
          onUpdate={updateTask}
          onDelete={deleteTask}
          onDone={() => setEditingTask(null)}
        />
      )}
      {showNewNote && (
        <NewNoteDrawer
          onSave={async (title, body) => { await addNote(title, body) }}
          onDone={() => setShowNewNote(false)}
        />
      )}
      {editingNote && (
        <NoteDetailDrawer
          note={editingNote}
          onUpdate={updateNote}
          onDelete={deleteNote}
          onDone={() => setEditingNote(null)}
        />
      )}
      {editingThought && (
        <ThoughtDetailDrawer
          thought={editingThought}
          onUpdate={updateThought}
          onDelete={deleteThought}
          onArchive={archiveThought}
          onDone={() => setEditingThought(null)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 3: Verify build**

```bash
cd c:/Dropbox/Huginn/huginn && npx vite build
```

- [ ] **Step 4: Commit**

```bash
git add src/features/projects/index.ts src/pages/ProjectDetailPage.tsx
git commit -m "feat: build full ProjectDetailPage with tabs, tasks, notes, and settings"
```

---

## Task 8: Final verification

- [ ] **Step 1: Start dev server**

```bash
cd c:/Dropbox/Huginn/huginn && npm run dev
```

- [ ] **Step 2: Manual test checklist**

1. Tap a project → detail page with header (back arrow, color dot, name, gear icon)
2. Three tabs: Thoughts, Tasks, Notes. Default: Tasks
3. **Tasks tab:** Empty state + "+" FAB
4. Tap "+" → NewTaskDrawer → type title → Save → task in Todo column/section
5. Tap task → TaskDetailDrawer → change status to Doing → Save → task moves
6. Desktop ≥768px: three kanban columns
7. Mobile <768px: three collapsible sections, Done collapsed by default
8. **Notes tab:** "+" → NewNoteDrawer → title + body → Save → appears in list
9. Tap note → NoteDetailDrawer → edit → Save → updates
10. **Thoughts tab:** Shows thoughts filed to project (if any). Tap opens ThoughtDetailDrawer.
11. Gear → ProjectSettingsDrawer → edit name/color/status → Save → header updates
12. Delete project → confirm → navigates to /projects
13. Delete task / delete note with 2-tap confirm
14. Back arrow → /projects
