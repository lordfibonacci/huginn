# Design Foundation — Bold & Vibrant Direction

## Context

Huginn's UI was built functionally but lacks visual polish. Every component uses hardcoded hex colors, inconsistent spacing, and ad-hoc styling. This spec establishes the design foundation: Tailwind color tokens, spacing scale, typography, and base component patterns that all subsequent design work builds on.

**Direction chosen: Bold & Vibrant** — strong color usage, filled accent elements, bold typography, colored type badges, energetic feel. Inspired by modern startup tools.

This is sub-project 1 of 4 in the design overhaul:
1. **Design Foundation** (this spec) — tokens, config, base patterns
2. Navigation Polish — sidebar, bottom nav, headers, tabs
3. Card & List Polish — all card components, list layouts
4. Drawer & Input Polish — all drawers, filter bar, thought input

## Scope

**New files:**
- `tailwind.config.ts` — custom theme with color tokens, spacing scale
- `src/index.css` — updated with custom utilities and base styles

**Modified files:**
- Every component file (replacing hardcoded hex values with token classes)

**This spec covers the foundation setup only.** The actual component-by-component restyling happens in sub-projects 2-4. However, the migration from hardcoded values to tokens needs to happen across all files in this pass to avoid a half-migrated state.

## Tailwind Configuration

### Color Tokens

Define in `tailwind.config.ts` under `theme.extend.colors`:

```
huginn: {
  // Backgrounds
  base:    '#12122a'    // Deepest bg (sidebar, dark areas)
  surface: '#161630'    // Page background
  card:    '#1e1e3e'    // Cards, inputs, drawers
  hover:   '#242450'    // Card hover, active states
  
  // Borders
  border:  '#2a2a4a'    // All dividers and borders
  
  // Accent
  accent:       '#6c5ce7'    // Primary interactive (buttons, active states, links)
  'accent-hover': '#5b4bd5'  // Accent pressed/hover
  'accent-soft': 'rgba(108,92,231,0.15)'  // Accent background tint
  
  // Status
  success:  '#00b894'    // Done, success
  warning:  '#fdcb6e'    // Medium priority, caution
  danger:   '#e17055'    // High priority, overdue, destructive
  
  // Text
  'text-primary':   '#e8e8f0'   // Main body text
  'text-secondary': '#888'       // Timestamps, metadata
  'text-muted':     '#555'       // Disabled, placeholder
}
```

### Spacing

Use Tailwind's default spacing scale (4px base). No custom spacing — just be consistent:
- `p-3` (12px) for card inner padding → upgrade to `p-4` (16px)
- `gap-2` (8px) for inline items → `gap-3` (12px) for card metadata
- `px-4 py-3` (16px / 12px) for nav items → `px-4 py-2.5` (16px / 10px)
- `mb-2` (8px) between cards → `mb-2.5` (10px)

### Typography

- Page titles: `text-xl font-extrabold tracking-tight` (22px, 800 weight)
- Section headings: `text-base font-bold` (16px, 700 weight)
- Body text: `text-sm` (14px, 400 weight) — this is the card content size
- Metadata: `text-xs` (12px) for timestamps, counts, secondary info
- Labels: `text-[11px] uppercase tracking-widest font-bold` for section headers
- Badges: `text-[11px] font-bold uppercase tracking-wide` in colored pills

### Border Radius

- Cards: `rounded-xl` (12px)
- Buttons/chips: `rounded-lg` (8px) for rectangular, `rounded-full` for pills
- Inputs: `rounded-xl` (12px)
- Drawers: `rounded-t-2xl` (16px top corners)
- Sidebar nav items: `rounded-lg` (8px) with `mx-2`

### Shadows & Effects

- Card hover: `hover:bg-huginn-hover` + `border-l-3 border-huginn-accent` (left accent border on hover)
- FAB button: `shadow-lg shadow-huginn-accent/30` (purple-tinted shadow)
- Active filter chips: `shadow-md shadow-huginn-accent/40`
- Focus rings: `focus:ring-2 focus:ring-huginn-accent/50`

## Type Badge Colors (Bold Direction)

Each thought/task type gets a distinct filled badge:

```
task:  bg-huginn-accent text-white        (purple, filled)
idea:  bg-huginn-warning text-black        (yellow, filled)  
note:  bg-huginn-success text-white        (green, filled)
```

