# Design Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish Tailwind color tokens, base styles, and migrate all 27 component files from hardcoded hex values to semantic token classes — the foundation for the Bold & Vibrant visual redesign.

**Architecture:** Create `tailwind.config.ts` with `huginn.*` color tokens. Update `index.css` with scrollbar/selection styles. Then systematically replace every hardcoded hex color in every component with its corresponding token class. Pure styling change — no behavior or layout modifications.

**Tech Stack:** Tailwind CSS 4, React, TypeScript

---

## Task 1: Create Tailwind config + update base styles

**Files:**
- Create: `tailwind.config.ts`
- Modify: `src/index.css`

- [ ] **Step 1: Create tailwind.config.ts**

Create `tailwind.config.ts` at project root:

```ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        huginn: {
          base: '#12122a',
          surface: '#161630',
          card: '#1e1e3e',
          hover: '#242450',
          border: '#2a2a4a',
          accent: '#6c5ce7',
          'accent-hover': '#5b4bd5',
          'accent-soft': 'rgba(108,92,231,0.15)',
          success: '#00b894',
          warning: '#fdcb6e',
          danger: '#e17055',
          'text-primary': '#e8e8f0',
          'text-secondary': '#888888',
          'text-muted': '#555555',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
```

- [ ] **Step 2: Update index.css with base styles**

Replace `src/index.css` with:

```css
@import "tailwindcss";

/* Dark scrollbars */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #2a2a4a; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #3a3a5a; }

/* Selection */
::selection { background: rgba(108, 92, 231, 0.3); }
```

- [ ] **Step 3: Verify build**

```bash
cd c:/Dropbox/Huginn/huginn && npx vite build
```

Expected: builds successfully. Tailwind picks up the config automatically.

- [ ] **Step 4: Commit**

```bash
git add tailwind.config.ts src/index.css
git commit -m "feat: add Tailwind config with huginn color tokens and base styles"
```

---

## Task 2: Migrate shared components (Layout, Sidebar, BottomNav)

**Files:**
- Modify: `src/shared/components/Layout.tsx`
- Modify: `src/shared/components/Sidebar.tsx`
- Modify: `src/shared/components/BottomNav.tsx`

- [ ] **Step 1: Migrate Layout.tsx**

In `src/shared/components/Layout.tsx`, replace all hardcoded colors:

Replace `bg-[#1a1a2e]` with `bg-huginn-surface`

The full file becomes:

