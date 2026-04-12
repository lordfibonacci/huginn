# Thought Triage & Workflow — Design Spec

## Context

Huginn's inbox captures thoughts but doesn't let you work them. Thoughts need priority, due dates, filtering, sorting, and an archive action so the inbox becomes a prioritized work queue — not just a dumping ground. This is Phase 1 of scaling Huginn from capture tool to daily hub.

**Key decision:** A thought typed as 'task' IS a task. Priority and due_date live directly on the thought. The `huginn_tasks` table is reserved for future structured project tasks.

**Inbox behavior:** Filed thoughts (those assigned to a project) stay visible in the inbox with a project badge. Only archived thoughts leave the inbox. The inbox shows everything that isn't archived.

## Scope

**Database:**
- Add `priority` and `due_date` columns to `huginn_thoughts`

**Modified files:**
- `src/features/inbox/hooks/useThoughts.ts` — expanded query, archive function, updated types
- `src/features/inbox/components/ThoughtCard.tsx` — show priority, due date, project badge
- `src/features/inbox/components/ThoughtDetailDrawer.tsx` — add priority chips, due date picker, archive button
- `src/pages/InboxPage.tsx` — filter state, sort state, project data for badges

**New files:**
- `src/features/inbox/components/FilterBar.tsx` — filter chips + sort toggle

**Not in scope:** Desktop layout, project detail page, task management within projects, multi-user features.

## Database Migration

Add 2 columns to `huginn_thoughts` via Supabase MCP:

```sql
ALTER TABLE huginn_thoughts
  ADD COLUMN priority text CHECK (priority IN ('low', 'medium', 'high')),
  ADD COLUMN due_date date;
```

Both nullable, no defaults.

## Type Changes

Update `Thought` interface in `src/shared/lib/types.ts`:

```ts
export type ThoughtPriority = 'low' | 'medium' | 'high'

export interface Thought {
  // ...existing fields...
  priority: ThoughtPriority | null  // NEW
  due_date: string | null           // NEW
}
```

## useThoughts Hook Changes

**File:** `src/features/inbox/hooks/useThoughts.ts`

1. **fetchThoughts query:** Change `.eq('status', 'inbox')` to `.in('status', ['inbox', 'filed'])`
2. **updateThought signature:** Expand updates param to include `priority?: ThoughtPriority | null` and `due_date?: string | null`
3. **New function — archiveThought(id):**
   - Optimistic: remove thought from local state
   - Supabase: `.update({ status: 'archived' }).eq('id', thoughtId)`
   - Rollback on error

Updated return adds `archiveThought`.

## FilterBar Component

**File:** `src/features/inbox/components/FilterBar.tsx`

**Props:**
```ts
interface FilterBarProps {
  activeFilter: 'all' | 'idea' | 'task' | 'note'
  onFilterChange: (filter: 'all' | 'idea' | 'task' | 'note') => void
  sortBy: 'newest' | 'priority'
  onSortChange: (sort: 'newest' | 'priority') => void
}
```

- Horizontal row of filter chips: All, Ideas, Tasks, Notes
- Active chip: filled purple (`bg-[#6c5ce7] text-white`)
- Inactive chip: muted (`bg-[#2a2a4a] text-gray-400`)
- Sort toggle button at right end: icon toggles between clock (newest) and flag (priority), with a label
- Sits between the header and ThoughtList, does not scroll with the list

## ThoughtCard Enhancements

**File:** `src/features/inbox/components/ThoughtCard.tsx`

**New props:** `projectName?: string`, `projectColor?: string` (passed from parent, not fetched in card)

**Additional metadata row** (below existing timestamp + type badge):
- **Project badge:** If `project_id` is set, show a small colored dot + project name text
- **Priority indicator:** Colored pip next to type badge — yellow (#fdcb6e) for medium, red (#e17055) for high. Hidden for low/null.
- **Due date:** If set, show formatted text. "today", "tomorrow", "Apr 15", etc. Text turns orange if due today, red if overdue.

## ThoughtDetailDrawer Enhancements

**File:** `src/features/inbox/components/ThoughtDetailDrawer.tsx`

**New fields** (between project dropdown and action buttons):

1. **Priority chips:** Row of 3 chips — Low (gray), Medium (yellow #fdcb6e), High (red #e17055). Tap to select, tap selected to deselect (set to null). Pre-selected based on `thought.priority`.

2. **Due date:** Native `<input type="date">` styled to match dark theme. Shows current value or placeholder "No due date". Small clear (×) button when a date is set.

**Updated action row:**
- Left group: `Archive` button (gray text) | `Delete` button (red, 2-tap confirm)
- Right: `Save` button (purple)
- Archive calls new `onArchive(id)` prop, then dismisses

**Updated props:**
```ts
interface ThoughtDetailDrawerProps {
  thought: Thought
  onUpdate: (id: string, updates: { body?: string; type?: ThoughtType | null; project_id?: string | null; priority?: ThoughtPriority | null; due_date?: string | null }) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
  onArchive: (id: string) => Promise<boolean>
  onDone: () => void
}
```

## InboxPage Changes

**File:** `src/pages/InboxPage.tsx`

**New state:**
- `activeFilter: 'all' | 'idea' | 'task' | 'note'` — default 'all'
- `sortBy: 'newest' | 'priority'` — default 'newest'

**Project data for badges:** Call `useProjects()` to get the project list. Build a lookup map (`projectsById`) to pass project name/color to ThoughtCards.

**Filtering logic** (client-side, applied before passing to ThoughtList):
- 'all': show all thoughts
- 'idea' / 'task' / 'note': filter where `thought.type === filter`

**Sorting logic:**
- 'newest': `created_at DESC` (already the fetch order)
- 'priority': high → medium → low → null, then `created_at DESC` within each tier

**Render order:**
1. Header (unchanged)
2. FilterBar (new)
3. ThoughtList (receives filtered + sorted thoughts)
4. ThoughtInput (unchanged)
5. Drawers (ClassifyDrawer, ThoughtDetailDrawer with new onArchive prop)

**ThoughtList changes:** Pass `projectName` and `projectColor` to each ThoughtCard by looking up `thought.project_id` in the projects map.

## Verification

1. New thoughts still capture and appear in inbox
2. Tap a thought → drawer shows priority chips + due date picker + archive button
3. Set priority to "High" + due date to tomorrow → save → card shows red priority pip + "tomorrow" badge
4. Assign a thought to a project → card shows project color dot + name in inbox (doesn't disappear)
5. Tap Archive → thought disappears from inbox (but not deleted from DB — status is 'archived')
6. Filter chips: tap "Tasks" → only thoughts with type=task shown. Tap "All" → back to full list.
7. Sort toggle: switch to "Priority" → high-priority thoughts at top
8. Delete still works with 2-tap confirmation
9. Mobile viewport: filter bar fits without horizontal scroll, date picker opens native picker
