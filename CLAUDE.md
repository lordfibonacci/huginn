# Huginn

Personal project management PWA (Trello-style) for a founder who runs multiple independent businesses. Capture thoughts via text/voice, triage into projects, manage tasks on Trello-style boards with custom lists, card popups, checklists, labels, and rich text descriptions.

## Tech Stack

- **Frontend:** React 19 + Vite 6 + TypeScript
- **Styling:** Tailwind CSS 4 (via `@tailwindcss/vite` plugin) with `huginn-*` color tokens defined in `@theme` in `src/index.css`
- **Backend:** Supabase (Postgres, Auth, RLS, Realtime, Storage)
- **Rich Text:** Tiptap (ProseMirror-based) for card descriptions
- **Drag & Drop:** @dnd-kit/core + @dnd-kit/sortable
- **PWA:** vite-plugin-pwa with auto-update service worker
- **Voice:** Web Speech API (browser-native)
- **Routing:** React Router v6 (nested routes with Layout)

## Architecture

Feature-module structure. Trello-style board with custom lists. Card popup modal for full editing.

```
src/
├── app/              # App entry, router
├── features/
│   ├── inbox/        # Thought capture, voice input, triage
│   │   ├── components/  # ThoughtCard, ThoughtInput, ThoughtDetailPanel, etc.
│   │   └── hooks/       # useThoughts, useVoiceRecorder
│   └── projects/     # Board view, cards, lists, checklists, labels
│       ├── components/  # BoardView, ListColumn, CardPopup, TaskCard, ChecklistSection, LabelPicker, RichTextEditor, CommentSection, etc.
│       └── hooks/       # useLists, useProjectTasks, useChecklists, useLabels, useTaskLabels, useComments, useActivity, useAttachments, useProjects
├── shared/
│   ├── components/   # Layout, Sidebar, BottomNav, ModalShell
│   ├── hooks/        # useAuth, useTaskCounts
│   └── lib/          # Supabase client, TypeScript types, dateUtils
├── pages/            # InboxPage, ProjectsPage, ProjectDetailPage, LoginPage
└── main.tsx
```

## Supabase

- **Project:** `czdjxtsjgughimlazdmu` (shared — other projects use this DB too)
- **Table prefix:** All tables use `huginn_` prefix
- **Tables:**
  - `huginn_thoughts` — captured thoughts (inbox)
  - `huginn_projects` — projects/boards
  - `huginn_tasks` — cards (belong to a list via `list_id`)
  - `huginn_lists` — custom lists per project (Trello columns)
  - `huginn_checklists` — named checklists per card
  - `huginn_checklist_items` — items within checklists
  - `huginn_labels` — colored labels per project
  - `huginn_task_labels` — label-card junction
  - `huginn_comments` — comments on cards
  - `huginn_activity` — auto-generated activity log
  - `huginn_attachments` — file/image/link attachments on cards
  - `huginn_board_members` — project membership (owner/admin/member/viewer)
  - `huginn_task_members` — card assignees
  - `huginn_profiles` — user display names and avatars
  - `huginn_notes` — (legacy, not actively used in UI)
- **Auth:** Email/password via Supabase Auth
- **RLS:** All tables have row-level security
- **Realtime:** All tables publish changes via Supabase Realtime
- **Storage:** `huginn-attachments` bucket for file uploads
- **Env vars:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` in `.env`

## Design System

Uses Tailwind CSS 4 with custom `huginn-*` color tokens defined via `@theme` in `src/index.css`:

- **bg-huginn-base:** `#12122a` (sidebar, nav)
- **bg-huginn-surface:** `#161630` (page background)
- **bg-huginn-card:** `#1e1e3e` (cards, inputs, drawers)
- **bg-huginn-hover:** `#242450` (hover/active states)
- **huginn-accent:** `#6c5ce7` (primary interactive)
- **huginn-success:** `#00b894` (done/success)
- **huginn-warning:** `#fdcb6e` (medium priority)
- **huginn-danger:** `#e17055` (high priority, destructive)

**Note:** Tailwind v4 does NOT use `tailwind.config.ts`. Colors are defined via CSS `@theme` directive.

## Key Patterns

- **Hooks with Realtime:** Every data hook (useThoughts, useProjectTasks, useLists, etc.) fetches on mount AND subscribes to Supabase Realtime for live updates. Channel names use `crypto.randomUUID()` to avoid conflicts when multiple hook instances exist.
- **Optimistic Updates:** Mutations update local state immediately, then sync with Supabase. Rollback on error.
- **ModalShell:** Shared component that renders as centered modal on desktop, bottom drawer on mobile.
- **BoardView + ListColumn:** Trello-style board with custom lists, drag-and-drop via @dnd-kit. Cards belong to lists via `list_id`.
- **CardPopup:** Full overlay modal for card editing — title, rich text description (Tiptap), multiple checklists, labels, attachments, comments, activity feed.
- **Split-view Inbox:** Desktop shows thought list on left, detail panel on right. Mobile uses drawers.
- **Barrel exports:** Each feature has an `index.ts` re-exporting its public API.

## Commands

```bash
npm run dev      # Start dev server (localhost:5173)
npm run build    # Production build
npm run preview  # Preview production build
```

## Conventions

- Commit messages: `feat:`, `fix:`, `style:`, `refactor:`, `simplify:`, `docs:` prefixes
- No tests yet
- `.env` is gitignored — contains Supabase credentials
- `.superpowers/` is gitignored — brainstorming artifacts

## Multi-User (In Progress)

Tables exist for `huginn_board_members` (project membership with roles) and `huginn_task_members` (card assignees). UI not yet built — currently single-user. Co-founder Árni will be the first additional user. Each project is an independent business (real estate, camping, apps, etc.) — projects are NOT related to each other.
