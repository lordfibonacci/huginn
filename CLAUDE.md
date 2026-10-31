# Huginn

Huginn is the shared work whiteboard for Metta ("vinnuborð Mettu"). Three participants read and write the same place: Heimir (decisions, running things), Árni (design, modules, specs in Markdown and HTML prototypes, never code) and Claude (analysis, plans, building, as its own service user). It replaces the Pending section of the metta2 CLAUDE.md, WhatsApp hand offs and memory notes as the single source for what is open. Live at **huginn.pro** (Vercel).

The old Trello style board, inbox, runes and Meta social planner are gone from the code. The repo, the name, login and the Supabase project stay.

Design spec: `docs/superpowers/specs/2026-10-31-huginn-vinnubord-design.md`. Plans: `docs/superpowers/plans/2026-10-31-vinnubord-{1-grunnur,2-bord,3-cli,4-skyndigreining}.md`.

## Current state

Plan 1 (grunnur, foundation) is built: the `hg_` schema, an API layer, realtime board data hook, pure status, filter, upload and continuation logic with tests, the app shell, routes and the participant gate. The board page is a placeholder that shows the status counters.

Not built yet, do not describe them as existing:
- Plan 2: the whiteboard itself (packages, modules, item cards, threads, side panel, filters, touch), project settings.
- Plan 3: the command line tool and the `/huginn` skill for Claude Code, session close and the repo mirror (`docs/huginn/`).
- Plan 4: quick analysis (edge function calling the Claude API on new items).

Open items from plan 1 are listed in `docs/progress/01-vinnubord-grunnur.md`.

## Tech Stack

- **Frontend:** React 19 + Vite 6 + TypeScript
- **Styling:** Tailwind CSS 4 (via `@tailwindcss/vite`) with `huginn-*` color tokens in `@theme` in `src/index.css`. No `tailwind.config.ts`.
- **Backend:** Supabase (Postgres, Auth, RLS, Realtime, Storage)
- **Routing:** React Router v7
- **i18n:** `react-i18next`
- **Tests:** vitest, `src/**/*.test.ts` only (pure logic in `src/vinnubord/lib/`)
- **PWA:** `vite-plugin-pwa` auto update service worker, manifest description "Vinnuborð Mettu"
- **Kept for plan 2:** `marked` and `dompurify` (markdown reader), not imported yet
- **Image pipeline:** `sharp` via `scripts/build-brand-assets.mjs`

## Commands

```bash
npm run dev       # Vite dev server (prefers 5173, falls back to 5174)
npm run build     # tsc -b && vite build (Vercel runs this). Main verification gate.
npm run test      # vitest run
npm run preview   # Preview production build
npm run lint      # ESLint, currently broken (v9 expects eslint.config.js). Use build and test instead.
npm run brand     # Regenerate PWA icons and brand PNGs from ../Graffík source
npm run translate # Regenerate is.json from en.json via OpenRouter Gemini
```

## Folder structure

```
src/
├── app/            # App.tsx, routes.tsx (ProtectedRoute, PublicRoute)
├── vinnubord/      # everything new lives here, nothing imports old feature code
│   ├── lib/        # types.ts, api.ts, status.ts, filters.ts, upload.ts, continuation.ts (+ *.test.ts)
│   ├── hooks/      # useViewer (memberships), useBoardData (board load + realtime)
│   ├── components/ # Shell, Loader, LoadError
│   └── pages/      # HomePage, BoardPage, SettingsStubPage, NoAccessPage
├── pages/          # LoginPage, AuthCallbackPage, ResetPasswordPage
├── shared/
│   ├── components/ # Avatar, Logo, ErrorBoundary, LanguageToggle, ModalShell
│   ├── hooks/      # useAuth, useProfile, useIsMobile, useLanguagePreference
│   ├── lib/        # supabase client, types (Profile only), dateUtils
│   └── i18n/       # index.ts, locales/en.json, locales/is.json
└── main.tsx
supabase/migrations/  # numbered SQL migrations for hg_ objects
scripts/              # build-brand-assets, translate-is, import-trello-to-huginn (legacy)
```

Some kept shared files (Avatar, ModalShell, useIsMobile, useLanguagePreference, dateUtils) are not imported right now. They stay for plan 2.

## Routes

- `/` : `HomePage`. Signed out goes to `/login`. Signed in goes to the viewer's first project, or `NoAccessPage` if they are a participant in none.
- `/login` : sign in and forgot password. No signup, accounts are created by Heimir.
- `/auth/callback` : Supabase email confirm and password recovery redirects, then to `/` or `/reset-password`.
- `/reset-password` : new password form, then to `/`.
- `/p/:slug` : `BoardPage` for one project (protected, participant only).
- `/p/:slug/stillingar` : `SettingsStubPage`, placeholder until plan 2.
- `*` : redirects to `/`.

## Supabase

