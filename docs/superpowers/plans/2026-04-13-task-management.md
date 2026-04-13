# Task Management Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add priority levels, quick status toggle, thought-to-task conversion, and drag-and-drop kanban to make Huginn's task management feel like a real productivity tool.

**Architecture:** Add priority column to huginn_tasks via migration. Enhance existing TaskCard with status toggle button. Add dnd-kit for desktop kanban drag-and-drop. Add convertToTask to useThoughts hook with "Convert to task" button in ThoughtDetailDrawer.

**Tech Stack:** React, TypeScript, Tailwind CSS, Supabase JS, @dnd-kit/core, @dnd-kit/sortable

---

## Task 1: Migration + types + install dnd-kit

**Files:**
- Modify: `src/shared/lib/types.ts`

- [ ] **Step 1: Run migration via Supabase MCP**

Use `mcp__plugin_supabase_supabase__apply_migration`:
- `project_id`: `czdjxtsjgughimlazdmu`
- `name`: `add_huginn_tasks_priority`
- `query`:

```sql
ALTER TABLE huginn_tasks ADD COLUMN priority text CHECK (priority IN ('low', 'medium', 'high'));
```

- [ ] **Step 2: Update Task type**

In `src/shared/lib/types.ts`, add `priority` to the Task interface. Change:

```ts
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
```

to:

```ts
export interface Task {
  id: string
  user_id: string
  project_id: string
  title: string
  notes: string | null
  status: TaskStatus
  priority: ThoughtPriority | null
  from_thought_id: string | null
  due_date: string | null
  created_at: string
}
```

- [ ] **Step 3: Install dnd-kit**

```bash
cd c:/Dropbox/Huginn/huginn && npm install @dnd-kit/core @dnd-kit/sortable
```

- [ ] **Step 4: Verify build + commit**

```bash
npx vite build
git add src/shared/lib/types.ts package.json package-lock.json
git commit -m "feat: add priority to Task type and install dnd-kit"
```

---

## Task 2: Update useProjectTasks + add convertToTask to useThoughts

**Files:**
- Modify: `src/features/projects/hooks/useProjectTasks.ts`
- Modify: `src/features/inbox/hooks/useThoughts.ts`

- [ ] **Step 1: Expand useProjectTasks updateTask signature**

In `src/features/projects/hooks/useProjectTasks.ts`, change the `updateTask` parameter type from:

```ts
    updates: { title?: string; notes?: string | null; status?: TaskStatus; due_date?: string | null }
```

to:

```ts
    updates: { title?: string; notes?: string | null; status?: TaskStatus; priority?: 'low' | 'medium' | 'high' | null; due_date?: string | null }
```

Also update the optimistic `addTask` to include `priority: null` in the optimistic object (after `status: 'todo'`).

- [ ] **Step 2: Add convertToTask to useThoughts**

In `src/features/inbox/hooks/useThoughts.ts`, add this function after `archiveThought` and before the return:

```ts
  async function convertToTask(thoughtId: string) {
    const thought = thoughts.find((t) => t.id === thoughtId)
    if (!thought || !thought.project_id) return false

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    // Create the task
    const { error: taskError } = await supabase
      .from('huginn_tasks')
      .insert({
        title: thought.body,
        project_id: thought.project_id,
        from_thought_id: thought.id,
        status: 'todo',
        user_id: user.id,
      })

    if (taskError) {
      console.error('Failed to convert thought to task:', taskError)
      return false
    }

    // Archive the thought
    setThoughts((t) => t.filter((th) => th.id !== thoughtId))

    const { error: archiveError } = await supabase
      .from('huginn_thoughts')
      .update({ status: 'archived' })
      .eq('id', thoughtId)

    if (archiveError) {
      console.error('Failed to archive converted thought:', archiveError)
    }

    return true
  }
```

Update the return to include `convertToTask`:

```ts
  return { thoughts, loading, addThought, classifyThought, updateThought, deleteThought, archiveThought, convertToTask, count: thoughts.length }
```

