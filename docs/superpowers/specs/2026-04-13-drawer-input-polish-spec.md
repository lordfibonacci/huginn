# Drawer & Input Polish — Bold & Vibrant

## Context

Design overhaul sub-project 4 of 4 (final). Tokens, navigation, and cards are done. This spec applies Bold & Vibrant to all drawers, the thought input, voice button, and login page inputs.

## Shared Drawer Pattern

All 8 drawers get these upgrades:

**Drawer container:**
- Add `shadow-[0_-4px_24px_rgba(0,0,0,0.3)]` to the inner panel for depth
- Drag handle: `bg-gray-500` (was gray-600 in some)

**Inputs (text, textarea, select, date):**
- Add `border border-huginn-border focus:border-huginn-accent` for visible borders
- Keep `bg-huginn-surface`, `text-white`, `rounded-xl`, `focus:ring-2 focus:ring-huginn-accent`

**Section labels** ("Priority", "Due date", "Status", etc.):
- `text-xs text-huginn-text-muted font-semibold`

**Type chips** (in ThoughtDetailDrawer, ClassifyDrawer):
- Bold colored fills: task = `bg-huginn-accent text-white`, idea = `bg-huginn-warning text-black`, note = `bg-huginn-success text-white`
- When inactive: `bg-huginn-surface text-gray-300 hover:bg-huginn-hover`
- Style: `font-bold` (was `font-medium`)

**Priority chips** (in ThoughtDetailDrawer, TaskDetailDrawer):
- Active: use the color bg + `text-white` (unchanged)
- Inactive: `bg-huginn-surface` (was same), `font-bold` (was implied)

**Status chips** (in TaskDetailDrawer):
- Active: `bg-huginn-accent text-white` (unchanged)
- Inactive: `bg-huginn-surface text-gray-300 hover:bg-huginn-hover`

**Save button:**
- Add `shadow-md shadow-huginn-accent/30`

**Delete button:**
- Add `hover:bg-huginn-danger/10` for hover feedback

**Cancel / Archive / Do later buttons:**
- Stay subtle text buttons, no change

**Color swatches** (NewProjectDrawer, ProjectSettingsDrawer):
- Ring offset: `ring-offset-huginn-card` (matches drawer bg)

## ThoughtInput

- Textarea: add `border border-huginn-border focus:border-huginn-accent`, change `rounded-2xl` to `rounded-xl`
- Container padding stays `px-3 py-3`

## VoiceButton

- Shape: `rounded-xl` (was `rounded-full`)
- Size: `w-11 h-11` (was `w-10 h-10`)
- Add `shadow-md shadow-huginn-accent/30`

## LoginPage

- Inputs: add `border border-huginn-border focus:border-huginn-accent`
- Submit button: add `shadow-md shadow-huginn-accent/30`

## Files Modified

1. `src/features/inbox/components/ThoughtDetailDrawer.tsx`
2. `src/features/inbox/components/ClassifyDrawer.tsx`
3. `src/features/inbox/components/ThoughtInput.tsx`
4. `src/features/inbox/components/VoiceButton.tsx`
5. `src/features/projects/components/TaskDetailDrawer.tsx`
6. `src/features/projects/components/NewTaskDrawer.tsx`
7. `src/features/projects/components/NewProjectDrawer.tsx`
8. `src/features/projects/components/NoteDetailDrawer.tsx`
9. `src/features/projects/components/NewNoteDrawer.tsx`
10. `src/features/projects/components/ProjectSettingsDrawer.tsx`
11. `src/pages/LoginPage.tsx`

## Verification

1. All drawers have subtle top shadow when open
2. All inputs have visible border that turns accent on focus
3. Type chips are bold colored (purple task, yellow idea, green note)
4. Save buttons have purple glow shadow
5. Delete buttons highlight red on hover
6. ThoughtInput textarea has border, rounded-xl
7. VoiceButton is rounded-xl with shadow
8. Login page inputs have borders and submit has glow
