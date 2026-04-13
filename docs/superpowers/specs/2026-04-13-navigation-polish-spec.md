# Navigation Polish — Bold & Vibrant

## Context

Design overhaul sub-project 2 of 4. The design tokens are in place. This spec applies the Bold & Vibrant direction to all navigation components: sidebar, bottom nav, page headers, and project tabs.

## Files Modified

- `src/shared/components/Sidebar.tsx`
- `src/shared/components/BottomNav.tsx`
- `src/pages/InboxPage.tsx` (header only)
- `src/pages/ProjectsPage.tsx` (header only)
- `src/pages/ProjectDetailPage.tsx` (header only)
- `src/features/projects/components/ProjectTabs.tsx`

## Sidebar Redesign

### Title
- "Huginn" with gradient text: `bg-gradient-to-r from-huginn-accent to-[#a78bfa] bg-clip-text text-transparent`
- `text-xl font-extrabold tracking-tight`
- Padding: `px-4 pt-5 pb-4`

### Nav Items (Inbox + Project Rows)
Active state changes from left-border to **filled accent background**:

```
Active:   bg-huginn-accent text-white rounded-lg mx-2
Inactive: text-gray-400 rounded-lg mx-2 hover:bg-huginn-card hover:text-gray-200
```

- Padding: `px-3 py-2.5` (inside the mx-2 margin)
- Gap: `gap-3`
- Icon: `w-5 h-5` (bumped from w-4)
- Remove `border-l-2` pattern entirely — filled bg is the bold direction

### Inbox Badge
- When row is inactive: `bg-huginn-accent text-white px-2 py-0.5 rounded-full text-[11px] font-bold min-w-[22px] text-center`
- When row is active: `bg-white/20 text-white` (softer on accent bg)

### Project Color Dots
- Bump from `w-2.5 h-2.5` to `w-3 h-3`

### Task Count
- Inactive: `text-xs text-huginn-text-muted`
- Active: `text-xs text-white/70`

### Section Labels
- "Projects" header: `text-xs font-bold uppercase tracking-widest text-huginn-accent` (purple, was gray)
- Group sub-labels (Active, On hold, etc.): `text-[11px] font-semibold uppercase tracking-wider text-huginn-text-muted`

### "+" New Project Button
- Add: `hover:bg-huginn-card rounded-md p-1`

### Sign Out
- Stays `text-xs text-gray-500 hover:text-white`

## Bottom Nav Redesign

### Spacing
- Links: `py-3` (up from `py-2`), `gap-1` (up from `gap-0.5`)

### Labels
- `text-[11px] font-bold` (up from `text-[10px] font-medium`)

### Active Indicator
Active tab gets a small dot above the icon:

```tsx
{isActive && <span className="w-1 h-1 rounded-full bg-huginn-accent absolute -top-0.5" />}
```

Each link needs `relative` positioning for the dot. Active text stays `text-huginn-accent`, inactive stays `text-gray-500`.

### Icons
Stay `w-5 h-5` — no change.

## Page Headers

### Desktop (≥md)
Remove redundant elements that the sidebar already provides:
- Title: Shows the page name ("Inbox", "Projects") not "Huginn". `text-lg font-extrabold tracking-tight`.
- Subtitle: Count text. `text-xs text-huginn-text-secondary`.
- Sign-out button: Hidden on desktop with `md:hidden` — sidebar has it.

### Mobile (<md)
- Title: "Inbox" (not "Huginn") on InboxPage. "Projects" on ProjectsPage. Same pattern.
- Sign-out: Visible (no sidebar on mobile).

### InboxPage Header
Change `<h1>` from "Huginn" to "Inbox".

### ProjectsPage Header
Already says "Projects" — no title change. Just add `md:hidden` on sign-out.

### ProjectDetailPage Header
No changes needed — already has back arrow, project name, gear icon. Just add `md:hidden` on any redundant elements if present.

## Project Tabs Redesign

### Active Tab
- `text-white font-bold border-b-2 border-huginn-accent bg-huginn-accent/5`

### Inactive Tab
- `text-gray-500 font-medium hover:text-gray-300 hover:bg-huginn-card/30`

### Spacing
- `py-3` (up from `py-2.5`)

### Container
- Keep `border-b border-huginn-border` on the wrapping div (provides baseline for inactive tabs)

## Verification

1. **Sidebar:** "Huginn" shows gradient purple text. Inbox active state is filled purple rounded rectangle. Project rows same pattern. Purple "Projects" section label.
2. **Bottom nav (mobile):** Taller touch targets, bold labels, active dot above icon.
3. **Page headers:** InboxPage says "Inbox" (not "Huginn"). Sign-out hidden on desktop.
4. **Project tabs:** Active tab has purple underline + subtle purple background tint. Inactive has hover state.
5. **Responsive:** Resize across 768px — sidebar/bottom-nav switch works, headers adapt.