```tsx
import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'

export function Layout() {
  return (
    <div className="h-[100dvh] bg-huginn-surface text-white flex">
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

- [ ] **Step 2: Migrate BottomNav.tsx**

Replace `src/shared/components/BottomNav.tsx` — swap all hex colors:

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
        className={`flex-1 flex flex-col items-center py-2 gap-0.5 ${
          isInbox ? 'text-huginn-accent' : 'text-gray-500'
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
          isProjects ? 'text-huginn-accent' : 'text-gray-500'
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

- [ ] **Step 3: Migrate Sidebar.tsx**

In `src/shared/components/Sidebar.tsx`, apply these replacements globally:

- `bg-[#1a1a2e]` → `bg-huginn-base`
- `border-[#2a2a4a]` → `border-huginn-border`
- `bg-[#2a2a4a]` → `bg-huginn-card`
- `bg-[#6c5ce7]` → `bg-huginn-accent`
- `text-[#6c5ce7]` → `text-huginn-accent`
- `border-[#6c5ce7]` → `border-huginn-accent`
- `hover:bg-[#2a2a4a]/50` → `hover:bg-huginn-card/50`
- `text-[11px]` stays (typography, not color)

The `linkActive` and `linkInactive` class strings become:
```ts
const linkActive = 'bg-huginn-card border-huginn-accent text-white'
const linkInactive = 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-huginn-card/50'
```

The aside className becomes: `w-64 border-r border-huginn-border flex flex-col bg-huginn-base`

Inbox badge: `bg-huginn-accent` (already was `bg-[#6c5ce7]`)

- [ ] **Step 4: Verify build + commit**

```bash
cd c:/Dropbox/Huginn/huginn && npx vite build
git add src/shared/components/Layout.tsx src/shared/components/Sidebar.tsx src/shared/components/BottomNav.tsx
git commit -m "style: migrate shared components to huginn color tokens"
```

---

## Task 3: Migrate pages (InboxPage, ProjectsPage, ProjectDetailPage, LoginPage)

**Files:**
- Modify: `src/pages/InboxPage.tsx`
- Modify: `src/pages/ProjectsPage.tsx`
- Modify: `src/pages/ProjectDetailPage.tsx`
- Modify: `src/pages/LoginPage.tsx`

- [ ] **Step 1: Migrate all page files**

Apply these replacements across all 4 page files:

- `bg-[#1a1a2e]` → `bg-huginn-surface`
- `bg-[#2a2a4a]` → `bg-huginn-card`
- `border-[#2a2a4a]` → `border-huginn-border`
- `bg-[#6c5ce7]` → `bg-huginn-accent`
- `active:bg-[#5b4bd5]` → `active:bg-huginn-accent-hover`
- `focus:ring-[#6c5ce7]` → `focus:ring-huginn-accent`

**InboxPage.tsx:** `border-huginn-border` on header border.

**ProjectsPage.tsx:** Same header border + FAB button uses `bg-huginn-accent`, `active:bg-huginn-accent-hover`, `shadow-lg`.

**ProjectDetailPage.tsx:** Header border, tabs rendered by ProjectTabs (migrated separately).

**LoginPage.tsx:** Background `bg-huginn-surface`, inputs `bg-huginn-card`, button `bg-huginn-accent`, focus rings `focus:ring-huginn-accent`.

- [ ] **Step 2: Verify build + commit**

```bash
cd c:/Dropbox/Huginn/huginn && npx vite build
git add src/pages/InboxPage.tsx src/pages/ProjectsPage.tsx src/pages/ProjectDetailPage.tsx src/pages/LoginPage.tsx
git commit -m "style: migrate page components to huginn color tokens"
```

---

## Task 4: Migrate inbox feature components

**Files:**
- Modify: `src/features/inbox/components/ThoughtCard.tsx`
- Modify: `src/features/inbox/components/ThoughtInput.tsx`
- Modify: `src/features/inbox/components/ThoughtList.tsx`
- Modify: `src/features/inbox/components/ThoughtDetailDrawer.tsx`
- Modify: `src/features/inbox/components/ClassifyDrawer.tsx`
- Modify: `src/features/inbox/components/VoiceButton.tsx`
- Modify: `src/features/inbox/components/FilterBar.tsx`

- [ ] **Step 1: Migrate all 7 inbox component files**

Apply the standard color replacement across all files:

- `bg-[#1a1a2e]` → `bg-huginn-surface`
- `bg-[#2a2a4a]` → `bg-huginn-card`
- `active:bg-[#3a3a5a]` → `active:bg-huginn-hover`
- `hover:bg-[#3a3a5a]` → `hover:bg-huginn-hover`
- `bg-[#6c5ce7]` → `bg-huginn-accent`
- `hover:bg-[#5b4bd5]` → `hover:bg-huginn-accent-hover`
- `bg-[#00b894]` → `bg-huginn-success`
- `border-[#2a2a4a]` → `border-huginn-border`
- `focus:ring-[#6c5ce7]` → `focus:ring-huginn-accent`
- `text-[#6c5ce7]` → `text-huginn-accent`
- `bg-[#6c5ce7]/10` → `bg-huginn-accent/10`
- `bg-[#6c5ce7]/20` → `bg-huginn-accent/20`

**ThoughtCard.tsx specific:**
- `bg-[#e17055]` in PRIORITY_COLORS → `bg-huginn-danger`
- `bg-[#fdcb6e]` in PRIORITY_COLORS → `bg-huginn-warning`
- `text-[#e17055]` → `text-huginn-danger`

**ThoughtDetailDrawer.tsx specific:**
- Priority option colors: `bg-gray-500` stays (it's Tailwind built-in), `bg-[#fdcb6e]` → `bg-huginn-warning`, `bg-[#e17055]` → `bg-huginn-danger`

**VoiceButton.tsx specific:**
- `bg-[#6c5ce7]` → `bg-huginn-accent`
- `hover:bg-[#5b4bd5]` → `hover:bg-huginn-accent-hover`

**FilterBar.tsx specific:**
- Active chip: `bg-[#6c5ce7]` → `bg-huginn-accent`
- Inactive chip: `bg-[#2a2a4a]` → `bg-huginn-card`
- Hover: `hover:bg-[#3a3a5a]` → `hover:bg-huginn-hover`

- [ ] **Step 2: Verify build + commit**

```bash
cd c:/Dropbox/Huginn/huginn && npx vite build
git add src/features/inbox/components/
git commit -m "style: migrate inbox components to huginn color tokens"
```

---

## Task 5: Migrate projects feature components

**Files:**
- Modify: `src/features/projects/components/TaskCard.tsx`
- Modify: `src/features/projects/components/TaskList.tsx`
- Modify: `src/features/projects/components/TaskDetailDrawer.tsx`
- Modify: `src/features/projects/components/NewTaskDrawer.tsx`
- Modify: `src/features/projects/components/ProjectCard.tsx`
- Modify: `src/features/projects/components/ProjectList.tsx`
- Modify: `src/features/projects/components/ProjectTabs.tsx`
- Modify: `src/features/projects/components/NewProjectDrawer.tsx`
- Modify: `src/features/projects/components/NoteCard.tsx`
- Modify: `src/features/projects/components/NoteList.tsx`
- Modify: `src/features/projects/components/NoteDetailDrawer.tsx`
- Modify: `src/features/projects/components/NewNoteDrawer.tsx`
- Modify: `src/features/projects/components/ProjectSettingsDrawer.tsx`

- [ ] **Step 1: Migrate all 13 project component files**

Apply the same standard replacements as Task 4 across all files:

- `bg-[#1a1a2e]` → `bg-huginn-surface`
- `bg-[#2a2a4a]` → `bg-huginn-card`
- `active:bg-[#3a3a5a]` → `active:bg-huginn-hover`
- `hover:bg-[#3a3a5a]` → `hover:bg-huginn-hover`
- `bg-[#6c5ce7]` → `bg-huginn-accent`
- `hover:bg-[#5b4bd5]` → `hover:bg-huginn-accent-hover`
- `bg-[#00b894]` → `bg-huginn-success`
- `border-[#2a2a4a]` → `border-huginn-border`
- `border-[#6c5ce7]` → `border-huginn-accent`
- `focus:ring-[#6c5ce7]` → `focus:ring-huginn-accent`
- `text-[#6c5ce7]` → `text-huginn-accent`
- `bg-[#6c5ce7]/10` → `bg-huginn-accent/10`
- `bg-[#6c5ce7]/20` → `bg-huginn-accent/20`
- `bg-[#e17055]` → `bg-huginn-danger`
- `bg-[#fdcb6e]` → `bg-huginn-warning`
- `text-[#e17055]` → `text-huginn-danger`

**TaskCard.tsx specific:**
- STATUS_COLORS: `border-[#6c5ce7]` → `border-huginn-accent`, `bg-[#6c5ce7]` → `bg-huginn-accent`, `border-[#00b894]` → `border-huginn-success`, `bg-[#00b894]` → `bg-huginn-success`
- PRIORITY_COLORS: `bg-[#e17055]` → `bg-huginn-danger`, `bg-[#fdcb6e]` → `bg-huginn-warning`

**TaskList.tsx specific:**
- `bg-[#2a2a4a]/30` → `bg-huginn-card/30` (droppable column highlight)

**ProjectTabs.tsx specific:**
- `border-[#6c5ce7]` → `border-huginn-accent` (active tab underline)
- `border-[#2a2a4a]` → `border-huginn-border`

**All drawer files** follow the same pattern as ThoughtDetailDrawer.

- [ ] **Step 2: Verify build + commit**

```bash
cd c:/Dropbox/Huginn/huginn && npx vite build
git add src/features/projects/components/
git commit -m "style: migrate project components to huginn color tokens"
```

---

## Task 6: Verify no hardcoded hex values remain + final build

- [ ] **Step 1: Search for remaining hardcoded colors**

```bash
cd c:/Dropbox/Huginn/huginn && grep -r "#1a1a2e\|#2a2a4a\|#6c5ce7\|#5b4bd5\|#3a3a5a\|#e17055\|#fdcb6e\|#00b894" src/ --include="*.tsx" --include="*.ts" -l
```

Expected: no files found (all replaced with tokens). If any remain, fix them.

Note: `style={{ backgroundColor: project.color }}` and similar dynamic inline styles are OK — these use runtime values from the database, not hardcoded design tokens.

- [ ] **Step 2: Full build verification**

```bash
npx vite build
```

Expected: zero errors.

- [ ] **Step 3: Start dev server and spot-check**

```bash
npm run dev
```

Check:
1. Inbox page renders with slightly richer/deeper color palette
2. Sidebar colors are consistent
3. Cards, drawers, inputs all use the new token colors
4. No visual regressions (everything should look similar but subtly richer)

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "style: fix remaining hardcoded colors missed in migration"
```

(Skip this commit if grep found nothing in Step 1.)
