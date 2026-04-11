# Thought Detail Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tap-to-open functionality on thought cards that opens a bottom drawer for editing body, type, project, and deleting thoughts.

**Architecture:** New `ThoughtDetailDrawer` component following the same visual patterns as ClassifyDrawer. Add `updateThought` and `deleteThought` to existing `useThoughts` hook. Thread an `onThoughtTap` callback from InboxPage through ThoughtList to ThoughtCard.

**Tech Stack:** React, TypeScript, Tailwind CSS, Supabase JS

---

## Task 1: Add updateThought and deleteThought to useThoughts hook

**Files:**
- Modify: `src/features/inbox/hooks/useThoughts.ts`

- [ ] **Step 1: Add updateThought function**

Add this function inside `useThoughts()`, after the `classifyThought` function (after line 83):

```ts
  async function updateThought(
    thoughtId: string,
    updates: { body?: string; type?: 'idea' | 'task' | 'note' | null; project_id?: string | null }
  ) {
    const prev = thoughts
    setThoughts((t) =>
      t.map((th) => (th.id === thoughtId ? { ...th, ...updates } : th))
    )

    const { error } = await supabase
      .from('huginn_thoughts')
      .update(updates)
      .eq('id', thoughtId)

    if (error) {
      console.error('Failed to update thought:', error)
      setThoughts(prev)
      return false
    }
    return true
  }
```

- [ ] **Step 2: Add deleteThought function**

Add this function right after `updateThought`:

```ts
  async function deleteThought(thoughtId: string) {
    const prev = thoughts
    setThoughts((t) => t.filter((th) => th.id !== thoughtId))

    const { error } = await supabase
      .from('huginn_thoughts')
      .delete()
      .eq('id', thoughtId)

    if (error) {
      console.error('Failed to delete thought:', error)
      setThoughts(prev)
      return false
    }
    return true
  }
```

- [ ] **Step 3: Update the return statement**

Change line 85 from:

```ts
  return { thoughts, loading, addThought, classifyThought, count: thoughts.length }
```

to:

```ts
  return { thoughts, loading, addThought, classifyThought, updateThought, deleteThought, count: thoughts.length }
```

- [ ] **Step 4: Verify build**

```bash
cd c:/Dropbox/Huginn/huginn && npx vite build
```

Expected: compiles with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/inbox/hooks/useThoughts.ts
git commit -m "feat: add updateThought and deleteThought to useThoughts hook"
```

---

## Task 2: Make ThoughtCard tappable

**Files:**
- Modify: `src/features/inbox/components/ThoughtCard.tsx`

- [ ] **Step 1: Add onClick prop and tap styling**

Replace the full file with:

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

interface ThoughtCardProps {
  thought: Thought
  onClick?: () => void
}

export function ThoughtCard({ thought, onClick }: ThoughtCardProps) {
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
      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
        <span>{timeAgo(thought.created_at)}</span>
        {thought.type && (
          <span className="bg-[#1a1a2e] px-2 py-0.5 rounded-full">
            {thought.type}
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
git commit -m "feat: make ThoughtCard tappable with onClick prop"
```

---

## Task 3: Thread onThoughtTap through ThoughtList

**Files:**
- Modify: `src/features/inbox/components/ThoughtList.tsx`

- [ ] **Step 1: Add onThoughtTap prop and pass to cards**

Replace the full file with:

```tsx
import type { Thought } from '../../../shared/lib/types'
import { ThoughtCard } from './ThoughtCard'

interface ThoughtListProps {
  thoughts: Thought[]
  loading: boolean
  onThoughtTap: (thought: Thought) => void
}

export function ThoughtList({ thoughts, loading, onThoughtTap }: ThoughtListProps) {
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
      {thoughts.map((thought) => (
        <ThoughtCard
          key={thought.id}
          thought={thought}
          onClick={() => onThoughtTap(thought)}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/inbox/components/ThoughtList.tsx
git commit -m "feat: thread onThoughtTap callback through ThoughtList"
```

---

## Task 4: Create ThoughtDetailDrawer component

**Files:**
- Create: `src/features/inbox/components/ThoughtDetailDrawer.tsx`

- [ ] **Step 1: Create the component**

