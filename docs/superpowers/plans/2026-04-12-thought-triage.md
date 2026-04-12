# Thought Triage & Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich thoughts with priority and due dates, add filtering/sorting to the inbox, add archive action, and show project badges on thought cards — transforming the inbox from a capture dump into a prioritized work queue.

**Architecture:** Add `priority` and `due_date` columns to `huginn_thoughts` via migration. Expand useThoughts hook with archive function and updated query (inbox + filed). New FilterBar component for client-side filtering/sorting. Enhanced ThoughtCard with metadata badges. Enhanced ThoughtDetailDrawer with priority chips, date picker, and archive button.

**Tech Stack:** React, TypeScript, Tailwind CSS, Supabase JS, Supabase MCP (migration)

---

## Task 1: Database migration + type updates

**Files:**
- Modify: `src/shared/lib/types.ts`

This task uses Supabase MCP for the migration.

- [ ] **Step 1: Run migration to add columns**

Use `mcp__plugin_supabase_supabase__apply_migration` with:
- `project_id`: `czdjxtsjgughimlazdmu`
- `name`: `add_huginn_thoughts_priority_and_due_date`
- `query`:

```sql
ALTER TABLE huginn_thoughts
  ADD COLUMN priority text CHECK (priority IN ('low', 'medium', 'high')),
  ADD COLUMN due_date date;
```

- [ ] **Step 2: Update TypeScript types**

In `src/shared/lib/types.ts`, add the new type alias after the existing `ThoughtType` line:

```ts
export type ThoughtPriority = 'low' | 'medium' | 'high'
```

And add the two new fields to the `Thought` interface (after the `tags` field):

```ts
  priority: ThoughtPriority | null
  due_date: string | null
```

The full updated `Thought` interface should be:

```ts
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
```

- [ ] **Step 3: Verify build**

```bash
cd c:/Dropbox/Huginn/huginn && npx vite build
```

