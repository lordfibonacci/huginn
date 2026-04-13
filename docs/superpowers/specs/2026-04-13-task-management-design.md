# Task Management Enhancements — Design Spec

## Context

Huginn has basic task CRUD inside projects (create, edit status/notes/due-date, delete). This spec adds four enhancements to make task management feel like a real productivity tool: priority levels, quick status toggle on cards, thought-to-task conversion, and drag-and-drop in the kanban view.

## Scope

**Migration:** Add `priority` column to `huginn_tasks`

**New dependency:** `@dnd-kit/core` + `@dnd-kit/sortable`

**Modified files:**
- `src/shared/lib/types.ts` — add priority to Task interface
- `src/features/projects/hooks/useProjectTasks.ts` — expand updateTask signature for priority
- `src/features/projects/components/TaskCard.tsx` — priority pip + quick status toggle button
- `src/features/projects/components/TaskDetailDrawer.tsx` — priority chips
- `src/features/projects/components/TaskList.tsx` — wrap kanban in DndContext, priority sorting
- `src/features/inbox/components/ThoughtDetailDrawer.tsx` — "Convert to task" button
- `src/features/inbox/hooks/useThoughts.ts` — add convertToTask function

## 1. Priority on Tasks

### Migration

```sql
ALTER TABLE huginn_tasks ADD COLUMN priority text CHECK (priority IN ('low', 'medium', 'high'));
```

### Type Update

Add to `Task` interface in `src/shared/lib/types.ts`:

```ts
priority: ThoughtPriority | null  // reuses existing ThoughtPriority type
```

### TaskCard

Show priority pip in the metadata area — yellow (#fdcb6e) for medium, red (#e17055) for high. Hidden for low/null. Same pattern as ThoughtCard.

### TaskDetailDrawer

Add priority chips (Low/Medium/High) between status chips and due date. Same visual pattern as ThoughtDetailDrawer priority chips: Low = gray active bg, Medium = yellow (#fdcb6e), High = red (#e17055). Tap to select, tap again to deselect (null).

### useProjectTasks

Expand `updateTask` signature to accept `priority?: ThoughtPriority | null`.

### Kanban Column Sorting

Within each kanban column, sort tasks by priority (high=0, medium=1, low=2, null=3), then by `created_at DESC`.

## 2. Quick Status Toggle

### TaskCard Enhancement

Add a status toggle button on the **left side** of the card, before the title. Visual states:
- **todo:** Empty circle outline (gray border)
- **doing:** Filled purple circle (#6c5ce7)
- **done:** Green circle with checkmark (#00b894)

Tapping the toggle cycles: todo → doing → done → todo. Calls `onStatusChange(task.id, nextStatus)` — a new callback prop.

The toggle is a separate click target from the card body. Card body click still opens the detail drawer. Use `e.stopPropagation()` on the toggle to prevent both firing.

### TaskCard Props Update

```ts
interface TaskCardProps {
  task: Task
  onClick?: () => void
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void
}
```

### TaskList + ProjectDetailPage

Thread `onStatusChange` from ProjectDetailPage through TaskList to TaskCard. `onStatusChange` calls `updateTask(id, { status })`.

## 3. Convert Thought to Task

### ThoughtDetailDrawer Enhancement

Add a **"Convert to task"** button styled as a positive/primary action — purple text with subtle purple background (`text-[#6c5ce7] bg-[#6c5ce7]/10`), visually distinct from the gray Archive and red Delete buttons.

**Placement:** In the action row, positioned before the Archive/Delete group. Layout:

```
[Convert to task]     [Archive] [Delete]     [Save]
 ^^^ purple/positive   ^^^ gray   ^^^ red    ^^^ purple solid
```

**Visibility:** Only shown when `thought.project_id` is set (thought is assigned to a project). When no project is assigned, the button is hidden — the user needs to assign a project first.

**New prop:** `onConvertToTask?: (thoughtId: string) => Promise<void>`

### useThoughts Hook

Add `convertToTask(thoughtId: string)` function:

1. Get the thought from local state to read `body`, `project_id`
2. Get current user via `supabase.auth.getUser()`
3. Insert into `huginn_tasks`: `{ title: thought.body, project_id: thought.project_id, from_thought_id: thought.id, status: 'todo', user_id }`
4. Update `huginn_thoughts`: set `status = 'archived'`
5. Remove thought from local state (same as archive)
6. Return success/failure

Both Supabase calls happen sequentially. If task creation fails, don't archive the thought. If archival fails after task creation, that's acceptable (task exists, thought stays visible — user can manually archive).

### InboxPage Wiring

Pass `convertToTask` to ThoughtDetailDrawer via the `onConvertToTask` prop.

## 4. Drag-and-Drop in Kanban

### Dependencies

```bash
npm install @dnd-kit/core @dnd-kit/sortable
```

### KanbanView Enhancement (Desktop Only)

Wrap the kanban in `DndContext` from `@dnd-kit/core`:

- Each column div becomes a droppable zone via `useDroppable({ id: status })`
- Each TaskCard is wrapped in a draggable wrapper via `useDraggable({ id: task.id })`
- `DragOverlay` renders a ghost copy of the dragged card

**onDragEnd handler:**
1. Get `active.id` (task id) and `over.id` (column status)
2. If `over` exists and status changed, call `onStatusChange(taskId, newStatus)`
3. Optimistic: task immediately appears in the new column

### Mobile

No drag-and-drop. The grouped list view uses the quick status toggle for changing status. No dnd-kit code runs on mobile.

### TaskList Component Changes

The `KanbanView` internal component gets wrapped in dnd-kit context. The `GroupedView` and the outer `TaskList` are unchanged except for receiving the `onStatusChange` prop.

### TaskList Props Update

```ts
interface TaskListProps {
  tasks: Task[]
  loading: boolean
  onTaskTap: (task: Task) => void
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void
}
```

## Verification

1. **Priority:** Open task detail → set priority to High → save → card shows red pip. Sort by priority in kanban columns (high at top).
2. **Quick toggle:** Tap the circle on a todo task → changes to doing (purple filled). Tap again → done (green check). Card moves to the correct kanban column.
3. **Convert thought:** File a thought to a project → open it → tap "Convert to task" (purple button) → thought disappears from inbox → task appears in project's Todo column.
4. **Convert disabled:** Open a thought with no project → "Convert to task" button not visible.
5. **Drag-and-drop (desktop):** Drag a task card from Todo column to Doing → card moves, status updates.
6. **No drag on mobile:** On mobile viewport, cards don't have drag behavior, grouped sections show with toggle buttons.
7. **All existing features still work:** Task create/edit/delete, note management, project settings, inbox filtering.
