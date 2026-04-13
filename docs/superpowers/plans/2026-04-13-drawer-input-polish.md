# Drawer & Input Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply Bold & Vibrant polish to all 8 drawers, ThoughtInput, VoiceButton, and LoginPage — bordered inputs, drawer shadows, bold type chips, glowing save buttons.

**Architecture:** Targeted styling edits across 11 files. Same patterns applied consistently. No behavior changes. All files are independent.

**Tech Stack:** React, TypeScript, Tailwind CSS (huginn tokens)

---

## Shared Replacement Rules

These apply across ALL drawer files. Each task below will reference these rules:

**Drawer panel shadow:** On the inner panel div (the one with `bg-huginn-card rounded-t-2xl`), add `shadow-[0_-4px_24px_rgba(0,0,0,0.3)]` to the className.

**Drag handle:** Change `bg-gray-600` to `bg-gray-500` (if present).

**Input borders:** For every `<input>` and `<textarea>` and `<select>`, add `border border-huginn-border focus:border-huginn-accent` to existing classes.

**Section labels:** Change `text-xs text-gray-500` to `text-xs text-huginn-text-muted font-semibold` on labels like "Priority", "Status", "Due date".

**Save button glow:** Add `shadow-md shadow-huginn-accent/30` to save buttons (the ones with `bg-huginn-accent`).

**Delete button hover:** Add `hover:bg-huginn-danger/10` to delete/confirm buttons. Change existing `bg-red-400/10` to `bg-huginn-danger/10` for consistency.

**Type chip bold fills:** Where type chips exist (ThoughtDetailDrawer, ClassifyDrawer), change active type chip styling:
- Current: `bg-huginn-accent text-white` for all types
- New: task = `bg-huginn-accent text-white`, idea = `bg-huginn-warning text-black`, note = `bg-huginn-success text-white`
- Inactive: change `bg-huginn-surface` to same, add `font-bold` to chip buttons

**Chip font weight:** Change `font-medium` to `font-bold` on all chip buttons.

---

## Task 1: Polish inbox drawers (ThoughtDetailDrawer + ClassifyDrawer)

**Files:**
- Modify: `src/features/inbox/components/ThoughtDetailDrawer.tsx`
- Modify: `src/features/inbox/components/ClassifyDrawer.tsx`

- [ ] **Step 1: Polish ThoughtDetailDrawer**

Read `src/features/inbox/components/ThoughtDetailDrawer.tsx` and apply these edits:

1. On the inner panel div (the one with `bg-huginn-card rounded-t-2xl`), add `shadow-[0_-4px_24px_rgba(0,0,0,0.3)]`

2. Change the drag handle from `bg-gray-600` to `bg-gray-500` (if it says gray-600)

3. On all `<textarea>`, `<input type="date">`, and `<select>` elements, add `border border-huginn-border focus:border-huginn-accent` to their className

4. Change type chip active styling from uniform `bg-huginn-accent text-white` to per-type colors. Replace the type chip button className logic. The active class should use `TYPE_BADGE[opt.value]` instead of `bg-huginn-accent text-white`. Add a `TYPE_BADGE` constant (same as ThoughtCard):
```ts
const TYPE_BADGE: Record<ThoughtType, string> = {
  task: 'bg-huginn-accent text-white',
  idea: 'bg-huginn-warning text-black',
  note: 'bg-huginn-success text-white',
}
```
Then in the type chip button className, change the active branch from:
```
'bg-huginn-accent text-white'
```
to:
```
TYPE_BADGE[opt.value]
```

5. Change all `font-medium` on chip buttons to `font-bold`

6. Change section labels ("Priority", "Due date") from `text-xs text-gray-500` to `text-xs text-huginn-text-muted font-semibold`

7. Add `shadow-md shadow-huginn-accent/30` to the Save button

8. On the Delete button, change `bg-red-400/10` to `bg-huginn-danger/10` and add `hover:bg-huginn-danger/10` to the non-confirm state

9. On the Convert to task button, add `hover:bg-huginn-accent/20` (likely already there)

- [ ] **Step 2: Polish ClassifyDrawer**

Read `src/features/inbox/components/ClassifyDrawer.tsx` and apply the same patterns:

1. Drawer panel: add `shadow-[0_-4px_24px_rgba(0,0,0,0.3)]`
2. Drag handle: `bg-gray-500`
3. Type chips: add `TYPE_BADGE` constant, use per-type colors for active state
4. All chips: `font-bold`
5. Select input: add `border border-huginn-border focus:border-huginn-accent`
6. Save button: add `shadow-md shadow-huginn-accent/30`

- [ ] **Step 3: Verify build + commit**

```bash
cd c:/Dropbox/Huginn/huginn && npx vite build
git add src/features/inbox/components/ThoughtDetailDrawer.tsx src/features/inbox/components/ClassifyDrawer.tsx
git commit -m "style: polish ThoughtDetailDrawer and ClassifyDrawer with shadows, bold chips, bordered inputs"
```

---

## Task 2: Polish ThoughtInput + VoiceButton

**Files:**
- Modify: `src/features/inbox/components/ThoughtInput.tsx`
- Modify: `src/features/inbox/components/VoiceButton.tsx`

- [ ] **Step 1: Polish ThoughtInput**