- **Project:** `czdjxtsjgughimlazdmu`, region eu-west-2. **Shared with other small projects.** Touch only `hg_` objects. The Auth Site URL is shared too, do not change it; the code passes `emailRedirectTo` explicitly.
- Old `huginn_` tables and the `huginn-attachments` bucket still exist and are not used by the new code, except `huginn_profiles` (read and locale write through `useProfile`). Heimir deletes the old objects by hand later. Never drop or delete them from an agent.
- The old edge functions `meta-oauth-complete` and `meta-publish` were removed from the repo only. They may still be deployed in Supabase.

### hg_ tables (migration 0001)

Every table except `hg_projects` carries `project_id`. RLS on all of them goes through `hg_is_participant(project_id)` (security definer). All participants of a project read and write everything in it, no roles.

- `hg_projects` : slug, name, repo_path, context_bundle. Created through MCP or service role. The insert policy needs the creator to already be a participant, so there is no working web insert path (ruling R1).
- `hg_participants` : user_id, display_name, short (H, Á), is_service (the Claude user).
- `hg_packages`, `hg_modules` : fixed board structure. Modules belong to a package, have status_line, color, is_ghost.
- `hg_items` : the things that move. status in new, waiting, ready, building, parked, done, dropped. `waiting_on` points at a participant. tags, pos_x, pos_y, next_step, next_prompt, closed_at.
- `hg_plans` (todo, building, done), `hg_rulings` (on a plan), `hg_files`, `hg_questions`, `hg_actions`, `hg_comments` (on item or module).
- `hg_events` : timeline, written only by security definer triggers (migration 0003), select only for participants.
- `hg_reads` : read marks per (item_id, user_id).

Helpers: `hg_is_participant(p_project)`, `hg_service_user(p_project)`. Realtime publication includes all hg_ tables except projects and participants.

### Migrations

Files live in `supabase/migrations/` (see the README there). Applied with the Supabase MCP tool `apply_migration`, name = file name without `.sql`. Never `supabase db push`. Files are applied in order and never edited after they are applied. Any DROP or DELETE is run by hand by Heimir in the SQL editor.

- `0001_hg_schema` : applied.
- `0002_hg_rls_hardening` : written, not applied yet (Heimir runs it in the SQL editor).
- `0003_hg_triggers_storage` : not written yet (event log triggers, attribution stamping, closed_at trigger, private bucket `hg-files`).

### Auth

Email and password through Supabase Auth, email confirmation on. Password reset goes `/auth/callback?type=recovery` then `/reset-password`. Participants are Heimir, Árni and a Claude service user (not created yet). Access to a project is decided by `hg_participants` only.

### Env vars (`.env`)

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
OPEN_ROUTER_API=sk-or-v1-...   # only for npm run translate
```

## Internationalization

Two UI languages: Icelandic (default) and English, through `src/shared/i18n/`.

- `en.json` is the hand maintained source. `is.json` is generated by `npm run translate` (OpenRouter Gemini, hash diffed per key, cache in the gitignored `.is.cache.json`). Hand edits to `is.json` stick while the English source is unchanged. Keys in `is.json` are emitted alphabetically, so insert manual additions in alpha order.
- New strings: add the key to `en.json`, run `npm run translate`, commit both files. Removing keys: remove them from both files by hand, do not run translate for that.
- New UI keys go under `vinnubord.*`. Status labels in `src/vinnubord/lib/status.ts` are hard coded Icelandic for now (ruling R5).
- Language resolution: `localStorage.huginn.lang`, then `navigator.language` (English browsers get English, everyone else Icelandic). `LanguageToggle` also writes `huginn_profiles.locale`.

## Design System

Tokens live in `src/index.css` under `@theme`: purple accent `#6c5ce7` on neutral grey (`huginn-base #1d2125`, `huginn-surface #282e33`, `huginn-card #22272b`, `huginn-border #3d474f`, text `#e8e8f0` / `#888888` / `#555555`). The whiteboard look from the spec (blue grey board, gold, lilac, coral, teal and stone status colors, one font family) arrives in plan 2. Keep colors, spacing and motion in tokens in one place, Heimir will restyle a lot.

Brand: raven mark and `huginn` wordmark in `src/shared/components/Logo.tsx`. Icons in `public/icons/` and `public/brand/`.

## Key Patterns

- **Realtime board data.** `useBoardData` loads the whole board through `lib/api.ts` and subscribes to hg_ tables filtered on `project_id`. Channel names use `crypto.randomUUID()` to avoid collisions between hook instances.
- **Pure logic is tested.** Anything that decides status, counters, filters, upload rules or the continuation prompt lives in `src/vinnubord/lib/` without React or Supabase, with a vitest file next to it. Test files import from `vitest` explicitly because `tsc -b` compiles `src`.
- **Status is stored, not computed.** Claude moves status. Dragging only arranges the board.
- **ErrorBoundary** wraps the router, render errors show a panel instead of a blank screen.

## Deployment

