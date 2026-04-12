# Huginn

Personal second brain and project management PWA for a founder who juggles many products. Capture thoughts instantly (text or voice), triage later, organize into projects.

## Tech Stack

- **Frontend:** React 19 + Vite 6 + TypeScript
- **Styling:** Tailwind CSS 4 (via `@tailwindcss/vite` plugin)
- **Backend:** Supabase (Postgres, Auth, RLS)
- **PWA:** vite-plugin-pwa with auto-update service worker
- **Voice:** Web Speech API (browser-native)
- **Routing:** React Router v6 (nested routes)

## Architecture

Feature-module structure. Pages are thin shells that compose feature components.

```
src/
├── app/              # App entry, router
├── features/
│   ├── inbox/        # Thought capture, editing, classification
│   └── projects/     # Project listing, creation
├── shared/
│   ├── components/   # Layout, BottomNav
│   ├── hooks/        # useAuth
│   └── lib/          # Supabase client, TypeScript types
├── pages/            # Thin page shells (InboxPage, ProjectsPage, etc.)
└── main.tsx
```

## Supabase

- **Project:** `czdjxtsjgughimlazdmu` (shared — other projects use this DB too)
- **Table prefix:** All tables use `huginn_` prefix: `huginn_thoughts`, `huginn_projects`, `huginn_tasks`, `huginn_notes`
- **Auth:** Email/password via Supabase Auth
- **RLS:** All tables have row-level security — `auth.uid() = user_id`
- **Env vars:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` in `.env`

## Design System

- **Theme:** Dark — navy background `#1a1a2e`, card surfaces `#2a2a4a`, white/light gray text
- **Accent:** Purple `#6c5ce7` for interactive elements
- **Active/hover states:** `#3a3a5a`
- **Typography:** System font stack
- **Corners:** 12-20px radius
- **Mobile-first:** `100dvh` layout, safe-area insets on BottomNav
- **Drawers:** Bottom sheet pattern for create/edit — slide-up animation, backdrop dismiss, 200ms transition

## Patterns

- **Hooks:** Each feature has a `useX` hook (e.g., `useThoughts`, `useProjects`) that handles Supabase CRUD with optimistic updates and rollback on error
- **Components:** Props-based, no global state. Drawers receive callbacks (`onSave`, `onDone`, `onDelete`)
- **Barrel exports:** Each feature has an `index.ts` re-exporting its public API
- **Optimistic UI:** Insert/update/delete all update local state immediately, then sync with Supabase. Rollback on error.

## Commands

```bash
npm run dev      # Start dev server (localhost:5173)
npm run build    # Production build (uses vite build)
npm run preview  # Preview production build
```

## Conventions

- Commit messages: `feat:`, `fix:`, `chore:`, `docs:` prefixes
- No tests yet (planned)
- `.env` is gitignored — contains Supabase credentials
- `.superpowers/` is gitignored — brainstorming artifacts

## Scalability Note

This is currently single-user but may become multi-user (Conor's co-founder Árni may join as collaborator). All tables have `user_id` columns and RLS policies. Don't hardcode single-user assumptions into components.