In `src/features/inbox/components/ThoughtInput.tsx`, update the textarea className:
- Change `rounded-2xl` to `rounded-xl`
- Add `border border-huginn-border focus:border-huginn-accent`

The textarea className should become:
```
flex-1 bg-huginn-card text-white rounded-xl px-4 py-2.5 text-sm outline-none border border-huginn-border focus:border-huginn-accent focus:ring-2 focus:ring-huginn-accent placeholder-gray-500 resize-none disabled:opacity-50
```

- [ ] **Step 2: Polish VoiceButton**

In `src/features/inbox/components/VoiceButton.tsx`, change the button className:
- `w-10 h-10 rounded-full` → `w-11 h-11 rounded-xl`
- Add `shadow-md shadow-huginn-accent/30` to the non-recording state

The non-recording classes become:
```
bg-huginn-accent hover:bg-huginn-accent-hover shadow-md shadow-huginn-accent/30
```

Full button className:
```tsx
className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
  isRecording
    ? 'bg-red-500 animate-pulse'
    : 'bg-huginn-accent hover:bg-huginn-accent-hover shadow-md shadow-huginn-accent/30'
}`}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/inbox/components/ThoughtInput.tsx src/features/inbox/components/VoiceButton.tsx
git commit -m "style: polish ThoughtInput with bordered textarea and VoiceButton with rounded-xl"
```

---

## Task 3: Polish project drawers (all 5)

**Files:**
- Modify: `src/features/projects/components/TaskDetailDrawer.tsx`
- Modify: `src/features/projects/components/NewTaskDrawer.tsx`
- Modify: `src/features/projects/components/NewProjectDrawer.tsx`
- Modify: `src/features/projects/components/NoteDetailDrawer.tsx`
- Modify: `src/features/projects/components/NewNoteDrawer.tsx`

- [ ] **Step 1: Apply shared drawer polish to all 5 files**

For each file, read it and apply:

1. **Drawer panel shadow:** Add `shadow-[0_-4px_24px_rgba(0,0,0,0.3)]` to the inner panel div className
2. **Drag handle:** Change `bg-gray-600` to `bg-gray-500` if present
3. **Input borders:** Add `border border-huginn-border focus:border-huginn-accent` to all `<input>`, `<textarea>`, `<select>` elements
4. **Chip font:** Change `font-medium` to `font-bold` on all chip buttons
5. **Section labels:** Change `text-xs text-gray-500` to `text-xs text-huginn-text-muted font-semibold`
6. **Save button:** Add `shadow-md shadow-huginn-accent/30`
7. **Delete button (where present):** Change `bg-red-400/10` to `bg-huginn-danger/10`, add `hover:bg-huginn-danger/10` to non-confirm state

- [ ] **Step 2: Verify build + commit**

```bash
cd c:/Dropbox/Huginn/huginn && npx vite build
git add src/features/projects/components/TaskDetailDrawer.tsx src/features/projects/components/NewTaskDrawer.tsx src/features/projects/components/NewProjectDrawer.tsx src/features/projects/components/NoteDetailDrawer.tsx src/features/projects/components/NewNoteDrawer.tsx
git commit -m "style: polish all project drawers with shadows, bordered inputs, bold chips"
```

---

## Task 4: Polish ProjectSettingsDrawer + LoginPage

**Files:**
- Modify: `src/features/projects/components/ProjectSettingsDrawer.tsx`
- Modify: `src/pages/LoginPage.tsx`

- [ ] **Step 1: Polish ProjectSettingsDrawer**

Same drawer pattern as Task 3:
1. Drawer shadow
2. Drag handle
3. Input borders on name input, description textarea
4. Chip font-bold on status chips
5. Section label styling
6. Save button glow
7. Delete button hover
8. Color swatch ring-offset: ensure `ring-offset-huginn-card` (should already be migrated)

- [ ] **Step 2: Polish LoginPage**

In `src/pages/LoginPage.tsx`:
1. Add `border border-huginn-border focus:border-huginn-accent` to both email and password inputs
2. Add `shadow-md shadow-huginn-accent/30` to the submit button

- [ ] **Step 3: Verify build + commit**

```bash
cd c:/Dropbox/Huginn/huginn && npx vite build
git add src/features/projects/components/ProjectSettingsDrawer.tsx src/pages/LoginPage.tsx
git commit -m "style: polish ProjectSettingsDrawer and LoginPage inputs"
```

---

## Task 5: Final verification

- [ ] **Step 1: Full build**

```bash
cd c:/Dropbox/Huginn/huginn && npx vite build
```

- [ ] **Step 2: Spot-check all drawers**

1. Open ThoughtDetailDrawer → subtle top shadow, bordered textarea, bold colored type chips, priority chips bold, save has glow, delete hovers red
2. ClassifyDrawer → same shadow, colored type chips, bordered select
3. TaskDetailDrawer → shadow, bordered inputs, bold status/priority chips, save glow
4. NewTaskDrawer → shadow, bordered input, save glow
5. NewProjectDrawer → shadow, bordered input, save glow
6. NoteDetailDrawer → shadow, bordered inputs, save glow
7. NewNoteDrawer → shadow, bordered inputs, save glow
8. ProjectSettingsDrawer → shadow, bordered inputs, save glow, color swatches
9. ThoughtInput → bordered textarea with rounded-xl
10. VoiceButton → rounded-xl, larger, with shadow
11. LoginPage → bordered inputs, submit glow
