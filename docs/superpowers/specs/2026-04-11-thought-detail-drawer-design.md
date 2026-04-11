# Thought Detail Drawer — Design Spec

## Context

Huginn's Inbox currently shows thought cards as read-only. Users need to tap a card to edit its body, reclassify it (type + project), or delete it. This adds a ThoughtDetailDrawer that slides up from the bottom when a card is tapped.

## Scope

- New component: `ThoughtDetailDrawer`
- Modify: `ThoughtCard` (add onClick), `ThoughtList` (pass callback), `useThoughts` (add update/delete), `InboxPage` (wire drawer), `index.ts` (export)
- No changes to ClassifyDrawer (it stays as the post-save quick-triage drawer)

## ThoughtDetailDrawer Component

**File:** `src/features/inbox/components/ThoughtDetailDrawer.tsx`

**Props:**
```ts
interface ThoughtDetailDrawerProps {
  thought: Thought
  onUpdate: (id: string, updates: { body?: string; type?: ThoughtType | null; project_id?: string | null }) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
  onDone: () => void
}
```

**Layout (top to bottom):**
1. Drag handle bar (centered gray pill, same as ClassifyDrawer)
2. Auto-growing `<textarea>` pre-filled with `thought.body`, same styling as ThoughtInput's textarea
3. Type chips row — Idea / Task / Note, same visual style as ClassifyDrawer chips. Pre-selected based on `thought.type`. Tapping a selected chip deselects it (sets to null).
4. Project dropdown — same as ClassifyDrawer. Pre-selected based on `thought.project_id`. "No project" option clears it.
5. Footer row:
   - Left: Delete button (red text, no background)
   - Right: Save button (purple bg, same as ClassifyDrawer)

**Behavior:**
- Slide-up animation identical to ClassifyDrawer (visible state, translate-y-full transition, 200ms)
- Backdrop tap dismisses without saving
- Save button: calls `onUpdate(thought.id, { body, type, project_id })`, then `onDone()`
- Save is disabled if body is empty (trimmed)
- Delete: two-tap confirmation
  - First tap: button text changes from "Delete" to "Are you sure?"
  - If no second tap within 3 seconds, resets back to "Delete"
  - Second tap: calls `onDelete(thought.id)`, then `onDone()`
- Fetches active projects on mount (same Supabase query as ClassifyDrawer)

## Changes to useThoughts Hook

**File:** `src/features/inbox/hooks/useThoughts.ts`

Add two functions:

**`updateThought(id, updates)`**
- Optimistic: immediately update the matching thought in local state
- Supabase: `supabase.from('huginn_thoughts').update(updates).eq('id', id)`
- On error: rollback to previous state, return false
- On success: return true

**`deleteThought(id)`**
- Optimistic: immediately remove thought from local state, decrement count
- Supabase: `supabase.from('huginn_thoughts').delete().eq('id', id)`
- On error: rollback (re-insert thought at original position), return false
- On success: return true

Updated return: `{ thoughts, loading, addThought, classifyThought, updateThought, deleteThought, count }`

## Changes to ThoughtCard

**File:** `src/features/inbox/components/ThoughtCard.tsx`

- Add `onClick` prop: `onClick?: () => void`
- Add `cursor-pointer` class and `active:bg-[#3a3a5a]` for tap feedback
- Attach onClick to the card's root div

## Changes to ThoughtList

**File:** `src/features/inbox/components/ThoughtList.tsx`

- Add `onThoughtTap` prop: `(thought: Thought) => void`
- Pass `onClick={() => onThoughtTap(thought)}` to each ThoughtCard

## Changes to InboxPage

**File:** `src/pages/InboxPage.tsx`

- Add state: `editingThought: Thought | null`
- When ThoughtList's `onThoughtTap` fires, set `editingThought`
- Render `ThoughtDetailDrawer` when `editingThought` is non-null
- Pass `updateThought`, `deleteThought` from useThoughts hook
- `onDone` clears `editingThought`

## Changes to Barrel Export

**File:** `src/features/inbox/index.ts`

- Add export for `ThoughtDetailDrawer`

## Verification

1. Tap a thought card → drawer slides up with thought body in textarea, type pre-selected, project pre-selected
2. Edit the body text, change type to "Task", tap Save → card updates in list immediately
3. Tap a card → tap Delete → button says "Are you sure?" → wait 3s → resets to "Delete"
4. Tap a card → tap Delete → tap "Are you sure?" → card disappears from list immediately
5. Tap a card → tap backdrop → drawer dismisses, no changes
6. Tap a card → clear the textarea → Save button is disabled
