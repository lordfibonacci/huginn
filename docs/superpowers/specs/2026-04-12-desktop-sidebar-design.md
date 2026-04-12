# Desktop Sidebar — Design Spec

## Context

Huginn uses a mobile bottom nav for navigation. On desktop, this wastes space and doesn't show project context. This spec replaces the bottom nav with a persistent left sidebar on desktop (≥768px) while keeping the bottom nav on mobile.

## Scope

**New files:**
- `src/shared/components/Sidebar.tsx` — desktop sidebar navigation
- `src/shared/hooks/useTaskCounts.ts` — single query for task counts per project

**Modified files:**
- `src/shared/components/Layout.tsx` — responsive: sidebar on desktop, bottom nav on mobile

## Layout.tsx Refactor

The Layout becomes responsive using Tailwind's `md:` breakpoint:

**Desktop (≥768px):** Horizontal flex row — Sidebar (fixed 256px, `w-64`) on the left, content area (`flex-1`) on the right. No BottomNav.

**Mobile (<768px):** Vertical flex column — content area fills space, BottomNav at bottom. No Sidebar.

```
Desktop:                    Mobile:
┌──────────┬────────────┐   ┌────────────────────┐
│          │            │   │                    │
│ Sidebar  │  <Outlet>  │   │     <Outlet>       │
│  256px   │            │   │                    │
│          │            │   ├────────────────────┤
└──────────┴────────────┘   │    BottomNav       │
                            └────────────────────┘
```

Implementation: Render both Sidebar and BottomNav in the JSX. Use `hidden md:flex` on Sidebar and `md:hidden` on BottomNav. CSS handles the switch, no JS media queries.

## Sidebar Component

**File:** `src/shared/components/Sidebar.tsx`

Fixed 256px wide, full height, dark background (`bg-[#1a1a2e]`), right border (`border-r border-[#2a2a4a]`). Internal layout: flex column, scrollable project list.

### Section 1: App Name
- "Huginn" in bold, `text-lg`, padded `px-4 py-4`

### Section 2: Inbox Link
- Uses `<Link to="/">` from React Router
- Icon (same inbox SVG as BottomNav) + "Inbox" text + count badge (right-aligned)
- Count badge: small rounded pill showing `useThoughts().count`
- **Active state:** When `pathname === '/'`: solid background `bg-[#2a2a4a]`, left border `border-l-2 border-[#6c5ce7]`, white text. Inactive: transparent bg, gray text.

### Section 3: Projects List
- Section header: "Projects" — small uppercase gray text (`text-[11px] uppercase tracking-wider text-gray-500`)
- Projects grouped in order: **Pinned** first (if any), then **Active**, **On hold**, **Idea**, **Done**
- Group labels only shown if the group has projects and there are multiple groups with items
- Each project row: colored dot (project.color) + project name + active task count (gray, right-aligned). Uses `<Link to={/projects/${project.id}}>`.
- **Active state:** When `pathname === /projects/${project.id}`: solid background `bg-[#2a2a4a]`, left border `border-l-2 border-[#6c5ce7]`, white text. Inactive: transparent bg, gray text.
- Scrollable if list is long (`overflow-y-auto flex-1`)

### Section 4: Bottom Actions
- "+" New Project button — opens NewProjectDrawer (same as ProjectsPage uses). Small text link or icon button.
- Sign out link — small gray text at the very bottom

### Data Requirements
- `useProjects()` — for project list
- `useThoughts()` — for inbox count (`.count`)
- `useTaskCounts()` — for per-project active task counts

### Sidebar needs to trigger NewProjectDrawer
The Sidebar manages its own `showNewProject` state and renders `NewProjectDrawer` when true. The `onSave` calls `addProject` from `useProjects()`.

## useTaskCounts Hook

**File:** `src/shared/hooks/useTaskCounts.ts`

Single Supabase query that returns a map of project_id → count of non-done tasks.

```ts
// Fetches: SELECT project_id, count(*) FROM huginn_tasks WHERE status != 'done' GROUP BY project_id
// Returns: { counts: Record<string, number>, loading: boolean }
```

Uses Supabase's RPC or a grouped select. Since Supabase JS doesn't directly support GROUP BY, use `.rpc()` with a simple SQL function, or fetch all tasks and count client-side (simpler for now — task count is small). Recommended: fetch all non-done tasks with `.select('project_id')` and count in JS.

## Active State Styling

The active state must be **immediately obvious** even with 10+ projects. Design:

```
Inactive:   │  ● Project Name        3
Active:     █  ● Project Name        3   ← bg-[#2a2a4a] + left purple border
```

- Active: `bg-[#2a2a4a] border-l-2 border-[#6c5ce7] text-white`
- Inactive: `border-l-2 border-transparent text-gray-400 hover:text-gray-200 hover:bg-[#2a2a4a]/50`

Same pattern for Inbox link.

## Verification

1. Desktop (≥768px): sidebar visible on left, bottom nav hidden
2. Mobile (<768px): bottom nav visible, sidebar hidden
3. Sidebar shows "Huginn" title at top
4. Inbox link shows thought count, highlighted when on `/`
5. Projects listed grouped by status (pinned first, then active, hold, idea, done)
6. Each project shows color dot + name + active task count
7. Clicking a project navigates to `/projects/:id`, that project row highlights
8. Active state is clearly visible — solid background + purple left border
9. "+" button opens NewProjectDrawer, new project appears in sidebar list
10. Sign out works from sidebar
11. Resize browser window across 768px breakpoint — layout switches smoothly