- **Prod:** https://huginn.pro on Vercel, auto deploys on `main`. Build command `npm run build`.
- **Env vars (Vercel):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, Production scope. Without them the bundle throws `supabaseUrl is required`. `VITE_INVITE_CODE` is no longer used and can be removed.

## Conventions

- **Style:** no em dashes or hyphen dashes as punctuation anywhere: prose, UI copy, code comments, docs. Use commas, periods or colons. Icelandic UI, no all caps banners.
- Commit messages: `feat:`, `fix:`, `style:`, `refactor:`, `simplify:`, `docs:`, `chore:`, `test:` prefixes, scope `(vinnubord)` for this rebuild. Include a `Co-Authored-By:` trailer for the Claude model that authored the commit.
- Heimir alone pushes. Agents commit when asked, never push.
- No mass process spawning on Heimir's PC.
- `.env`, `.superpowers/`, `docs/session/`, `.playwright-mcp/`, `supabase/.temp/` are gitignored.
- Feature work: brainstorm, spec in `docs/superpowers/specs/`, plan in `docs/superpowers/plans/`, build in an Opus session. Older specs and plans in those folders describe the removed Trello surface and are history only.
- `docs/progress/NN-<plan>.md` records what a finished vinnubord plan built and what is still pending. It is a per plan handover, not a session log.

## End-of-session rituals

When I say "end of session", "end session", "wrap up", "I'm done for now", or similar, treat it as a session-closing trigger and execute one of the procedures below. If unclear which applies, ask me before acting. The goal: leave things clean so I can `/clear` the conversation with no loose ends.

### Stable checkpoint (build green, no half-done edits, ready to /clear)

1. Run `npm run build`. Report any errors before proceeding. Only continue once build passes.

2. Update CLAUDE.md sections that map to what changed this session. This is a reference doc, not a progress log — there is no "What's built" list to append to. Touch only the sections that were actually affected:
   - New route added → update the Routes section
   - New table / RLS change / storage bucket / realtime addition → update the Supabase section (or equivalent)
   - New edge function → update the Edge Functions section
   - New env var → update the env-var list under Commands or Tech Stack
   - New convention discovered from a bug fix → update Conventions / Key Patterns / relevant section
   - Design system change → update Design System
   - New deploy quirk → update Deployment

   Skip any section that was not affected. Match the project's existing tone, formatting, and heading style.

3. Do NOT add a "Recent changes" log to CLAUDE.md. History lives in git; CLAUDE.md stays a reference snapshot of current state. Per plan handovers in `docs/progress/NN-<plan>.md` are allowed (see Conventions), session logs are not.

4. Report back with:
   - Which CLAUDE.md sections you edited (section name + nature of change, not full diff)
   - Any new env var or secret the deploy target needs before the next deploy
   - Any uncommitted files the session left behind

Do not commit. I want to review before pushing.

### Mid-work handoff (bug unresolved, blocked, or stopping mid-flight — NOT at a checkpoint)

Write a resume note at `docs/session/YYYY-MM-DD-<short-topic>.md`. Create the `docs/session/` folder if it does not exist, and add `docs/session/` to `.gitignore` if it is not already there. Use absolute paths throughout - the next session may have a different working directory.

Structure:

```
# YYYY-MM-DD Resume: <topic>

## In-flight
What feature or bug is being worked on, what it is for, why it matters.

## What was done this session
Concrete changes with file:line references (absolute paths). Include migrations drafted even if not applied. Be specific.

## Running state
- Background processes: shell IDs + what they are + how to kill - or "none"
- Dev servers / ports: url + port - or "none"
- Open worktrees / branches beyond main - or "none"

## What's blocking / unknown
What stopped progress. Paste exact error messages verbatim. For design questions, state the options considered.

## Next 2-3 actions on resume
Numbered, concrete steps. Not "figure out the bug" — rather "1. Retry X; 2. read the error; 3. match against guesses below."

## Paths already tried (do NOT redo)
What was attempted that did not work.

## Files touched but not finished
Files with pending edits (absolute paths).

## Context the next session needs
Deploy state (migrations applied, edge functions deployed), env vars set in the deploy target, any uncommitted or unpushed local state.

## Pick up here
One sentence: the single most likely first action for a fresh agent on resume.
```

After writing the file, report back with:
- Path to the resume note
- Any uncommitted or unpushed state that would confuse the next session
- Any background processes still running that the next session should know about

Do not commit. Do not revert anything.

### Session-break decision guide

| Break length | What to do |
|---|---|
| < 1 hour | Leave the conversation open. 1h cache TTL covers it. |
| Overnight, at a checkpoint | Run the stable-checkpoint procedure, then `/clear` |
| Overnight, mid-work | Run the mid-work handoff procedure, then `/clear` |
| Weekend or longer | Always mid-work handoff + `/clear`, never leave open |
| Switching to genuinely unrelated work | `/clear`, not `/compact` |
