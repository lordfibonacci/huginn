# Projects Screen + Bottom Nav Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bottom navigation bar and Projects screen with project listing grouped by status, new-project drawer, and placeholder detail page.

**Architecture:** Shared Layout component wraps authenticated routes via React Router nested routing. New `features/projects/` module follows the same pattern as `features/inbox/`. BottomNav uses React Router Links with location-based active state.

**Tech Stack:** React, TypeScript, Tailwind CSS, React Router, Supabase JS

---

## Task 1: Create BottomNav component

**Files:**
- Create: `src/shared/components/BottomNav.tsx`

- [ ] **Step 1: Create BottomNav**

Create `src/shared/components/BottomNav.tsx`:

```tsx
import { Link, useLocation } from 'react-router-dom'

export function BottomNav() {
  const { pathname } = useLocation()
  const isInbox = pathname === '/'
  const isProjects = pathname.startsWith('/projects')

  return (
    <nav className="flex border-t border-[#2a2a4a] bg-[#1a1a2e] pb-[env(safe-area-inset-bottom,0px)]">
      <Link
        to="/"
        className={`flex-1 flex flex-col items-center py-2 gap-0.5 ${
          isInbox ? 'text-[#6c5ce7]' : 'text-gray-500'
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
          <path d="M3.5 9.5a1 1 0 0 1 1-1h15a1 1 0 0 1 1 1v8a2.5 2.5 0 0 1-2.5 2.5h-12A2.5 2.5 0 0 1 3.5 17.5v-8Zm1 3V17.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V12.5h-4.09a3.5 3.5 0 0 1-6.82 0H4.5Z" />
        </svg>
        <span className="text-[10px] font-medium">Inbox</span>
      </Link>
      <Link
        to="/projects"
        className={`flex-1 flex flex-col items-center py-2 gap-0.5 ${
          isProjects ? 'text-[#6c5ce7]' : 'text-gray-500'
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
          <path d="M4 4a2 2 0 0 0-2 2v1h20V6a2 2 0 0 0-2-2h-6.18a2 2 0 0 1-1.41-.59l-.83-.82A2 2 0 0 0 10.18 2H4Zm-2 5v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9H2Z" />
        </svg>
        <span className="text-[10px] font-medium">Projects</span>
      </Link>
    </nav>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/components/BottomNav.tsx
git commit -m "feat: add BottomNav component with Inbox and Projects tabs"
```

---

## Task 2: Create Layout component

**Files:**
- Create: `src/shared/components/Layout.tsx`

- [ ] **Step 1: Create Layout**

Create `src/shared/components/Layout.tsx`:

```tsx
import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'

export function Layout() {
  return (
    <div className="h-[100dvh] bg-[#1a1a2e] text-white flex flex-col">
      <div className="flex-1 flex flex-col min-h-0">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/components/Layout.tsx
git commit -m "feat: add shared Layout component with Outlet and BottomNav"
```

---

## Task 3: Refactor routes to use Layout + adjust InboxPage

**Files:**
- Modify: `src/app/routes.tsx`
- Modify: `src/pages/InboxPage.tsx`

- [ ] **Step 1: Update routes.tsx to nested routing**

Replace `src/app/routes.tsx` with:

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../shared/hooks/useAuth'
import { Layout } from '../shared/components/Layout'
import { LoginPage } from '../pages/LoginPage'
import { InboxPage } from '../pages/InboxPage'
import { ProjectsPage } from '../pages/ProjectsPage'
import { ProjectDetailPage } from '../pages/ProjectDetailPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  if (user) return <Navigate to="/" replace />
  return <>{children}</>
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<InboxPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
```

Note: `ProjectsPage` and `ProjectDetailPage` don't exist yet — they'll be created in later tasks. This will cause a build error until they exist, which is expected.

- [ ] **Step 2: Adjust InboxPage — remove outer height container**

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
    </>
  )
}
```

Key change: root element is `<>` fragment instead of `<div className="h-[100dvh] ...">`. Layout now provides the height and background.

- [ ] **Step 3: Create placeholder pages so build passes**

Create `src/pages/ProjectsPage.tsx`:

```tsx
export function ProjectsPage() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-gray-500 text-sm">Projects coming soon.</p>
    </div>
  )
}
```

Create `src/pages/ProjectDetailPage.tsx`:

```tsx
export function ProjectDetailPage() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-gray-500 text-sm">Project detail coming soon.</p>
    </div>
  )
}
```

- [ ] **Step 4: Verify build**

```bash
cd c:/Dropbox/Huginn/huginn && npx vite build
```

Expected: compiles with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/routes.tsx src/pages/InboxPage.tsx src/pages/ProjectsPage.tsx src/pages/ProjectDetailPage.tsx
git commit -m "feat: refactor routes to nested layout with bottom nav"
```

---

## Task 4: Create useProjects hook

**Files:**
- Create: `src/features/projects/hooks/useProjects.ts`

- [ ] **Step 1: Create useProjects hook**

Create `src/features/projects/hooks/useProjects.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import type { Project, ProjectStatus } from '../../../shared/lib/types'

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  const fetchProjects = useCallback(async () => {
    const { data, error } = await supabase
      .from('huginn_projects')
      .select('*')
      .order('name')

    if (error) {
      console.error('Failed to fetch projects:', error)
      return
    }
    setProjects(data as Project[])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  async function addProject(
    name: string,
    color: string,
    status: ProjectStatus
  ): Promise<Project | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const optimistic: Project = {
      id: crypto.randomUUID(),
      user_id: user.id,
      name,
      description: null,
      color,
      status,
      pinned: false,
      created_at: new Date().toISOString(),
    }

    setProjects((prev) => [...prev, optimistic].sort((a, b) => a.name.localeCompare(b.name)))

    const { data, error } = await supabase
      .from('huginn_projects')
      .insert({ name, color, status, user_id: user.id })
      .select()
      .single()

    if (error) {
      console.error('Failed to add project:', error)
      setProjects((prev) => prev.filter((p) => p.id !== optimistic.id))
      return null
    }

    setProjects((prev) =>
      prev.map((p) => (p.id === optimistic.id ? (data as Project) : p))
    )
    return data as Project
  }

  return { projects, loading, addProject, count: projects.length }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/projects/hooks/useProjects.ts
git commit -m "feat: add useProjects hook with fetch and optimistic create"
```

---

## Task 5: Create ProjectCard and ProjectList components

**Files:**
- Create: `src/features/projects/components/ProjectCard.tsx`
- Create: `src/features/projects/components/ProjectList.tsx`

- [ ] **Step 1: Create ProjectCard**

Create `src/features/projects/components/ProjectCard.tsx`:

```tsx
import type { Project } from '../../../shared/lib/types'

interface ProjectCardProps {
  project: Project
  onClick?: () => void
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  return (
    <div
      className="flex items-center gap-3 bg-[#2a2a4a] rounded-xl px-4 py-3 mb-2 cursor-pointer active:bg-[#3a3a5a] transition-colors"
      onClick={onClick}
    >
      <div
        className="w-3 h-3 rounded-full shrink-0"
        style={{ backgroundColor: project.color }}
      />
      <span className="text-sm text-gray-100 flex-1">{project.name}</span>
      {project.status !== 'active' && (
        <span className="text-xs text-gray-500">{project.status}</span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create ProjectList**

Create `src/features/projects/components/ProjectList.tsx`:

```tsx
import type { Project, ProjectStatus } from '../../../shared/lib/types'
import { ProjectCard } from './ProjectCard'

interface ProjectListProps {
  projects: Project[]
  loading: boolean
  onProjectTap: (project: Project) => void
}

const STATUS_ORDER: { key: ProjectStatus; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'hold', label: 'On hold' },
  { key: 'idea', label: 'Idea' },
  { key: 'done', label: 'Done' },
]

export function ProjectList({ projects, loading, onProjectTap }: ProjectListProps) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500 text-sm">No projects yet. Tap + to create one.</p>
      </div>
    )
  }

  const grouped = STATUS_ORDER.map(({ key, label }) => ({
    label,
    items: projects.filter((p) => p.status === key),
  })).filter((g) => g.items.length > 0)

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2">
      {grouped.map((group) => (
        <div key={group.label} className="mb-4">
          <h2 className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2 px-1">
            {group.label}
          </h2>
          {group.items.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => onProjectTap(project)}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/projects/components/ProjectCard.tsx src/features/projects/components/ProjectList.tsx
git commit -m "feat: add ProjectCard and ProjectList with status grouping"
```

---

## Task 6: Create NewProjectDrawer component

**Files:**
- Create: `src/features/projects/components/NewProjectDrawer.tsx`

- [ ] **Step 1: Create NewProjectDrawer**

Create `src/features/projects/components/NewProjectDrawer.tsx`:

```tsx
import { useEffect, useState } from 'react'
import type { ProjectStatus } from '../../../shared/lib/types'

interface NewProjectDrawerProps {
  onSave: (name: string, color: string, status: ProjectStatus) => Promise<void>
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

export function NewProjectDrawer({ onSave, onDone }: NewProjectDrawerProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [status, setStatus] = useState<ProjectStatus>('active')
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
    const trimmed = name.trim()
    if (!trimmed || saving) return

    setSaving(true)
    await onSave(trimmed, color, status)
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

        <p className="text-sm text-gray-400 mb-3">New project</p>

        {/* Name */}
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Project name"
          autoFocus
          className="w-full bg-[#1a1a2e] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6c5ce7] placeholder-gray-500 mb-4"
        />

        {/* Color swatches */}
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

        {/* Status chips */}
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

        {/* Actions */}
        <div className="flex gap-2">
          <button onClick={dismiss} className="flex-1 text-sm text-gray-400 py-2">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
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

- [ ] **Step 2: Commit**

```bash
git add src/features/projects/components/NewProjectDrawer.tsx
git commit -m "feat: add NewProjectDrawer with name, color swatches, and status"
```

---

## Task 7: Create barrel export and build ProjectsPage

**Files:**
- Create: `src/features/projects/index.ts`
- Modify: `src/pages/ProjectsPage.tsx`

- [ ] **Step 1: Create barrel export**

Create `src/features/projects/index.ts`:

```ts
export { ProjectList } from './components/ProjectList'
export { ProjectCard } from './components/ProjectCard'
export { NewProjectDrawer } from './components/NewProjectDrawer'
export { useProjects } from './hooks/useProjects'
```

- [ ] **Step 2: Build full ProjectsPage**

Replace `src/pages/ProjectsPage.tsx` with:

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../shared/hooks/useAuth'
import { ProjectList, NewProjectDrawer, useProjects } from '../features/projects'
import type { Project } from '../shared/lib/types'

export function ProjectsPage() {
  const { signOut } = useAuth()
  const { projects, loading, addProject, count } = useProjects()
  const [showNewProject, setShowNewProject] = useState(false)
  const navigate = useNavigate()

  function handleProjectTap(project: Project) {
    navigate(`/projects/${project.id}`)
  }

  async function handleSave(name: string, color: string, status: 'idea' | 'active' | 'hold' | 'done') {
    await addProject(name, color, status)
  }

  return (
    <>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a4a]">
        <div>
          <h1 className="text-xl font-bold">Projects</h1>
          <p className="text-xs text-gray-500">
            {count} project{count !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={signOut}
          className="text-xs text-gray-500 hover:text-white"
        >
          Sign out
        </button>
      </header>

      {/* Project list */}
      <ProjectList
        projects={projects}
        loading={loading}
        onProjectTap={handleProjectTap}
      />

      {/* Floating + button */}
      <button
        onClick={() => setShowNewProject(true)}
        className="absolute bottom-20 right-4 w-12 h-12 bg-[#6c5ce7] rounded-full flex items-center justify-center shadow-lg active:bg-[#5b4bd5] transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
          <path d="M12 4a1 1 0 0 1 1 1v6h6a1 1 0 1 1 0 2h-6v6a1 1 0 1 1-2 0v-6H5a1 1 0 1 1 0-2h6V5a1 1 0 0 1 1-1Z" />
        </svg>
      </button>

      {/* New project drawer */}
      {showNewProject && (
        <NewProjectDrawer
          onSave={handleSave}
          onDone={() => setShowNewProject(false)}
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
git add src/features/projects/index.ts src/pages/ProjectsPage.tsx
git commit -m "feat: build ProjectsPage with list, new-project drawer, and floating button"
```

---

## Task 8: Build ProjectDetailPage

**Files:**
- Modify: `src/pages/ProjectDetailPage.tsx`

- [ ] **Step 1: Build full ProjectDetailPage**

Replace `src/pages/ProjectDetailPage.tsx` with:

```tsx
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../shared/lib/supabase'
import type { Project } from '../shared/lib/types'

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return

    supabase
      .from('huginn_projects')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to fetch project:', error)
        } else {
          setProject(data as Project)
        }
        setLoading(false)
      })
  }, [id])

  if (loading) {
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

  return (
    <>
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-[#2a2a4a]">
        <Link to="/projects" className="text-gray-400 hover:text-white">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12l4.58-4.59Z" />
          </svg>
        </Link>
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: project.color }}
        />
        <h1 className="text-lg font-bold flex-1">{project.name}</h1>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <p className="text-sm text-gray-400">
          {project.description || 'No description yet.'}
        </p>
      </div>
    </>
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
git add src/pages/ProjectDetailPage.tsx
git commit -m "feat: build ProjectDetailPage placeholder with back nav"
```

---

## Task 9: Final verification

- [ ] **Step 1: Start dev server**

```bash
cd c:/Dropbox/Huginn/huginn && npm run dev
```

- [ ] **Step 2: Manual test checklist**

1. Bottom nav appears on Inbox page with two tabs (Inbox highlighted)
2. Tap Projects tab → navigates to `/projects`, Projects tab highlighted
3. Tap Inbox tab → back to `/`, Inbox tab highlighted
4. Bottom nav does NOT appear on `/login`
5. InboxPage still works (thoughts, input, voice, classify drawer, edit drawer)
6. Projects page shows empty state: "No projects yet. Tap + to create one."
7. Tap "+" → NewProjectDrawer slides up with name input, 8 color swatches, status chips
8. Type a name, pick a color, tap Save → project appears in list under "Active" heading
9. Create projects with different statuses → grouped correctly (Active, On hold, Idea, Done)
10. Tap a project → navigates to `/projects/:id`, shows name with colored dot, description placeholder
11. Back arrow on detail page → returns to `/projects`
12. Mobile viewport (Chrome DevTools) → bottom nav fits, floating button above nav, no overflow
