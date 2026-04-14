# Trello Rebuild: Lists + Card Popup — Design Spec

## Context

Huginn is pivoting from a simple fixed-column kanban (todo/doing/done) to a full Trello-style board system. This spec covers the two foundational phases: customizable Lists replacing fixed columns, and a full card popup modal replacing the side panel.

## Scope

**Phase 1: Lists & Cards**
- New `huginn_lists` table (custom columns per project)
- Migrate cards from `status` field to `list_id` foreign key
- List CRUD: create, rename, reorder (drag), archive
- "Add another list" button
- Card D&D between lists = changing list_id
- Card positioning within lists

**Phase 2: Card Popup Modal**
- Full-screen overlay when clicking a card (Trello-style, not side panel)
- Large editable title
- Rich text description (using Tiptap editor)
- Multiple named checklists per card
- Labels (already built, integrate into popup)
- Due date + start date
- Activity log (auto-generated entries)
- Card actions: archive, delete, move

## Database Changes

### New: `huginn_lists`
```sql
CREATE TABLE huginn_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES huginn_projects(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

### Modify: `huginn_tasks`
- Add `list_id uuid REFERENCES huginn_lists(id)` — which list the card is in
- Add `position integer DEFAULT 0` — position within the list
- The existing `status` field becomes redundant (list name replaces it)
- Keep `status` for now for backward compat, but stop using it in new UI

### New: `huginn_checklists` (multiple per card)
```sql
CREATE TABLE huginn_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES huginn_tasks(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  name text NOT NULL DEFAULT 'Checklist',
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
```
- Modify `huginn_checklist_items` to reference `checklist_id` instead of `task_id`

### New: `huginn_comments`
```sql
CREATE TABLE huginn_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES huginn_tasks(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

### New: `huginn_activity` (auto-generated log)
```sql
CREATE TABLE huginn_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES huginn_tasks(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  action text NOT NULL,
  details jsonb,
  created_at timestamptz DEFAULT now()
);
```

## List Architecture

### Default Lists
When a project is created, auto-create 3 lists: "To Do" (pos 0), "In Progress" (pos 1), "Done" (pos 2). Users can rename, reorder, delete, and create more.

### Migration Strategy
Existing tasks with `status = 'todo'` get `list_id` pointing to the "To Do" list, etc. Run a migration script that:
1. For each project, create 3 default lists
2. Assign each task to the corresponding list based on its current status
3. Set positions based on created_at order

### List UI
- Each list is a vertical column (like Trello)
- Header: list name (click to edit inline) + "..." menu (archive, delete)
- Cards inside, drag to reorder
- "Add a card" input at bottom
- "Add another list" button/column at the far right
- Lists drag to reorder (list-level D&D)

## Card Popup Modal

### Layout (Trello-style)
```
┌──────────────────────────────────────────────────┐
│  ✕                                    in list: X │
│                                                  │
│  ┌─ Card Title (editable, large) ──────────────┐ │
│                                                  │
│  ┌─ Left Column (2/3) ─┐ ┌─ Right Sidebar ──┐   │
│  │                      │ │                  │   │
│  │  Labels (pills)      │ │  + Add to card   │   │
│  │                      │ │  Members         │   │
│  │  Description         │ │  Labels          │   │
│  │  (rich text editor)  │ │  Checklist       │   │
│  │                      │ │  Due date        │   │
│  │  Checklists          │ │                  │   │
│  │  (multiple)          │ │  Actions         │   │
│  │                      │ │  Move            │   │
│  │  Activity / Comments │ │  Archive         │   │
│  │                      │ │  Delete          │   │
│  └──────────────────────┘ └──────────────────┘   │
└──────────────────────────────────────────────────┘
```

### Left Column
- **Title**: large text, inline editable, `text-xl font-bold`
- **Labels**: colored pills showing assigned labels
- **Description**: Tiptap-based rich text editor with toolbar (bold, italic, lists, links, code)
- **Checklists**: multiple named checklists, each with progress bar and items
- **Activity**: auto-generated log + comments mixed together

### Right Sidebar
- **"Add to card" buttons**: Members, Labels, Checklist, Due date
- **Actions**: Move (change list), Archive, Delete

### Behavior
- Opens as a fixed overlay over the board (not a route change)
- ESC or click backdrop to close
- On mobile: full-screen view (not overlay)
- Changes save individually (not a single "Save" button — each field auto-saves)

## Rich Text Editor

Use **Tiptap** (MIT-licensed, React-native, built on ProseMirror). Install `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-placeholder`.

Toolbar: Bold, Italic, Strikethrough, Bullet list, Ordered list, Link, Code block.

Store description as HTML string in the `notes` field on `huginn_tasks`.

## Dependencies to Install

```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-placeholder @tiptap/pm
```

## Files Overview

### New files:
- `src/features/projects/hooks/useLists.ts` — list CRUD + realtime
- `src/features/projects/hooks/useComments.ts` — comment CRUD
- `src/features/projects/hooks/useActivity.ts` — fetch activity log
- `src/features/projects/components/BoardView.tsx` — replaces TaskList kanban
- `src/features/projects/components/ListColumn.tsx` — single list column
- `src/features/projects/components/CardPopup.tsx` — full card popup modal
- `src/features/projects/components/RichTextEditor.tsx` — Tiptap wrapper
- `src/features/projects/components/CommentSection.tsx` — comments + activity
- `src/features/projects/components/CardSidebar.tsx` — right sidebar actions

### Modified files:
- `src/shared/lib/types.ts` — add List, Comment, Activity types
- `src/features/projects/hooks/useProjectTasks.ts` — query by list_id instead of status
- `src/features/projects/components/TaskCard.tsx` — adapt for list context
- `src/pages/ProjectDetailPage.tsx` — use BoardView instead of TaskList
- `src/features/projects/index.ts` — new exports

### Removed/deprecated:
- `src/features/projects/components/TaskList.tsx` — replaced by BoardView
- `src/features/projects/components/TaskDetailPanel.tsx` — replaced by CardPopup
- `src/features/projects/components/ProjectTabs.tsx` — board view is now the main view (thoughts become a secondary view)

## Implementation Order

1. Migrations: create huginn_lists, huginn_checklists, huginn_comments, huginn_activity tables
2. Data migration: create default lists per project, assign tasks to lists
3. Add list_id + position to huginn_tasks
4. Install Tiptap
5. useLists hook
6. BoardView + ListColumn components
7. TaskCard updates (for list context)
8. CardPopup modal
9. RichTextEditor component
10. Multiple checklists support
11. Comments + Activity
12. Wire into ProjectDetailPage
13. Test everything

## Verification
1. Open a project → see lists (To Do, In Progress, Done) with existing tasks properly assigned
2. Create a new list → appears at the end, can rename it
3. Drag lists to reorder
4. Drag cards between lists
5. Click "Add a card" at bottom of any list → creates card in that list
6. Click a card → full popup modal opens
7. Edit title inline → auto-saves
8. Write description with rich text → formats correctly
9. Add a checklist → name it, add items, toggle, progress bar
10. Add labels → shows on card and in popup
11. Set due date → shows on card
12. Add a comment → appears in activity
13. Activity log shows: "created", "moved to X", "added checklist", etc.
14. ESC closes popup
15. Mobile: popup is full-screen
