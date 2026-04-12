# Desktop Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent left sidebar on desktop (≥768px) showing app name, inbox link with count, and all projects with task counts — while keeping the existing bottom nav on mobile.

**Architecture:** New Sidebar component with project list grouped by status. New useTaskCounts hook for a single query to get per-project active task counts. Layout becomes responsive: sidebar on desktop via `hidden md:flex`, bottom nav on mobile via `md:hidden`.

**Tech Stack:** React, TypeScript, Tailwind CSS, React Router, Supabase JS

---

## Task 1: Create useTaskCounts hook

**Files:**
- Create: `src/shared/hooks/useTaskCounts.ts`

- [ ] **Step 1: Create useTaskCounts**

Create `src/shared/hooks/useTaskCounts.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useTaskCounts() {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  const fetchCounts = useCallback(async () => {
    const { data, error } = await supabase
      .from('huginn_tasks')
      .select('project_id')
      .neq('status', 'done')

    if (error) {
      console.error('Failed to fetch task counts:', error)
      return
    }

    const map: Record<string, number> = {}
    for (const row of data) {
      map[row.project_id] = (map[row.project_id] || 0) + 1
    }
    setCounts(map)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchCounts()
  }, [fetchCounts])

  return { counts, loading }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/hooks/useTaskCounts.ts
git commit -m "feat: add useTaskCounts hook for per-project active task counts"
```

---

## Task 2: Create Sidebar component

**Files:**
- Create: `src/shared/components/Sidebar.tsx`

- [ ] **Step 1: Create Sidebar**

Create `src/shared/components/Sidebar.tsx`:

