# Navigation Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Bold & Vibrant visual direction to all navigation components — gradient sidebar title, filled accent active states, bolder bottom nav, streamlined page headers, improved project tabs.

**Architecture:** Pure styling changes across 6 existing files. No behavior, layout structure, or prop changes. Each task replaces one component file with its polished version.

**Tech Stack:** React, TypeScript, Tailwind CSS (using huginn color tokens)

---

## Task 1: Polish Sidebar

**Files:**
- Modify: `src/shared/components/Sidebar.tsx`

- [ ] **Step 1: Replace Sidebar with polished version**

Replace the entire file `src/shared/components/Sidebar.tsx`. Key changes from current:
- Gradient "Huginn" title text
- Filled accent active state (rounded-lg mx-2) instead of left-border
- Larger icon (w-5), larger color dots (w-3 h-3)
- Purple "Projects" section label
- Better badge styling (white/20 bg when active)
- "+" button gets hover background

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

  function ProjectRow({ project }: { project: Project }) {
    const active = isProjectActive(project)
    const count = taskCounts[project.id] || 0
    return (
      <Link
        to={`/projects/${project.id}`}
        className={`flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg mx-2 transition-colors ${
          active
            ? 'bg-huginn-accent text-white'
            : 'text-gray-400 hover:bg-huginn-card hover:text-gray-200'
        }`}
      >
        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
        <span className="flex-1 truncate">{project.name}</span>
        {count > 0 && (
          <span className={`text-xs ${active ? 'text-white/70' : 'text-huginn-text-muted'}`}>{count}</span>
        )}
      </Link>
    )
  }

  return (
    <>
      <aside className="w-64 border-r border-huginn-border flex flex-col bg-huginn-base">
        {/* App name */}
        <div className="px-4 pt-5 pb-4">
          <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-huginn-accent to-[#a78bfa] bg-clip-text text-transparent">
            Huginn
          </h1>
        </div>

        {/* Inbox */}
        <Link
          to="/"
          className={`flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg mx-2 mb-2 transition-colors ${
            isInboxActive
              ? 'bg-huginn-accent text-white'
              : 'text-gray-400 hover:bg-huginn-card hover:text-gray-200'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0">
            <path d="M3.5 9.5a1 1 0 0 1 1-1h15a1 1 0 0 1 1 1v8a2.5 2.5 0 0 1-2.5 2.5h-12A2.5 2.5 0 0 1 3.5 17.5v-8Zm1 3V17.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V12.5h-4.09a3.5 3.5 0 0 1-6.82 0H4.5Z" />
          </svg>
          <span className="flex-1">Inbox</span>
          {inboxCount > 0 && (
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full min-w-[22px] text-center ${
              isInboxActive
                ? 'bg-white/20 text-white'
                : 'bg-huginn-accent text-white'
            }`}>
              {inboxCount}
            </span>
          )}
        </Link>

        {/* Projects section */}
        <div className="flex items-center justify-between px-4 mt-3 mb-2">
          <span className="text-xs font-bold uppercase tracking-widest text-huginn-accent">Projects</span>
          <button
            onClick={() => setShowNewProject(true)}
            className="text-gray-500 hover:text-white hover:bg-huginn-card rounded-md p-1 transition-colors"
            title="New project"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M10 3a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H4a1 1 0 1 1 0-2h5V4a1 1 0 0 1 1-1Z" />
            </svg>
          </button>
        </div>

        {/* Project list */}
        <div className="flex-1 overflow-y-auto pb-2">
          {pinned.length > 0 && (
            <div className="mb-2">
              {pinned.map((p) => (
                <ProjectRow key={p.id} project={p} />
              ))}
            </div>
          )}

          {groups.map((group) => (
            <div key={group.label} className="mb-2">
              {(groups.length > 1 || pinned.length > 0) && (
                <p className="text-[11px] font-semibold uppercase tracking-wider text-huginn-text-muted px-4 mb-1">{group.label}</p>
              )}
              {group.items.map((p) => (
                <ProjectRow key={p.id} project={p} />
              ))}
            </div>
          ))}

          {projects.length === 0 && (
            <p className="text-xs text-huginn-text-muted px-4 py-2">No projects yet</p>
          )}
        </div>

        {/* Bottom */}
        <div className="border-t border-huginn-border px-4 py-3">
          <button
            onClick={signOut}
            className="text-xs text-gray-500 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

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

- [ ] **Step 2: Verify build + commit**

```bash
cd c:/Dropbox/Huginn/huginn && npx vite build
git add src/shared/components/Sidebar.tsx
git commit -m "style: polish Sidebar with gradient title, filled accent active states"
```

---

## Task 2: Polish BottomNav

**Files:**
- Modify: `src/shared/components/BottomNav.tsx`

- [ ] **Step 1: Replace BottomNav with polished version**