Expected: compiles with no errors (existing code doesn't reference the new fields yet).

- [ ] **Step 4: Commit**

```bash
git add src/shared/lib/types.ts
git commit -m "feat: add priority and due_date to Thought type"
```

---

## Task 2: Update useThoughts hook

**Files:**
- Modify: `src/features/inbox/hooks/useThoughts.ts`

- [ ] **Step 1: Change fetchThoughts query**

Change line 13 from:

```ts
      .eq('status', 'inbox')
```

to:

```ts
      .in('status', ['inbox', 'filed'])
```

- [ ] **Step 2: Expand updateThought signature**

Change the `updateThought` function signature (around line 85-87) from:

```ts
  async function updateThought(
    thoughtId: string,
    updates: { body?: string; type?: 'idea' | 'task' | 'note' | null; project_id?: string | null }
  ) {
```

to:

```ts
  async function updateThought(
    thoughtId: string,
    updates: {
      body?: string
      type?: 'idea' | 'task' | 'note' | null
      project_id?: string | null
      priority?: 'low' | 'medium' | 'high' | null
      due_date?: string | null
    }
  ) {
```

- [ ] **Step 3: Add archiveThought function**

Add this function after `deleteThought` (before the return statement):

```ts
  async function archiveThought(thoughtId: string) {
    const prev = thoughts
    setThoughts((t) => t.filter((th) => th.id !== thoughtId))

    const { error } = await supabase
      .from('huginn_thoughts')
      .update({ status: 'archived' })
      .eq('id', thoughtId)

    if (error) {
      console.error('Failed to archive thought:', error)
      setThoughts(prev)
      return false
    }
    return true
  }
```

- [ ] **Step 4: Update return statement**

Change the return statement from:

```ts
  return { thoughts, loading, addThought, classifyThought, updateThought, deleteThought, count: thoughts.length }
```

to:

```ts
  return { thoughts, loading, addThought, classifyThought, updateThought, deleteThought, archiveThought, count: thoughts.length }
```

- [ ] **Step 5: Verify build**

```bash
cd c:/Dropbox/Huginn/huginn && npx vite build
```

- [ ] **Step 6: Commit**

```bash
git add src/features/inbox/hooks/useThoughts.ts
git commit -m "feat: expand useThoughts with archive, priority, due_date support"
```

---

## Task 3: Enhance ThoughtCard with metadata badges

**Files:**
- Modify: `src/features/inbox/components/ThoughtCard.tsx`

- [ ] **Step 1: Replace ThoughtCard with enhanced version**

Replace the entire file `src/features/inbox/components/ThoughtCard.tsx`:

```tsx
import type { Thought } from '../../../shared/lib/types'

function timeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatDueDate(dateString: string): { text: string; urgent: boolean } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dateString + 'T00:00:00')
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return { text: `${Math.abs(diffDays)}d overdue`, urgent: true }
  if (diffDays === 0) return { text: 'due today', urgent: true }
  if (diffDays === 1) return { text: 'due tomorrow', urgent: false }
  if (diffDays <= 7) return { text: `due in ${diffDays}d`, urgent: false }

  const d = due
  const month = d.toLocaleString('en', { month: 'short' })
  return { text: `due ${month} ${d.getDate()}`, urgent: false }
}

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-[#e17055]',
  medium: 'bg-[#fdcb6e]',
}

interface ThoughtCardProps {
  thought: Thought
  onClick?: () => void
  projectName?: string
  projectColor?: string
}

export function ThoughtCard({ thought, onClick, projectName, projectColor }: ThoughtCardProps) {
  const dueInfo = thought.due_date ? formatDueDate(thought.due_date) : null

  return (
    <div
      className="bg-[#2a2a4a] rounded-xl p-3 mb-2 cursor-pointer active:bg-[#3a3a5a] transition-colors"
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        {thought.source === 'voice' && (
          <span className="text-xs mt-0.5 shrink-0" title="Voice note">
            🎤
          </span>
        )}
        <p className="text-sm text-gray-100 whitespace-pre-wrap break-words flex-1">
          {thought.body}
        </p>
      </div>
      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 flex-wrap">
        <span>{timeAgo(thought.created_at)}</span>
        {thought.type && (
          <span className="bg-[#1a1a2e] px-2 py-0.5 rounded-full">
            {thought.type}
          </span>
        )}
        {thought.priority && PRIORITY_COLORS[thought.priority] && (
          <span className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[thought.priority]}`} title={thought.priority} />
        )}
        {dueInfo && (
          <span className={dueInfo.urgent ? 'text-[#e17055]' : 'text-gray-400'}>
            {dueInfo.text}
          </span>
        )}
        {projectName && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: projectColor }} />
            <span className="text-gray-400 truncate max-w-[100px]">{projectName}</span>
          </span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/inbox/components/ThoughtCard.tsx
git commit -m "feat: enhance ThoughtCard with priority, due date, and project badges"
```

---

## Task 4: Enhance ThoughtDetailDrawer with priority, due date, archive

**Files:**
- Modify: `src/features/inbox/components/ThoughtDetailDrawer.tsx`

- [ ] **Step 1: Replace ThoughtDetailDrawer with enhanced version**

Replace the entire file `src/features/inbox/components/ThoughtDetailDrawer.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import type { Project, Thought, ThoughtType, ThoughtPriority } from '../../../shared/lib/types'

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

const TYPE_OPTIONS: { value: ThoughtType; label: string }[] = [
  { value: 'idea', label: 'Idea' },
  { value: 'task', label: 'Task' },
  { value: 'note', label: 'Note' },
]

const PRIORITY_OPTIONS: { value: ThoughtPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'bg-gray-500' },
  { value: 'medium', label: 'Medium', color: 'bg-[#fdcb6e]' },
  { value: 'high', label: 'High', color: 'bg-[#e17055]' },
]