Create `src/features/inbox/components/ThoughtDetailDrawer.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import type { Project, Thought, ThoughtType } from '../../../shared/lib/types'

interface ThoughtDetailDrawerProps {
  thought: Thought
  onUpdate: (id: string, updates: { body?: string; type?: ThoughtType | null; project_id?: string | null }) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
  onDone: () => void
}

const TYPE_OPTIONS: { value: ThoughtType; label: string }[] = [
  { value: 'idea', label: 'Idea' },
  { value: 'task', label: 'Task' },
  { value: 'note', label: 'Note' },
]

export function ThoughtDetailDrawer({ thought, onUpdate, onDelete, onDone }: ThoughtDetailDrawerProps) {
  const [body, setBody] = useState(thought.body)
  const [selectedType, setSelectedType] = useState<ThoughtType | null>(thought.type)
  const [selectedProject, setSelectedProject] = useState<string | null>(thought.project_id)
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

  // Auto-grow textarea
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

  const canSave = body.trim().length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={dismiss}>
      <div
        className={`w-full bg-[#2a2a4a] rounded-t-2xl p-4 pb-[env(safe-area-inset-bottom,16px)] transition-transform duration-200 ${
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

        {/* Actions */}
        <div className="flex items-center gap-2">
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

- [ ] **Step 2: Verify build**

```bash
cd c:/Dropbox/Huginn/huginn && npx vite build
```

Expected: compiles with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/inbox/components/ThoughtDetailDrawer.tsx
git commit -m "feat: add ThoughtDetailDrawer with edit, classify, and delete"
```

---

## Task 5: Update barrel export and wire into InboxPage

**Files:**
- Modify: `src/features/inbox/index.ts`
- Modify: `src/pages/InboxPage.tsx`

- [ ] **Step 1: Add ThoughtDetailDrawer to barrel export**

Replace `src/features/inbox/index.ts` with:

```ts
export { ThoughtInput } from './components/ThoughtInput'
export { ThoughtList } from './components/ThoughtList'
export { ClassifyDrawer } from './components/ClassifyDrawer'
export { ThoughtDetailDrawer } from './components/ThoughtDetailDrawer'
export { useThoughts } from './hooks/useThoughts'
```

- [ ] **Step 2: Wire ThoughtDetailDrawer into InboxPage**

Replace `src/pages/InboxPage.tsx` with:

```tsx
import { useState } from 'react'
import { useAuth } from '../shared/hooks/useAuth'
import { ThoughtInput, ThoughtList, ClassifyDrawer, ThoughtDetailDrawer, useThoughts } from '../features/inbox'
import type { Thought } from '../shared/lib/types'

export function InboxPage() {
  const { signOut } = useAuth()
  const { thoughts, loading, addThought, classifyThought, updateThought, deleteThought, count } = useThoughts()
  const [classifyThoughtId, setClassifyThoughtId] = useState<string | null>(null)
  const [editingThought, setEditingThought] = useState<Thought | null>(null)

  async function handleSubmit(body: string, source: 'text' | 'voice') {
    const thought = await addThought(body, source)
    if (thought) {
      setClassifyThoughtId(thought.id)
    }
    return thought
  }

  return (
    <div className="h-[100dvh] bg-[#1a1a2e] text-white flex flex-col">
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

      {/* Thought list */}
      <ThoughtList
        thoughts={thoughts}
        loading={loading}
        onThoughtTap={setEditingThought}
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
          onDone={() => setEditingThought(null)}
        />
      )}
    </div>
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
git add src/features/inbox/index.ts src/pages/InboxPage.tsx
git commit -m "feat: wire ThoughtDetailDrawer into InboxPage"
```

---

## Task 6: Final verification

- [ ] **Step 1: Start dev server**

```bash
cd c:/Dropbox/Huginn/huginn && npm run dev
```

- [ ] **Step 2: Manual test checklist**

1. Tap a thought card → drawer slides up with body in textarea, type pre-selected, project pre-selected
2. Edit body text, change type, tap Save → card updates in list immediately, drawer closes
3. Tap a card → tap Delete → button says "Are you sure?" → wait 3s → resets to "Delete"
4. Tap a card → tap Delete → tap "Are you sure?" → card disappears from list, drawer closes
5. Tap a card → tap backdrop → drawer dismisses, no changes applied
6. Tap a card → clear textarea → Save button is disabled
7. Submit a new thought → ClassifyDrawer still appears (post-save triage unchanged)
8. Mobile viewport (Chrome DevTools) → drawer fits, no overflow