```tsx
import { Link, useLocation } from 'react-router-dom'

export function BottomNav() {
  const { pathname } = useLocation()
  const isInbox = pathname === '/'
  const isProjects = pathname.startsWith('/projects')

  return (
    <nav className="flex border-t border-huginn-border bg-huginn-base pb-[env(safe-area-inset-bottom,0px)]">
      <Link
        to="/"
        className={`flex-1 flex flex-col items-center py-3 gap-1 relative ${
          isInbox ? 'text-huginn-accent' : 'text-gray-500'
        }`}
      >
        {isInbox && <span className="w-1 h-1 rounded-full bg-huginn-accent absolute top-1.5" />}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
          <path d="M3.5 9.5a1 1 0 0 1 1-1h15a1 1 0 0 1 1 1v8a2.5 2.5 0 0 1-2.5 2.5h-12A2.5 2.5 0 0 1 3.5 17.5v-8Zm1 3V17.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V12.5h-4.09a3.5 3.5 0 0 1-6.82 0H4.5Z" />
        </svg>
        <span className="text-[11px] font-bold">Inbox</span>
      </Link>
      <Link
        to="/projects"
        className={`flex-1 flex flex-col items-center py-3 gap-1 relative ${
          isProjects ? 'text-huginn-accent' : 'text-gray-500'
        }`}
      >
        {isProjects && <span className="w-1 h-1 rounded-full bg-huginn-accent absolute top-1.5" />}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
          <path d="M4 4a2 2 0 0 0-2 2v1h20V6a2 2 0 0 0-2-2h-6.18a2 2 0 0 1-1.41-.59l-.83-.82A2 2 0 0 0 10.18 2H4Zm-2 5v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9H2Z" />
        </svg>
        <span className="text-[11px] font-bold">Projects</span>
      </Link>
    </nav>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/components/BottomNav.tsx
git commit -m "style: polish BottomNav with active dot, bolder labels, better spacing"
```

---

## Task 3: Polish page headers (InboxPage, ProjectsPage, ProjectDetailPage)

**Files:**
- Modify: `src/pages/InboxPage.tsx`
- Modify: `src/pages/ProjectsPage.tsx`
- Modify: `src/pages/ProjectDetailPage.tsx`

- [ ] **Step 1: Update InboxPage header**

In `src/pages/InboxPage.tsx`, find the header section (around lines 49-64) and replace it:

Find:
```tsx
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-huginn-border">
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
```

Replace with:
```tsx
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-huginn-border">
        <div>
          <h1 className="text-lg font-extrabold tracking-tight">Inbox</h1>
          <p className="text-xs text-huginn-text-secondary">
            {count} thought{count !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={signOut}
          className="text-xs text-gray-500 hover:text-white md:hidden"
        >
          Sign out
        </button>
      </header>
```

- [ ] **Step 2: Update ProjectsPage header**

In `src/pages/ProjectsPage.tsx`, find the header and replace it. Find:
```tsx
      <header className="flex items-center justify-between px-4 py-3 border-b border-huginn-border">
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
```

Replace with:
```tsx
      <header className="flex items-center justify-between px-4 py-3 border-b border-huginn-border">
        <div>
          <h1 className="text-lg font-extrabold tracking-tight">Projects</h1>
          <p className="text-xs text-huginn-text-secondary">
            {count} project{count !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={signOut}
          className="text-xs text-gray-500 hover:text-white md:hidden"
        >
          Sign out
        </button>
      </header>
```

- [ ] **Step 3: Verify build + commit**

```bash
cd c:/Dropbox/Huginn/huginn && npx vite build
git add src/pages/InboxPage.tsx src/pages/ProjectsPage.tsx
git commit -m "style: polish page headers — bold titles, hide sign-out on desktop"
```

---

## Task 4: Polish ProjectTabs

**Files:**
- Modify: `src/features/projects/components/ProjectTabs.tsx`

- [ ] **Step 1: Replace ProjectTabs with polished version**

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
    <div className="flex border-b border-huginn-border">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onTabChange(tab.value)}
          className={`flex-1 py-3 text-sm transition-colors ${
            activeTab === tab.value
              ? 'text-white font-bold border-b-2 border-huginn-accent bg-huginn-accent/5'
              : 'text-gray-500 font-medium hover:text-gray-300 hover:bg-huginn-card/30'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/projects/components/ProjectTabs.tsx
git commit -m "style: polish ProjectTabs with accent tint and bolder active state"
```

---

## Task 5: Final verification

- [ ] **Step 1: Build check**

```bash
cd c:/Dropbox/Huginn/huginn && npx vite build
```

- [ ] **Step 2: Manual test checklist**

1. **Sidebar (desktop):** "Huginn" shows gradient purple text. Inbox active = filled purple rounded rectangle. Projects active = same. Purple "Projects" section label. Hover states on inactive items.
2. **Bottom nav (mobile):** Taller touch targets (`py-3`), bold labels, active dot above active icon.
3. **InboxPage header:** Says "Inbox" (not "Huginn"). Sign-out hidden on desktop, visible on mobile.
4. **ProjectsPage header:** Says "Projects" with bold styling. Sign-out hidden on desktop.
5. **Project tabs:** Active tab has purple underline + subtle purple bg tint. Inactive has hover state.
6. **Responsive:** Resize across 768px — sidebar/bottom-nav switch smooth, headers adapt.
