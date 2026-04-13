# Card & List Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply Bold & Vibrant visual polish to all card components and FilterBar — bold colored type badges, larger touch targets, hover borders, improved spacing.

**Architecture:** Pure styling replacement across 5 component files. No behavior or prop changes. All independent — can be parallelized.

**Tech Stack:** React, TypeScript, Tailwind CSS (huginn tokens)

---

## Task 1: Polish ThoughtCard

**Files:**
- Modify: `src/features/inbox/components/ThoughtCard.tsx`

- [ ] **Step 1: Replace ThoughtCard**

Replace entire `src/features/inbox/components/ThoughtCard.tsx`:

```tsx
import type { Thought, ThoughtType } from '../../../shared/lib/types'
import { timeAgo, formatDueDate } from '../../../shared/lib/dateUtils'

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-huginn-danger',
  medium: 'bg-huginn-warning',
}

const TYPE_BADGE: Record<ThoughtType, string> = {
  task: 'bg-huginn-accent text-white',
  idea: 'bg-huginn-warning text-black',
  note: 'bg-huginn-success text-white',
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
      className="bg-huginn-card rounded-xl p-4 mb-2.5 cursor-pointer active:bg-huginn-hover hover:bg-huginn-hover border-l-[3px] border-transparent hover:border-huginn-accent transition-all"
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        {thought.source === 'voice' && (
          <span className="text-xs mt-0.5 shrink-0" title="Voice note">
            🎤
          </span>
        )}
        <p className="text-sm text-huginn-text-primary whitespace-pre-wrap break-words flex-1 leading-relaxed">
          {thought.body}
        </p>
      </div>
      <div className="flex items-center gap-2.5 mt-2.5 text-xs text-huginn-text-secondary flex-wrap">
        <span>{timeAgo(thought.created_at)}</span>
        {thought.type && (
          <span className={`text-[11px] font-bold uppercase tracking-wide rounded-md px-2.5 py-0.5 ${TYPE_BADGE[thought.type]}`}>
            {thought.type}
          </span>
        )}
        {thought.priority && PRIORITY_COLORS[thought.priority] && (
          <span className={`w-2.5 h-2.5 rounded-sm ${PRIORITY_COLORS[thought.priority]}`} title={thought.priority} />
        )}
        {dueInfo && (
          <span className={`font-medium ${dueInfo.urgent ? 'text-huginn-danger' : 'text-huginn-text-secondary'}`}>
            {dueInfo.text}
          </span>
        )}
        {projectName && (
          <span className="flex items-center gap-1 bg-huginn-surface/80 rounded-full px-2 py-0.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: projectColor }} />
            <span className="text-huginn-text-secondary truncate max-w-[120px]">{projectName}</span>
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
git commit -m "style: polish ThoughtCard with bold type badges, hover borders, better spacing"
```

---

## Task 2: Polish TaskCard

**Files:**
- Modify: `src/features/projects/components/TaskCard.tsx`

- [ ] **Step 1: Replace TaskCard**

Replace entire `src/features/projects/components/TaskCard.tsx`:

```tsx
import type { Task, TaskStatus } from '../../../shared/lib/types'
import { formatDueDate } from '../../../shared/lib/dateUtils'

const STATUS_COLORS: Record<string, string> = {
  todo: 'border-gray-500 text-gray-500',
  doing: 'border-huginn-accent bg-huginn-accent text-white',
  done: 'border-huginn-success bg-huginn-success text-white',
}

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-huginn-danger',
  medium: 'bg-huginn-warning',
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
      className="bg-huginn-card rounded-xl p-4 mb-2.5 cursor-pointer active:bg-huginn-hover hover:bg-huginn-hover border-l-[3px] border-transparent hover:border-huginn-accent transition-all"
      onClick={onClick}
      data-task-id={task.id}
    >
      <div className="flex items-start gap-3">
        {/* Status toggle */}
        <button
          onClick={handleToggle}
          className={`w-6 h-6 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center transition-colors ${STATUS_COLORS[task.status]}`}
          title={`Mark as ${NEXT_STATUS[task.status]}`}
        >
          {task.status === 'done' && (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.58l7.3-7.3a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <p className={`text-sm leading-relaxed ${task.status === 'done' ? 'text-gray-500 line-through' : 'text-huginn-text-primary'}`}>
            {task.title}
          </p>
          {(dueInfo || (task.priority && PRIORITY_COLORS[task.priority])) && (
            <div className="flex items-center gap-2.5 mt-1.5">
              {task.priority && PRIORITY_COLORS[task.priority] && (
                <span className={`w-2.5 h-2.5 rounded-sm ${PRIORITY_COLORS[task.priority]}`} title={task.priority} />
              )}
              {dueInfo && (
                <span className={`text-xs font-medium ${dueInfo.urgent ? 'text-huginn-danger' : 'text-huginn-text-secondary'}`}>
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
git commit -m "style: polish TaskCard with larger toggle, hover borders, better spacing"
```