Badges use: `px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wide`

This is a major visual upgrade from the current near-invisible badges.

## Priority Indicators

Upgrade from tiny dots to more visible indicators:

```
high:   bg-huginn-danger   — 10x10px rounded square
medium: bg-huginn-warning  — 10x10px rounded square
low:    hidden (don't show)
```

Priority squares use: `w-2.5 h-2.5 rounded-sm`

## Global Base Styles

Add to `src/index.css`:

```css
@import "tailwindcss";

/* Scrollbar styling for dark theme */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #2a2a4a; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #3a3a5a; }

/* Selection color */
::selection { background: rgba(108, 92, 231, 0.3); }

/* Smooth transitions globally */
* { transition-property: color, background-color, border-color, opacity; transition-duration: 150ms; transition-timing-function: ease; }
```

## Migration Strategy

Replace all hardcoded hex values across every component file:

| Current | Token |
|---------|-------|
| `bg-[#1a1a2e]` | `bg-huginn-surface` |
| `bg-[#2a2a4a]` | `bg-huginn-card` |
| `bg-[#3a3a5a]` | `bg-huginn-hover` |
| `bg-[#6c5ce7]` | `bg-huginn-accent` |
| `bg-[#5b4bd5]` | `bg-huginn-accent-hover` |
| `bg-[#00b894]` | `bg-huginn-success` |
| `bg-[#fdcb6e]` | `bg-huginn-warning` |
| `bg-[#e17055]` | `bg-huginn-danger` |
| `border-[#2a2a4a]` | `border-huginn-border` |
| `text-[#6c5ce7]` | `text-huginn-accent` |
| `text-[#e17055]` | `text-huginn-danger` |
| `text-[#fdcb6e]` | `text-huginn-warning` |
| `focus:ring-[#6c5ce7]` | `focus:ring-huginn-accent` |

Also update background base colors:
- `#1a1a2e` → `#161630` (slightly deeper, richer surface)
- `#2a2a4a` → `#1e1e3e` (card backgrounds get darker, more contrast)
- `#0f0f1e` or `#12122a` for sidebar base

**Important:** This migration touches every file but changes no behavior. It's a pure styling token swap. The subsequent sub-projects (Navigation, Cards, Drawers) will adjust the actual layouts and component designs using these tokens.

## Files to Modify

Every file with hardcoded hex colors:
- `src/shared/components/Layout.tsx`
- `src/shared/components/Sidebar.tsx`
- `src/shared/components/BottomNav.tsx`
- `src/pages/InboxPage.tsx`
- `src/pages/ProjectsPage.tsx`
- `src/pages/ProjectDetailPage.tsx`
- `src/pages/LoginPage.tsx`
- `src/features/inbox/components/ThoughtCard.tsx`
- `src/features/inbox/components/ThoughtInput.tsx`
- `src/features/inbox/components/ThoughtList.tsx`
- `src/features/inbox/components/ThoughtDetailDrawer.tsx`
- `src/features/inbox/components/ClassifyDrawer.tsx`
- `src/features/inbox/components/VoiceButton.tsx`
- `src/features/inbox/components/FilterBar.tsx`
- `src/features/projects/components/TaskCard.tsx`
- `src/features/projects/components/TaskList.tsx`
- `src/features/projects/components/TaskDetailDrawer.tsx`
- `src/features/projects/components/NewTaskDrawer.tsx`
- `src/features/projects/components/ProjectCard.tsx`
- `src/features/projects/components/ProjectList.tsx`
- `src/features/projects/components/ProjectTabs.tsx`
- `src/features/projects/components/NewProjectDrawer.tsx`
- `src/features/projects/components/NoteCard.tsx`
- `src/features/projects/components/NoteList.tsx`
- `src/features/projects/components/NoteDetailDrawer.tsx`
- `src/features/projects/components/NewNoteDrawer.tsx`
- `src/features/projects/components/ProjectSettingsDrawer.tsx`

## Verification

1. `npm run dev` starts with no errors
2. All pages render correctly with the new color tokens (visually similar but using new darker, richer palette)
3. No hardcoded hex color values remain in any component file (search for `#1a1a2e`, `#2a2a4a`, `#6c5ce7`, etc.)
4. Tailwind config has all `huginn.*` color tokens defined
5. Custom scrollbar styling visible in Chrome/Edge
6. Selection highlight is purple-tinted
