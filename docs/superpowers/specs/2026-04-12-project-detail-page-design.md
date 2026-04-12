# Project Detail Page — Design Spec

## Context

Huginn has a Projects list but tapping a project shows only its name and description. This spec builds out the full project detail page with three tabs (Thoughts, Tasks, Notes), project settings editing, and task management with a responsive kanban/list layout.

## Scope

**New files (features/projects/):**
- `components/ProjectTabs.tsx` — tab bar (Thoughts, Tasks, Notes)
- `components/ProjectSettingsDrawer.tsx` — edit/delete project
- `components/TaskCard.tsx` — single task item
- `components/TaskList.tsx` — kanban on desktop, grouped sections on mobile
- `components/TaskDetailDrawer.tsx` — edit task
- `components/NewTaskDrawer.tsx` — create task
- `components/NoteCard.tsx` — single note item
- `components/NoteList.tsx` — note list
- `components/NoteDetailDrawer.tsx` — edit note
- `components/NewNoteDrawer.tsx` — create note
- `hooks/useProjectTasks.ts` — task CRUD for a project
- `hooks/useProjectNotes.ts` — note CRUD for a project

**Modified files:**
- `src/features/projects/hooks/useProjects.ts` — add updateProject, deleteProject
- `src/features/projects/index.ts` — expanded exports
- `src/pages/ProjectDetailPage.tsx` — full rebuild

**No database migrations.** `huginn_tasks` and `huginn_notes` tables already exist with the correct schema.

## Page Layout

### Header
- Back arrow linking to `/projects`
- Colored dot (project color)
- Project name (text, not editable inline)
- Gear icon at right → opens ProjectSettingsDrawer

### Tab Bar (ProjectTabs)
Three tabs: **Thoughts** | **Tasks** | **Notes**