- [ ] **Step 3: Verify build + commit**

```bash
npx vite build
git add src/features/projects/hooks/useProjectTasks.ts src/features/inbox/hooks/useThoughts.ts
git commit -m "feat: expand updateTask for priority and add convertToTask to useThoughts"
```

---

## Task 3: Enhance TaskCard with priority pip + quick status toggle

**Files:**
- Modify: `src/features/projects/components/TaskCard.tsx`

- [ ] **Step 1: Replace TaskCard with enhanced version**

Replace entire `src/features/projects/components/TaskCard.tsx`:

```tsx
import type { Task, TaskStatus } from '../../../shared/lib/types'
import { formatDueDate } from '../../../shared/lib/dateUtils'

const STATUS_COLORS: Record<string, string> = {
  todo: 'border-gray-500 text-gray-500',
  doing: 'border-[#6c5ce7] bg-[#6c5ce7] text-white',
  done: 'border-[#00b894] bg-[#00b894] text-white',
}

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-[#e17055]',
  medium: 'bg-[#fdcb6e]',
}

const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  todo: 'doing',
  doing: 'done',
  done: 'todo',
}

interface TaskCardProps {
  task: Task
  onClick?: () => void
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void
}

export function TaskCard({ task, onClick, onStatusChange }: TaskCardProps) {
  const dueInfo = task.due_date ? formatDueDate(task.due_date) : null

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation()
    if (onStatusChange) {
      onStatusChange(task.id, NEXT_STATUS[task.status])
    }
  }

  return (
    <div
      className="bg-[#2a2a4a] rounded-xl p-3 mb-2 cursor-pointer active:bg-[#3a3a5a] transition-colors"
      onClick={onClick}
      data-task-id={task.id}
    >
      <div className="flex items-start gap-2.5">
        {/* Status toggle */}
        <button
          onClick={handleToggle}
          className={`w-5 h-5 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center transition-colors ${STATUS_COLORS[task.status]}`}
          title={`Mark as ${NEXT_STATUS[task.status]}`}
        >
          {task.status === 'done' && (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
              <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.58l7.3-7.3a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <p className={`text-sm ${task.status === 'done' ? 'text-gray-500 line-through' : 'text-gray-100'}`}>
            {task.title}
          </p>
          {(dueInfo || (task.priority && PRIORITY_COLORS[task.priority])) && (
            <div className="flex items-center gap-2 mt-1">
              {task.priority && PRIORITY_COLORS[task.priority] && (
                <span className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[task.priority]}`} title={task.priority} />
              )}
              {dueInfo && (
                <span className={`text-xs ${dueInfo.urgent ? 'text-[#e17055]' : 'text-gray-500'}`}>
                  {dueInfo.text}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/projects/components/TaskCard.tsx
git commit -m "feat: enhance TaskCard with priority pip and quick status toggle"
```

---

## Task 4: Add priority chips to TaskDetailDrawer

**Files:**
- Modify: `src/features/projects/components/TaskDetailDrawer.tsx`

- [ ] **Step 1: Replace TaskDetailDrawer with enhanced version**

Replace entire `src/features/projects/components/TaskDetailDrawer.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import type { Task, TaskStatus, ThoughtPriority } from '../../../shared/lib/types'

interface TaskDetailDrawerProps {
  task: Task
  onUpdate: (id: string, updates: { title?: string; notes?: string | null; status?: TaskStatus; priority?: ThoughtPriority | null; due_date?: string | null }) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
  onDone: () => void
}

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'Todo' },
  { value: 'doing', label: 'Doing' },
  { value: 'done', label: 'Done' },
]

const PRIORITY_OPTIONS: { value: ThoughtPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'bg-gray-500' },
  { value: 'medium', label: 'Medium', color: 'bg-[#fdcb6e]' },
  { value: 'high', label: 'High', color: 'bg-[#e17055]' },
]

