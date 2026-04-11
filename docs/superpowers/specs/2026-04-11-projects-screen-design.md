# Projects Screen + Bottom Nav — Design Spec

## Context

Huginn currently has a single Inbox screen. Users need a Projects screen to view and create projects, and a bottom navigation bar to switch between Inbox and Projects. This spec adds a shared Layout with bottom nav, a Projects list page, a new-project drawer, and a placeholder project detail page.

## Scope

**New files:**
- `src/shared/components/Layout.tsx` — authenticated layout with bottom nav
- `src/shared/components/BottomNav.tsx` — two-tab navigation bar
- `src/features/projects/hooks/useProjects.ts` — project CRUD hook
- `src/features/projects/components/ProjectCard.tsx` — single project item
- `src/features/projects/components/ProjectList.tsx` — grouped project list
- `src/features/projects/components/NewProjectDrawer.tsx` — create project drawer
- `src/features/projects/index.ts` — barrel exports
- `src/pages/ProjectsPage.tsx` — projects list page
- `src/pages/ProjectDetailPage.tsx` — placeholder detail page

**Modified files:**
- `src/app/routes.tsx` — nested routing with Layout wrapper
- `src/pages/InboxPage.tsx` — remove outer height container (Layout handles it)

## Shared Layout

### Layout.tsx

**File:** `src/shared/components/Layout.tsx`

- Full-height flex column using `h-[100dvh]`
- Renders `<Outlet />` from React Router in a `flex-1 flex flex-col overflow-hidden` container
- Renders `<BottomNav />` pinned at the bottom
- Dark background (#1a1a2e)

### BottomNav.tsx

**File:** `src/shared/components/BottomNav.tsx`

- Two tabs: Inbox (`/`) and Projects (`/projects`)
- Each tab: SVG icon + label text below it
- Active tab: purple text and icon (#6c5ce7), inactive: gray (#6b7280)
- Uses `useLocation()` to determine active state. Inbox is active when path is `/`, Projects is active when path starts with `/projects`
- `pb-[env(safe-area-inset-bottom,0px)]` for notched devices
- Border-top separator (#2a2a4a), same as existing header borders
- Tabs use `<Link>` from React Router (not buttons)

**Icons:**
- Inbox: simple inbox/tray SVG icon
- Projects: simple folder SVG icon

## Routes Refactor

**File:** `src/app/routes.tsx`

Change from flat routes to nested:

```
<BrowserRouter>
  <Routes>
    <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
    <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
      <Route index element={<InboxPage />} />
      <Route path="projects" element={<ProjectsPage />} />
      <Route path="projects/:id" element={<ProjectDetailPage />} />
    </Route>
  </Routes>
</BrowserRouter>
```

ProtectedRoute wraps Layout. Layout renders Outlet + BottomNav. Child routes render inside the Outlet.

## InboxPage Adjustment

**File:** `src/pages/InboxPage.tsx`

Remove `h-[100dvh]` from the root div. Change to `flex-1 flex flex-col min-h-0` so it fills the Layout's content area without fighting for height. The `bg-[#1a1a2e]` can also be removed since Layout provides it.

## Projects Feature

### useProjects Hook

**File:** `src/features/projects/hooks/useProjects.ts`

**State:** `projects: Project[]`, `loading: boolean`

**fetchProjects:** Fetches all projects for the current user from `huginn_projects`, ordered by `name`.

**addProject(name, color, status):**
- Gets current user via `supabase.auth.getUser()`
- Optimistic: creates a temporary Project object, adds to list
- Supabase: inserts into `huginn_projects` with `{ name, color, status, user_id }`
- On success: replaces optimistic item with server response
- On error: rolls back

**Returns:** `{ projects, loading, addProject }`

### ProjectCard.tsx

**File:** `src/features/projects/components/ProjectCard.tsx`

**Props:** `project: Project`, `onClick?: () => void`

- Displays project name with a colored dot (12px circle using the project's `color` field) to the left
- Tappable with cursor-pointer and active state feedback (same pattern as ThoughtCard)
- Shows project status as a small text badge if not 'active'

### ProjectList.tsx

**File:** `src/features/projects/components/ProjectList.tsx`

**Props:** `projects: Project[]`, `loading: boolean`, `onProjectTap: (project: Project) => void`

- Groups projects by status in this display order: Active, On hold, Idea, Done
- Each group has a heading (uppercase, small, gray text) and only shows if it has projects
- Empty state: "No projects yet. Tap + to create one."
- Loading state: "Loading..."
- Scrollable container

### NewProjectDrawer.tsx

**File:** `src/features/projects/components/NewProjectDrawer.tsx`

**Props:** `onSave: (name: string, color: string, status: ProjectStatus) => Promise<void>`, `onDone: () => void`

- Same bottom drawer pattern as ClassifyDrawer (slide-up, backdrop dismiss, 200ms animation)
- Three fields:
  1. **Name:** text input, placeholder "Project name", required
  2. **Color:** row of 8 preset color swatches (small circles). Tap to select; selected swatch gets a white ring/border. Default: first color.
  3. **Status:** chip selector (idea/active/hold/done), default: 'active'
- Save button (purple, disabled when name is empty)
- "Cancel" button dismisses

**Preset colors:** `#6c5ce7`, `#00b894`, `#fdcb6e`, `#e17055`, `#0984e3`, `#e84393`, `#636e72`, `#2d3436`

### Barrel Export

**File:** `src/features/projects/index.ts`

Exports: `ProjectList`, `ProjectCard`, `NewProjectDrawer`, `useProjects`

## Pages

### ProjectsPage.tsx

**File:** `src/pages/ProjectsPage.tsx`

- Header: "Projects" title + project count + sign-out button (same pattern as InboxPage header)
- ProjectList in scrollable area
- Floating "+" button: fixed position, bottom-right corner, positioned above the bottom nav. Purple circle (#6c5ce7), white plus icon. Opens NewProjectDrawer.
- NewProjectDrawer rendered conditionally when `showNewProject` state is true

### ProjectDetailPage.tsx

**File:** `src/pages/ProjectDetailPage.tsx`

- Reads `:id` from URL params via `useParams()`
- Fetches the single project from Supabase on mount
- Shows: header with back arrow (links to `/projects`) and project name, colored dot
- Body: project description or "No description" placeholder
- This is a placeholder — will be built out later

## Verification

1. Bottom nav appears on Inbox, Projects list, and Project detail pages
2. Bottom nav does NOT appear on login page
3. Active tab is highlighted correctly when switching between Inbox and Projects
4. Projects page shows grouped list (Active, On hold, Idea, Done headings)
5. Tap "+" → NewProjectDrawer slides up with name, color swatches, status chips
6. Fill name, pick color, tap Save → project appears in list
7. Tap a project → navigates to `/projects/:id` showing name and description
8. Back arrow on detail page returns to `/projects`
9. InboxPage still works correctly (thought input, voice, classify, edit drawers)
10. Mobile viewport: bottom nav fits, no overflow, safe-area respected