- Active tab: white text + purple underline (#6c5ce7, 2px bottom border)
- Inactive tab: gray text
- Fixed below header, does not scroll with content
- Default active tab: Tasks (since this is where work happens)

### Content Area
Each tab renders its own list component. A floating "+" button appears on the Tasks and Notes tabs (not Thoughts — thoughts are captured via inbox).

## Thoughts Tab

Shows thoughts filed to this project: `huginn_thoughts` where `project_id = :id` and `status != 'archived'`, ordered by `created_at DESC`.

- Reuses existing `ThoughtCard` component from `features/inbox`
- Tapping a thought opens `ThoughtDetailDrawer` (also from features/inbox)
- Needs `useThoughts`-like fetch but scoped to project. Use a direct Supabase query within ProjectDetailPage rather than creating a separate hook — keeps it simple since this is read-only (editing uses the existing ThoughtDetailDrawer which handles its own Supabase calls).

## Tasks Tab

### Data: useProjectTasks(projectId) Hook

**State:** `tasks: Task[]`, `loading: boolean`

**fetchTasks:** Fetches from `huginn_tasks` where `project_id = :id`, ordered by `created_at DESC`.

**addTask(title):** Creates task with `status: 'todo'`, `project_id`, `user_id`. Optimistic update.

**updateTask(id, updates):** Updates task fields (title, notes, status, priority, due_date). Optimistic with rollback. The `updates` param: `{ title?: string; notes?: string; status?: TaskStatus; due_date?: string | null }`.

**deleteTask(id):** Deletes task. Optimistic with rollback.

**Returns:** `{ tasks, loading, addTask, updateTask, deleteTask }`

### Desktop Layout (≥768px): Kanban Columns

Three columns side-by-side: **Todo** | **Doing** | **Done**

Each column:
- Header: status label + task count
- Vertical scrollable list of TaskCards
- Column is a container div with a data attribute or prop indicating its status — designed so dnd-kit can wrap each column as a droppable zone and each card as a draggable item in the future

Architecture note: The kanban renders from a `columns` array derived from tasks grouped by status. Each column maps `{ status, label, tasks[] }`. This data-driven approach means adding drag-and-drop later is a matter of wrapping the existing structure with dnd-kit's `DndContext`, `SortableContext`, and `useSortable` — no restructuring needed.

### Mobile Layout (<768px): Grouped Sections

Three collapsible sections: **Todo** | **Doing** | **Done**

Each section:
- Header: status label + count + chevron toggle
- Collapsed by default for Done
- Task cards listed vertically

Responsive switch: Use a `useMediaQuery` check or Tailwind's `md:` breakpoint via a simple `window.innerWidth >= 768` check in the component.

### TaskCard

Shows: title, optional due date (same formatDueDate as ThoughtCard), status indicator. Tap to open TaskDetailDrawer.

Styled as a draggable-ready card (has a data-task-id attribute, clean boundaries).

### NewTaskDrawer

Triggered by "+" button on Tasks tab.

- Title input (required)
- Save button (disabled when empty)
- Same drawer pattern (slide-up, backdrop dismiss)

Creates task with `status: 'todo'` in the current project.

### TaskDetailDrawer

Triggered by tapping a task card.

- Title input (editable)
- Notes textarea (optional)
- Status chips: Todo / Doing / Done
- Due date input with clear button
- Delete button (red, 2-tap confirm)
- Save button

Same drawer pattern as ThoughtDetailDrawer.

## Notes Tab

### Data: useProjectNotes(projectId) Hook

**State:** `notes: Note[]`, `loading: boolean`

**fetchNotes:** Fetches from `huginn_notes` where `project_id = :id`, ordered by `created_at DESC`.

**addNote(title, body):** Creates note with `project_id`, `user_id`. Optimistic update.

**updateNote(id, updates):** Updates note fields (title, body). Optimistic with rollback.

**deleteNote(id):** Deletes note. Optimistic with rollback.

**Returns:** `{ notes, loading, addNote, updateNote, deleteNote }`

### NoteCard

Shows: title (or first 50 chars of body if no title), timestamp. Tap to open NoteDetailDrawer.

### NewNoteDrawer

Triggered by "+" button on Notes tab.

- Title input (optional)
- Body textarea (required)
- Save button

### NoteDetailDrawer

Triggered by tapping a note card.

- Title input (optional, editable)
- Body textarea (editable)
- Delete button (red, 2-tap confirm)
- Save button

## Project Settings Drawer

### useProjects Hook Expansion

Add two functions:

**updateProject(id, updates):** Updates `{ name?, description?, color?, status? }`. Optimistic with rollback.

**deleteProject(id):** Deletes from `huginn_projects`. Navigates to `/projects` after deletion (navigation handled by the page, not the hook — hook returns success/failure).

### ProjectSettingsDrawer

Triggered by gear icon in header.

**Props:** `project: Project`, `onUpdate`, `onDelete`, `onDone`

**Fields:**
- Name (text input, pre-filled)
- Description (textarea, pre-filled, optional)
- Color (8 preset swatches, same as NewProjectDrawer)
- Status chips (idea/active/hold/done)
- Delete button (red, 2-tap confirm)
- Save button

## Verification

1. Tap a project from the list → detail page loads with header (back arrow, color dot, name, gear icon)
2. Three tabs visible: Thoughts, Tasks, Notes. Default: Tasks
3. **Tasks tab:** Empty state "No tasks yet." + floating "+" button
4. Tap "+" → NewTaskDrawer slides up → type title → Save → task appears in Todo column/section
5. Tap a task → TaskDetailDrawer → edit title, change status to Doing → Save → task moves to Doing column/section
6. Desktop (≥768px): three kanban columns side by side
7. Mobile (<768px): three collapsible sections
8. **Thoughts tab:** Shows thoughts filed to this project (if any). Tapping opens existing ThoughtDetailDrawer.
9. **Notes tab:** Empty state + "+" button → create note with title + body → appears in list
10. Tap a note → edit title/body → Save → updates in list
11. Gear icon → ProjectSettingsDrawer → edit name/color/status → Save → header updates
12. Delete project → confirm → navigates to /projects, project gone from list
13. Back arrow → returns to /projects