export function TaskDetailDrawer({ task, onUpdate, onDelete, onDone }: TaskDetailDrawerProps) {
  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes ?? '')
  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [priority, setPriority] = useState<ThoughtPriority | null>(task.priority)
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
      priority,
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
        <p className="text-xs text-gray-500 mb-2">Priority</p>
        <div className="flex gap-2 mb-4">
          {PRIORITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPriority(priority === opt.value ? null : opt.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                priority === opt.value
                  ? `${opt.color} text-white`
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

- [ ] **Step 2: Commit**

```bash
git add src/features/projects/components/TaskDetailDrawer.tsx
git commit -m "feat: add priority chips to TaskDetailDrawer"
```

---

## Task 5: Add "Convert to task" button to ThoughtDetailDrawer

**Files:**
- Modify: `src/features/inbox/components/ThoughtDetailDrawer.tsx`

- [ ] **Step 1: Add onConvertToTask prop and button**

In `src/features/inbox/components/ThoughtDetailDrawer.tsx`:

Add `onConvertToTask` to the props interface — change:

```ts
interface ThoughtDetailDrawerProps {
  thought: Thought
  onUpdate: (id: string, updates: {
    body?: string
    type?: ThoughtType | null
    project_id?: string | null
    priority?: ThoughtPriority | null
    due_date?: string | null
  }) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
  onArchive: (id: string) => Promise<boolean>
  onDone: () => void
}
```

to:

```ts
interface ThoughtDetailDrawerProps {
  thought: Thought
  onUpdate: (id: string, updates: {
    body?: string
    type?: ThoughtType | null
    project_id?: string | null
    priority?: ThoughtPriority | null
    due_date?: string | null
  }) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
  onArchive: (id: string) => Promise<boolean>
  onConvertToTask?: (id: string) => Promise<boolean>
  onDone: () => void
}
```

Update the destructuring:

```ts
export function ThoughtDetailDrawer({ thought, onUpdate, onDelete, onArchive, onConvertToTask, onDone }: ThoughtDetailDrawerProps) {
```

Add a handler function after `handleArchive`:

```ts
  async function handleConvertToTask() {
    if (!onConvertToTask) return
    await onConvertToTask(thought.id)
    dismiss()
  }
```

In the actions row, add the Convert button BEFORE the Archive button. Change the actions div from:

```tsx
        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleArchive}
            className="text-sm py-2 px-3 rounded-xl text-gray-400 hover:text-white transition-colors"
          >
            Archive
          </button>
          <button
            onClick={handleDelete}
```

to:

```tsx
        {/* Actions */}
        <div className="flex items-center gap-2">
          {onConvertToTask && selectedProject && (
            <button
              onClick={handleConvertToTask}
              className="text-sm py-2 px-3 rounded-xl text-[#6c5ce7] bg-[#6c5ce7]/10 font-medium hover:bg-[#6c5ce7]/20 transition-colors"
            >
              Convert to task
            </button>
          )}
          <button
            onClick={handleArchive}
            className="text-sm py-2 px-3 rounded-xl text-gray-400 hover:text-white transition-colors"
          >
            Archive
          </button>
          <button
            onClick={handleDelete}
```

Note: `selectedProject` is already a state variable in the component (line 34 of the existing file). The button only shows when a project is assigned.

- [ ] **Step 2: Wire in InboxPage**

In `src/pages/InboxPage.tsx`, the ThoughtDetailDrawer already receives `onUpdate`, `onDelete`, `onArchive`. Add `onConvertToTask`. Change:

```tsx
        <ThoughtDetailDrawer
          thought={editingThought}
          onUpdate={updateThought}
          onDelete={deleteThought}
          onArchive={archiveThought}
          onDone={() => setEditingThought(null)}
        />
```

to:

```tsx
        <ThoughtDetailDrawer
          thought={editingThought}
          onUpdate={updateThought}
          onDelete={deleteThought}
          onArchive={archiveThought}
          onConvertToTask={convertToTask}
          onDone={() => setEditingThought(null)}
        />
```

Also update the destructuring of `useThoughts()` from:

```ts
  const { thoughts, loading, addThought, classifyThought, updateThought, deleteThought, archiveThought, count } = useThoughts()
```

to:

```ts
  const { thoughts, loading, addThought, classifyThought, updateThought, deleteThought, archiveThought, convertToTask, count } = useThoughts()
```

- [ ] **Step 3: Wire in ProjectDetailPage**

In `src/pages/ProjectDetailPage.tsx`, update the destructuring of `useThoughts()` from:

```ts
  const { updateThought, deleteThought, archiveThought } = useThoughts()
```

to:

```ts
  const { updateThought, deleteThought, archiveThought, convertToTask } = useThoughts()
```

And add `onConvertToTask` to the ThoughtDetailDrawer in ProjectDetailPage. Change:

```tsx
        <ThoughtDetailDrawer
          thought={editingThought}
          onUpdate={updateThought}
          onDelete={deleteThought}
          onArchive={archiveThought}
          onDone={() => setEditingThought(null)}
        />
```

to:

```tsx
        <ThoughtDetailDrawer
          thought={editingThought}
          onUpdate={updateThought}
          onDelete={deleteThought}
          onArchive={archiveThought}
          onConvertToTask={convertToTask}
          onDone={() => setEditingThought(null)}
        />
```

- [ ] **Step 4: Verify build + commit**

```bash
npx vite build
git add src/features/inbox/components/ThoughtDetailDrawer.tsx src/pages/InboxPage.tsx src/pages/ProjectDetailPage.tsx
git commit -m "feat: add Convert to task button in ThoughtDetailDrawer"
```

---

## Task 6: Add drag-and-drop to kanban + priority sorting + thread onStatusChange

**Files:**
- Modify: `src/features/projects/components/TaskList.tsx`
- Modify: `src/pages/ProjectDetailPage.tsx`

- [ ] **Step 1: Replace TaskList with dnd-kit enhanced version**

Replace entire `src/features/projects/components/TaskList.tsx`:

```tsx
import { useState } from 'react'
import { DndContext, DragOverlay, useDroppable, useDraggable, closestCenter } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import type { Task, TaskStatus } from '../../../shared/lib/types'
import { TaskCard } from './TaskCard'

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

interface TaskListProps {
  tasks: Task[]
  loading: boolean
  onTaskTap: (task: Task) => void
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void
}

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: 'Todo' },
  { status: 'doing', label: 'Doing' },
  { status: 'done', label: 'Done' },
]

function sortByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const pa = a.priority ? PRIORITY_ORDER[a.priority] : 3
    const pb = b.priority ? PRIORITY_ORDER[b.priority] : 3
    if (pa !== pb) return pa - pb
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

function DroppableColumn({ status, label, children }: { status: string; label: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[200px] flex flex-col rounded-lg transition-colors ${isOver ? 'bg-[#2a2a4a]/30' : ''}`}
      data-status={status}
    >
      <div className="flex items-center gap-2 mb-2 px-1">
        <h3 className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{label}</h3>
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}