export function ThoughtDetailDrawer({ thought, onUpdate, onDelete, onArchive, onDone }: ThoughtDetailDrawerProps) {
  const [body, setBody] = useState(thought.body)
  const [selectedType, setSelectedType] = useState<ThoughtType | null>(thought.type)
  const [selectedProject, setSelectedProject] = useState<string | null>(thought.project_id)
  const [selectedPriority, setSelectedPriority] = useState<ThoughtPriority | null>(thought.priority)
  const [dueDate, setDueDate] = useState<string>(thought.due_date ?? '')
  const [projects, setProjects] = useState<Project[]>([])
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [visible, setVisible] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))

    supabase
      .from('huginn_projects')
      .select('*')
      .eq('status', 'active')
      .order('name')
      .then(({ data }) => {
        if (data) setProjects(data as Project[])
      })

    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [body])

  function dismiss() {
    setVisible(false)
    setTimeout(onDone, 200)
  }

  async function handleSave() {
    const trimmed = body.trim()
    if (!trimmed || saving) return

    setSaving(true)
    await onUpdate(thought.id, {
      body: trimmed,
      type: selectedType,
      project_id: selectedProject,
      priority: selectedPriority,
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
    onDelete(thought.id)
    dismiss()
  }

  function handleArchive() {
    onArchive(thought.id)
    dismiss()
  }

  const canSave = body.trim().length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={dismiss}>
      <div
        className={`w-full bg-[#2a2a4a] rounded-t-2xl p-4 pb-[env(safe-area-inset-bottom,16px)] transition-transform duration-200 max-h-[85vh] overflow-y-auto ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto mb-4" />

        {/* Editable body */}
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full bg-[#1a1a2e] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6c5ce7] placeholder-gray-500 resize-none mb-4"
          rows={3}
        />

        {/* Type chips */}
        <div className="flex gap-2 mb-4">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() =>
                setSelectedType(selectedType === opt.value ? null : opt.value)
              }
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedType === opt.value
                  ? 'bg-[#6c5ce7] text-white'
                  : 'bg-[#1a1a2e] text-gray-300 hover:bg-[#3a3a5a]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Project dropdown */}
        {projects.length > 0 && (
          <select
            value={selectedProject ?? ''}
            onChange={(e) => setSelectedProject(e.target.value || null)}
            className="w-full bg-[#1a1a2e] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6c5ce7] mb-4 appearance-none"
          >
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}

        {/* Priority chips */}
        <p className="text-xs text-gray-500 mb-2">Priority</p>
        <div className="flex gap-2 mb-4">
          {PRIORITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() =>
                setSelectedPriority(selectedPriority === opt.value ? null : opt.value)
              }
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedPriority === opt.value
                  ? `${opt.color} text-white`
                  : 'bg-[#1a1a2e] text-gray-300 hover:bg-[#3a3a5a]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Due date */}
        <p className="text-xs text-gray-500 mb-2">Due date</p>
        <div className="flex items-center gap-2 mb-4">
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="flex-1 bg-[#1a1a2e] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6c5ce7] [color-scheme:dark]"
          />
          {dueDate && (
            <button
              onClick={() => setDueDate('')}
              className="text-gray-400 hover:text-white text-sm px-2"
            >
              ✕
            </button>
          )}
        </div>

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
            className={`text-sm py-2 px-3 rounded-xl transition-colors ${
              confirmDelete
                ? 'text-red-400 bg-red-400/10 font-semibold'
                : 'text-red-400'
            }`}
          >
            {confirmDelete ? 'Are you sure?' : 'Delete'}
          </button>
          <div className="flex-1" />
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
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
git add src/features/inbox/components/ThoughtDetailDrawer.tsx
git commit -m "feat: add priority chips, due date picker, and archive to ThoughtDetailDrawer"
```

---

## Task 5: Create FilterBar component

**Files:**
- Create: `src/features/inbox/components/FilterBar.tsx`
- Modify: `src/features/inbox/index.ts`

- [ ] **Step 1: Create FilterBar**

Create `src/features/inbox/components/FilterBar.tsx`:

```tsx
type FilterType = 'all' | 'idea' | 'task' | 'note'
type SortType = 'newest' | 'priority'

interface FilterBarProps {
  activeFilter: FilterType
  onFilterChange: (filter: FilterType) => void
  sortBy: SortType
  onSortChange: (sort: SortType) => void
}

const FILTERS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'idea', label: 'Ideas' },
  { value: 'task', label: 'Tasks' },
  { value: 'note', label: 'Notes' },
]

export function FilterBar({ activeFilter, onFilterChange, sortBy, onSortChange }: FilterBarProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-[#2a2a4a]">
      <div className="flex gap-1.5 flex-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => onFilterChange(f.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              activeFilter === f.value
                ? 'bg-[#6c5ce7] text-white'
                : 'bg-[#2a2a4a] text-gray-400 hover:bg-[#3a3a5a]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <button
        onClick={() => onSortChange(sortBy === 'newest' ? 'priority' : 'newest')}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors px-2 py-1"
        title={sortBy === 'newest' ? 'Sort by priority' : 'Sort by newest'}
      >
        {sortBy === 'newest' ? (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm.75 4.75v3.69l2.28 2.28a.75.75 0 1 1-1.06 1.06l-2.5-2.5A.75.75 0 0 1 9.25 11V6.75a.75.75 0 0 1 1.5 0Z" />
            </svg>
            New
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M3.5 2.75a.75.75 0 0 0-1.5 0v14.5a.75.75 0 0 0 1.5 0v-14.5ZM7.5 6a.75.75 0 0 0 0 1.5h4a.75.75 0 0 0 0-1.5h-4Zm0 4a.75.75 0 0 0 0 1.5h7a.75.75 0 0 0 0-1.5h-7Zm0 4a.75.75 0 0 0 0 1.5h10a.75.75 0 0 0 0-1.5H7.5Z" />
            </svg>
            Priority
          </>
        )}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Add FilterBar to barrel export**

Replace `src/features/inbox/index.ts`:

```ts
export { ThoughtInput } from './components/ThoughtInput'
export { ThoughtList } from './components/ThoughtList'
export { ClassifyDrawer } from './components/ClassifyDrawer'
export { ThoughtDetailDrawer } from './components/ThoughtDetailDrawer'
export { FilterBar } from './components/FilterBar'
export { useThoughts } from './hooks/useThoughts'
```

- [ ] **Step 3: Commit**

```bash
git add src/features/inbox/components/FilterBar.tsx src/features/inbox/index.ts
git commit -m "feat: add FilterBar component with type filters and sort toggle"
```

---

## Task 6: Wire everything into InboxPage

**Files:**
- Modify: `src/pages/InboxPage.tsx`
- Modify: `src/features/inbox/components/ThoughtList.tsx`

- [ ] **Step 1: Update ThoughtList to accept project data**

Replace `src/features/inbox/components/ThoughtList.tsx`:

```tsx
import type { Thought, Project } from '../../../shared/lib/types'
import { ThoughtCard } from './ThoughtCard'

interface ThoughtListProps {
  thoughts: Thought[]
  loading: boolean
  onThoughtTap: (thought: Thought) => void
  projectsById?: Record<string, Project>
}

export function ThoughtList({ thoughts, loading, onThoughtTap, projectsById }: ThoughtListProps) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    )
  }

  if (thoughts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500 text-sm">
          No thoughts yet. Type one below.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2">
      {thoughts.map((thought) => {
        const project = thought.project_id && projectsById ? projectsById[thought.project_id] : undefined
        return (
          <ThoughtCard
            key={thought.id}
            thought={thought}
            onClick={() => onThoughtTap(thought)}
            projectName={project?.name}
            projectColor={project?.color}
          />
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Replace InboxPage with full wiring**

Replace `src/pages/InboxPage.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { useAuth } from '../shared/hooks/useAuth'
import { ThoughtInput, ThoughtList, ClassifyDrawer, ThoughtDetailDrawer, FilterBar, useThoughts } from '../features/inbox'
import { useProjects } from '../features/projects'
import type { Thought } from '../shared/lib/types'

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

export function InboxPage() {
  const { signOut } = useAuth()
  const { thoughts, loading, addThought, classifyThought, updateThought, deleteThought, archiveThought, count } = useThoughts()
  const { projects } = useProjects()
  const [classifyThoughtId, setClassifyThoughtId] = useState<string | null>(null)
  const [editingThought, setEditingThought] = useState<Thought | null>(null)
  const [activeFilter, setActiveFilter] = useState<'all' | 'idea' | 'task' | 'note'>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'priority'>('newest')

  const projectsById = useMemo(() => {
    const map: Record<string, typeof projects[number]> = {}
    for (const p of projects) map[p.id] = p
    return map
  }, [projects])

  const filteredThoughts = useMemo(() => {
    let result = thoughts
    if (activeFilter !== 'all') {
      result = result.filter((t) => t.type === activeFilter)
    }
    if (sortBy === 'priority') {
      result = [...result].sort((a, b) => {
        const pa = a.priority ? PRIORITY_ORDER[a.priority] : 3
        const pb = b.priority ? PRIORITY_ORDER[b.priority] : 3
        if (pa !== pb) return pa - pb
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
    }
    return result
  }, [thoughts, activeFilter, sortBy])

  async function handleSubmit(body: string, source: 'text' | 'voice') {
    const thought = await addThought(body, source)
    if (thought) {
      setClassifyThoughtId(thought.id)
    }
    return thought
  }

  return (
    <>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a4a]">
        <div>
          <h1 className="text-xl font-bold">Huginn</h1>
          <p className="text-xs text-gray-500">
            {count} thought{count !== 1 ? 's' : ''} in inbox
          </p>
        </div>
        <button
          onClick={signOut}
          className="text-xs text-gray-500 hover:text-white"
        >
          Sign out
        </button>
      </header>

      {/* Filter bar */}
      <FilterBar
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

      {/* Thought list */}
      <ThoughtList
        thoughts={filteredThoughts}
        loading={loading}
        onThoughtTap={setEditingThought}
        projectsById={projectsById}
      />

      {/* Input bar */}
      <ThoughtInput onSubmit={handleSubmit} />

      {/* Classify drawer (post-save) */}
      {classifyThoughtId && (
        <ClassifyDrawer
          thoughtId={classifyThoughtId}
          onClassify={classifyThought}
          onDone={() => setClassifyThoughtId(null)}
        />
      )}

      {/* Detail drawer (tap to edit) */}
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

Expected: compiles with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/InboxPage.tsx src/features/inbox/components/ThoughtList.tsx
git commit -m "feat: wire filter bar, project badges, and archive into InboxPage"
```

---

## Task 7: Final verification

- [ ] **Step 1: Start dev server**

```bash
cd c:/Dropbox/Huginn/huginn && npm run dev
```

- [ ] **Step 2: Manual test checklist**

1. New thoughts still capture and appear in inbox
2. Tap a thought → drawer shows priority chips (Low/Medium/High) + due date picker + Archive button
3. Set priority to "High" + due date to tomorrow → save → card shows red priority pip + "due tomorrow"
4. Set priority to "Medium" → card shows yellow pip
5. Assign a thought to a project → card shows project color dot + name in inbox (stays visible, doesn't disappear)
6. Tap Archive → thought disappears from inbox
7. Filter chips: tap "Tasks" → only type=task shown. Tap "Ideas" → only ideas. Tap "All" → back to full list.
8. Sort toggle: switch to "Priority" → high-priority thoughts at top. Switch back to "New" → chronological.
9. Delete still works with 2-tap confirmation
10. ClassifyDrawer still appears after creating a new thought
11. Mobile viewport: filter bar fits without horizontal scroll, date picker opens native picker