---

## Task 3: Polish ProjectCard + NoteCard

**Files:**
- Modify: `src/features/projects/components/ProjectCard.tsx`
- Modify: `src/features/projects/components/NoteCard.tsx`

- [ ] **Step 1: Replace ProjectCard**

Replace entire `src/features/projects/components/ProjectCard.tsx`:

```tsx
import type { Project } from '../../../shared/lib/types'

interface ProjectCardProps {
  project: Project
  onClick?: () => void
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  return (
    <div
      className="flex items-center gap-3 bg-huginn-card rounded-xl px-4 py-3 mb-2.5 cursor-pointer active:bg-huginn-hover hover:bg-huginn-hover border-l-[3px] border-transparent hover:border-huginn-accent transition-all"
      onClick={onClick}
    >
      <div
        className="w-4 h-4 rounded-full shrink-0"
        style={{ backgroundColor: project.color }}
      />
      <span className="text-sm text-huginn-text-primary flex-1">{project.name}</span>
      {project.status !== 'active' && (
        <span className="bg-huginn-surface text-huginn-text-secondary text-[11px] rounded-md px-2 py-0.5">
          {project.status}
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Replace NoteCard**

Replace entire `src/features/projects/components/NoteCard.tsx`:

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
      className="bg-huginn-card rounded-xl p-4 mb-2.5 cursor-pointer active:bg-huginn-hover hover:bg-huginn-hover border-l-[3px] border-transparent hover:border-huginn-accent transition-all"
      onClick={onClick}
    >
      <p className="text-sm text-huginn-text-primary font-medium">{displayTitle}</p>
      <p className="text-xs text-huginn-text-secondary mt-1.5">{timeAgo(note.created_at)}</p>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/projects/components/ProjectCard.tsx src/features/projects/components/NoteCard.tsx
git commit -m "style: polish ProjectCard and NoteCard with hover borders, better spacing"
```

---

## Task 4: Polish FilterBar

**Files:**
- Modify: `src/features/inbox/components/FilterBar.tsx`

- [ ] **Step 1: Replace FilterBar**

Replace entire `src/features/inbox/components/FilterBar.tsx`:

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
    <div className="flex items-center gap-2 px-4 py-3 border-b border-huginn-border">
      <div className="flex gap-2 flex-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => onFilterChange(f.value)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeFilter === f.value
                ? 'bg-huginn-accent text-white shadow-md shadow-huginn-accent/40'
                : 'bg-huginn-card text-gray-400 hover:bg-huginn-hover hover:text-gray-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <button
        onClick={() => onSortChange(sortBy === 'newest' ? 'priority' : 'newest')}
        className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-white hover:bg-huginn-card rounded-lg px-3 py-1.5 transition-colors"
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

- [ ] **Step 2: Commit**

```bash
git add src/features/inbox/components/FilterBar.tsx
git commit -m "style: polish FilterBar with bigger chips, active shadow, sort hover"
```

---

## Task 5: Verify + build

- [ ] **Step 1: Build**

```bash
cd c:/Dropbox/Huginn/huginn && npx vite build
```

- [ ] **Step 2: Spot-check**

1. ThoughtCards: bold colored type badges (purple TASK, yellow IDEA, green NOTE), left border on hover
2. TaskCards: larger w-6 status toggle, hover border
3. ProjectCards: larger color dot, styled status pill
4. NoteCards: brighter text, hover border
5. FilterBar: bigger chips with shadow on active, sort button with hover bg