function DraggableCard({ task, onTaskTap, onStatusChange }: { task: Task; onTaskTap: (task: Task) => void; onStatusChange: (taskId: string, newStatus: TaskStatus) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id })
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={isDragging ? 'opacity-30' : ''}>
      <TaskCard task={task} onClick={() => onTaskTap(task)} onStatusChange={onStatusChange} />
    </div>
  )
}

function KanbanView({ tasks, onTaskTap, onStatusChange }: { tasks: Task[]; onTaskTap: (task: Task) => void; onStatusChange: (taskId: string, newStatus: TaskStatus) => void }) {
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t.id === event.active.id)
    setActiveTask(task ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null)
    const { active, over } = event
    if (!over) return
    const taskId = active.id as string
    const newStatus = over.id as TaskStatus
    const task = tasks.find((t) => t.id === taskId)
    if (task && task.status !== newStatus) {
      onStatusChange(taskId, newStatus)
    }
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex-1 flex gap-3 px-3 py-2 overflow-x-auto">
        {COLUMNS.map(({ status, label }) => {
          const columnTasks = sortByPriority(tasks.filter((t) => t.status === status))
          return (
            <DroppableColumn key={status} status={status} label={`${label} (${columnTasks.length})`}>
              {columnTasks.length === 0 ? (
                <p className="text-xs text-gray-600 px-1">No tasks</p>
              ) : (
                columnTasks.map((task) => (
                  <DraggableCard key={task.id} task={task} onTaskTap={onTaskTap} onStatusChange={onStatusChange} />
                ))
              )}
            </DroppableColumn>
          )
        })}
      </div>
      <DragOverlay>
        {activeTask && (
          <div className="w-[200px]">
            <TaskCard task={activeTask} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

function GroupedView({ tasks, onTaskTap, onStatusChange }: { tasks: Task[]; onTaskTap: (task: Task) => void; onStatusChange: (taskId: string, newStatus: TaskStatus) => void }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ done: true })

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2">
      {COLUMNS.map(({ status, label }) => {
        const columnTasks = sortByPriority(tasks.filter((t) => t.status === status))
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
                <TaskCard key={task.id} task={task} onClick={() => onTaskTap(task)} onStatusChange={onStatusChange} />
              ))}
          </div>
        )
      })}
    </div>
  )
}