```tsx
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useProjects } from '../../features/projects'
import { useThoughts } from '../../features/inbox'
import { useTaskCounts } from '../hooks/useTaskCounts'
import { NewProjectDrawer } from '../../features/projects/components/NewProjectDrawer'
import type { Project, ProjectStatus } from '../lib/types'

const STATUS_ORDER: { key: ProjectStatus; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'hold', label: 'On hold' },
  { key: 'idea', label: 'Idea' },
  { key: 'done', label: 'Done' },
]

export function Sidebar() {
  const { pathname } = useLocation()
  const { signOut } = useAuth()
  const { projects, addProject } = useProjects()
  const { count: inboxCount } = useThoughts()
  const { counts: taskCounts } = useTaskCounts()
  const [showNewProject, setShowNewProject] = useState(false)

  const pinned = projects.filter((p) => p.pinned)
  const unpinned = projects.filter((p) => !p.pinned)

  const groups = STATUS_ORDER.map(({ key, label }) => ({
    label,
    items: unpinned.filter((p) => p.status === key),
  })).filter((g) => g.items.length > 0)

  const isInboxActive = pathname === '/'

  function isProjectActive(project: Project) {
    return pathname === `/projects/${project.id}`
  }

  const linkBase = 'flex items-center gap-3 px-4 py-2 text-sm rounded-r-lg border-l-2 transition-colors'
  const linkActive = 'bg-[#2a2a4a] border-[#6c5ce7] text-white'
  const linkInactive = 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-[#2a2a4a]/50'

  function ProjectRow({ project }: { project: Project }) {
    const active = isProjectActive(project)
    const count = taskCounts[project.id] || 0
    return (
      <Link
        to={`/projects/${project.id}`}
        className={`${linkBase} ${active ? linkActive : linkInactive}`}
      >
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
        <span className="flex-1 truncate">{project.name}</span>
        {count > 0 && <span className="text-xs text-gray-500">{count}</span>}
      </Link>
    )
  }

  return (
    <>
      <aside className="w-64 border-r border-[#2a2a4a] flex flex-col bg-[#1a1a2e]">
        {/* App name */}
        <div className="px-4 py-4">
          <h1 className="text-lg font-bold">Huginn</h1>
        </div>

        {/* Inbox */}
        <Link
          to="/"
          className={`${linkBase} mx-0 mb-2 ${isInboxActive ? linkActive : linkInactive}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0">
            <path d="M3.5 9.5a1 1 0 0 1 1-1h15a1 1 0 0 1 1 1v8a2.5 2.5 0 0 1-2.5 2.5h-12A2.5 2.5 0 0 1 3.5 17.5v-8Zm1 3V17.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V12.5h-4.09a3.5 3.5 0 0 1-6.82 0H4.5Z" />
          </svg>
          <span className="flex-1">Inbox</span>
          {inboxCount > 0 && (
            <span className="text-xs bg-[#6c5ce7] text-white px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
              {inboxCount}
            </span>
          )}
        </Link>

        {/* Projects section */}
        <div className="flex items-center justify-between px-4 mt-2 mb-1">
          <span className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Projects</span>
          <button
            onClick={() => setShowNewProject(true)}
            className="text-gray-500 hover:text-white transition-colors"
            title="New project"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M10 3a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H4a1 1 0 1 1 0-2h5V4a1 1 0 0 1 1-1Z" />
            </svg>
          </button>
        </div>

        {/* Project list */}
        <div className="flex-1 overflow-y-auto pb-2">
          {/* Pinned */}
          {pinned.length > 0 && (
            <div className="mb-2">
              {pinned.map((p) => (
                <ProjectRow key={p.id} project={p} />
              ))}
            </div>
          )}

          {/* Grouped by status */}
          {groups.map((group) => (
            <div key={group.label} className="mb-2">
              {(groups.length > 1 || pinned.length > 0) && (
                <p className="text-[10px] uppercase tracking-wider text-gray-600 px-4 mb-1">{group.label}</p>
              )}
              {group.items.map((p) => (
                <ProjectRow key={p.id} project={p} />
              ))}
            </div>
          ))}

          {projects.length === 0 && (
            <p className="text-xs text-gray-600 px-4 py-2">No projects yet</p>
          )}
        </div>

        {/* Bottom */}
        <div className="border-t border-[#2a2a4a] px-4 py-3">
          <button
            onClick={signOut}
            className="text-xs text-gray-500 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* New project drawer */}
      {showNewProject && (
        <NewProjectDrawer
          onSave={async (name, color, status) => { await addProject(name, color, status) }}
          onDone={() => setShowNewProject(false)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd c:/Dropbox/Huginn/huginn && npx vite build
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/components/Sidebar.tsx
git commit -m "feat: add Sidebar with project list, inbox count, and task counts"
```

---

## Task 3: Make Layout responsive

**Files:**
- Modify: `src/shared/components/Layout.tsx`

- [ ] **Step 1: Update Layout to show sidebar on desktop, bottom nav on mobile**

Replace `src/shared/components/Layout.tsx`:

```tsx
import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'

export function Layout() {
  return (
    <div className="h-[100dvh] bg-[#1a1a2e] text-white flex">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <Outlet />
      </div>

      {/* Mobile bottom nav */}
      <div className="md:hidden">
        <BottomNav />
      </div>
    </div>
  )
}
```

Note: The outer div changes from `flex-col` to `flex` (horizontal on desktop). The `min-w-0` on the content area prevents flex overflow when content is wide. BottomNav wrapper needs `md:hidden` but the BottomNav renders inside a vertical flex context — we need to adjust:

Actually, the issue is that with `flex` (row direction), BottomNav won't be at the bottom. We need the content + BottomNav to stack vertically within the remaining space. Let me fix:

```tsx
import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'

export function Layout() {
  return (
    <div className="h-[100dvh] bg-[#1a1a2e] text-white flex">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <div className="flex-1 flex flex-col min-h-0">
          <Outlet />
        </div>
        {/* Mobile bottom nav */}
        <div className="md:hidden">
          <BottomNav />
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

- [ ] **Step 3: Commit**

```bash
git add src/shared/components/Layout.tsx
git commit -m "feat: make Layout responsive — sidebar on desktop, bottom nav on mobile"
```

---

## Task 4: Final verification

- [ ] **Step 1: Start dev server**

```bash
cd c:/Dropbox/Huginn/huginn && npm run dev
```

- [ ] **Step 2: Manual test checklist**

1. **Desktop (≥768px):** Sidebar visible on left (256px wide), bottom nav hidden
2. **Mobile (<768px):** Bottom nav visible at bottom, sidebar hidden
3. Sidebar shows "Huginn" title at top
4. Inbox link shows thought count in purple badge, highlighted with solid bg + purple left border when on `/`
5. Projects listed: pinned first, then grouped by Active, On hold, Idea, Done
6. Each project shows color dot + name + active task count
7. Click a project → navigates to `/projects/:id`, that row gets solid background + purple left border
8. Active state is clearly visible — stands out in a list of 5+ projects
9. "+" button next to "Projects" header opens NewProjectDrawer
10. New project appears in sidebar list after creation
11. Sign out at sidebar bottom works
12. Resize browser across 768px — layout switches smoothly between sidebar and bottom nav
13. InboxPage, ProjectsPage, ProjectDetailPage all still work correctly
14. Mobile bottom nav still works for switching between Inbox and Projects
