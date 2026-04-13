# Card & List Polish — Bold & Vibrant

## Context

Design overhaul sub-project 3 of 4. Tokens and navigation are done. This spec applies Bold & Vibrant to all card components and the FilterBar.

## Files Modified

- `src/features/inbox/components/ThoughtCard.tsx`
- `src/features/inbox/components/FilterBar.tsx`
- `src/features/projects/components/TaskCard.tsx`
- `src/features/projects/components/ProjectCard.tsx`
- `src/features/projects/components/NoteCard.tsx`

## ThoughtCard Polish

- Padding: `p-4` (up from `p-3`). Margin: `mb-2.5`.
- Body text: `text-huginn-text-primary` (brighter than gray-100)
- Hover: `hover:bg-huginn-hover border-l-[3px] border-transparent hover:border-huginn-accent`
- **Type badges — bold colored pills:**
  - task: `bg-huginn-accent text-white`
  - idea: `bg-huginn-warning text-black`
  - note: `bg-huginn-success text-white`
  - Style: `text-[11px] font-bold uppercase tracking-wide rounded-md px-2.5 py-0.5`
- Priority indicators: `w-2.5 h-2.5 rounded-sm` (larger square)
- Project tag: `bg-huginn-surface/80 rounded-full px-2 py-0.5` pill with dot + name. Remove `max-w-[100px]`, use `max-w-[120px]` on desktop.
- Voice: keep emoji for now (SVG swap is lower priority)
- Metadata row: `gap-2.5` (up from `gap-2`), `mt-2.5`

## TaskCard Polish

- Padding: `p-4`. Margin: `mb-2.5`.
- Hover: same border-l pattern
- Status toggle: `w-6 h-6` (up from `w-5 h-5`), checkmark `w-3.5 h-3.5`
- Priority: same `w-2.5 h-2.5 rounded-sm` as ThoughtCard
- Title text: `text-huginn-text-primary` when not done

## ProjectCard Polish

- Color dot: `w-4 h-4` (up from `w-3 h-3`)
- Name: `text-huginn-text-primary`
- Status badge: `bg-huginn-surface text-huginn-text-secondary text-[11px] rounded-md px-2 py-0.5` (styled pill instead of bare text)
- Hover: border-l pattern
- Padding stays `px-4 py-3`. Margin: `mb-2.5`.

## NoteCard Polish

- Padding: `p-4`. Margin: `mb-2.5`.
- Title: `text-huginn-text-primary font-medium`
- Timestamp: `text-huginn-text-secondary`
- Hover: border-l pattern

## FilterBar Polish

- Container: `px-4 py-3` (up from `px-3 py-2`)
- Filter chips: `px-4 py-1.5 text-xs font-bold` (up from `px-3 py-1 font-medium`)
- Active chip: add `shadow-md shadow-huginn-accent/40`
- Gap between chips: `gap-2` (up from `gap-1.5`)
- Sort button: `hover:bg-huginn-card rounded-lg px-3 py-1.5`

## Verification

1. ThoughtCards: more padding, bold colored type badges (purple task, yellow idea, green note), larger priority squares, left-border on hover
2. TaskCards: larger status toggle (w-6 h-6), same hover pattern, brighter text
3. ProjectCards: larger color dot, styled status pill, left-border hover
4. NoteCards: brighter text, more padding, hover
5. FilterBar: bigger chips, active shadow, sort button with hover bg