export function TaskList({ tasks, loading, onTaskTap, onStatusChange }: TaskListProps) {
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
        <KanbanView tasks={tasks} onTaskTap={onTaskTap} onStatusChange={onStatusChange} />
      </div>
      <div className="md:hidden flex-1 min-h-0">
        <GroupedView tasks={tasks} onTaskTap={onTaskTap} onStatusChange={onStatusChange} />
      </div>
    </>
  )
}
```

- [ ] **Step 2: Thread onStatusChange in ProjectDetailPage**

In `src/pages/ProjectDetailPage.tsx`, change the TaskList usage from:

```tsx
        <TaskList tasks={tasks} loading={loadingTasks} onTaskTap={setEditingTask} />
```

to:

```tsx
        <TaskList tasks={tasks} loading={loadingTasks} onTaskTap={setEditingTask} onStatusChange={(id, status) => updateTask(id, { status })} />
```

- [ ] **Step 3: Verify build + commit**

```bash
npx vite build
git add src/features/projects/components/TaskList.tsx src/pages/ProjectDetailPage.tsx
git commit -m "feat: add drag-and-drop kanban, priority sorting, and status toggle threading"
```

---

## Task 7: Final verification

- [ ] **Step 1: Start dev server**

```bash
cd c:/Dropbox/Huginn/huginn && npm run dev
```

- [ ] **Step 2: Manual test checklist**

1. **Priority:** Open task detail → set priority to High → save → card shows red pip. High-priority tasks sorted to top of kanban columns.
2. **Quick toggle:** Tap the circle on a todo task → becomes doing (purple filled). Tap again → done (green check). Card moves to correct column/section.
3. **Drag-and-drop (desktop ≥768px):** Drag a task card from Todo to Doing → card moves, status updates. Drag from Doing to Done → same.
4. **No drag on mobile:** On mobile viewport, cards have toggle buttons but no drag behavior.
5. **Convert thought:** Capture a thought → assign to a project → open it → "Convert to task" button visible (purple) → tap → thought archived from inbox → task appears in project's Todo.
6. **Convert hidden without project:** Open a thought with no project → "Convert to task" button not visible.
7. **Convert in ProjectDetailPage:** Open a project → Thoughts tab → tap a thought → "Convert to task" works there too.
8. **All existing features still work:** Task create/edit/delete, note management, project settings, inbox filtering, sidebar navigation.
