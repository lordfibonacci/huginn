# Huginn

Huginn is the shared work whiteboard for Metta ("vinnuborð Mettu"). Three participants read and write the same place: Heimir (decisions, running things), Árni (design, modules, specs in Markdown and HTML prototypes, never code) and Claude (analysis, plans, building, as its own service user). It replaces the Pending section of the metta2 CLAUDE.md, WhatsApp hand offs and memory notes as the single source for what is open. Live at **huginn.pro** (Vercel).

The old Trello style board, inbox, runes and Meta social planner are gone from the code. The repo, the name, login and the Supabase project stay.

Design spec: `docs/superpowers/specs/2026-10-31-huginn-vinnubord-design.md`. Plans: `docs/superpowers/plans/2026-10-31-vinnubord-{1-grunnur,2-bord,3-cli,4-skyndigreining}.md`.

## Current state

Plans 1 and 2 are built and verified (`npm run smoke:hg` prints `ok 6/6` against the live DB, 212 vitest tests, `npm run build` green).

- Plan 1 (grunnur): the `hg_` schema, API layer, realtime board data hook, pure status, filter, upload and continuation logic, the app shell, routes and the participant gate.
- Plan 2 (bord): the whiteboard. Pack columns and module cards, item cards with spring drag and wires with sparks on a canvas, pan and zoom with touch (pinch, two finger pan, 350 ms long press to drag), side panel and bottom sheet for items and modules (status, files, questions, history, comments, copy buttons, Markdown reader), top bar with counter pills, filters, search and a viewer menu, new item sheet with file upload, aurora and entry motion, new item toast, project settings. The live project metta is seeded with 5 packages and 28 modules.

Not built yet, do not describe them as existing:
- Plan 3: the command line tool and the `/huginn` skill for Claude Code, session close and the repo mirror (`docs/huginn/`).
- Plan 4: quick analysis (edge function calling the Claude API on new items).

Open items are listed in `docs/progress/01-vinnubord-grunnur.md` and `docs/progress/02-vinnubord-bord.md`.

## Tech Stack

- **Frontend:** React 19 + Vite 6 + TypeScript
- **Styling:** Tailwind CSS 4 (via `@tailwindcss/vite`) with `huginn-*` color tokens in `@theme` in `src/index.css`. No `tailwind.config.ts`.
- **Backend:** Supabase (Postgres, Auth, RLS, Realtime, Storage)
- **Routing:** React Router v7
- **i18n:** `react-i18next`
- **Tests:** vitest, `src/**/*.test.ts` only (pure logic in `src/vinnubord/lib/`). `jsdom` is a dev dependency for the Markdown sanitizer test only (`// @vitest-environment jsdom`).
- **PWA:** `vite-plugin-pwa` auto update service worker, manifest description "Vinnuborð Mettu"
- **Markdown:** `marked` and `dompurify` render Markdown in the panel reader. Loaded lazily (`Markdown.tsx` is a lazy chunk), so the board bundle does not carry them. No other UI libraries, icons are inline SVG.
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
│   ├── vinnubord.css  # all board styles; tokens on :root at the top (see Design System)
│   ├── lib/        # pure logic + *.test.ts: types, api (Supabase calls), status (buckets, wire mode, names), filters, upload,
│   │               #   continuation, geometry (view, zoom, fit, bezier), gesture, spring, layout, placement, reads (unread),
│   │               #   panel, sheet, history, clipboard, markdown, newItem, toast, motion, realtime, settings
│   ├── hooks/      # useViewer (memberships), useBoardData (load + realtime + live flag), useViewport (pan, zoom, pinch),
│   │               #   useCardDrag, useFilter, useNewItemToast, useAsyncAction, useOptimisticToggle
│   ├── components/ # Shell, Loader, LoadError, TopBar, FilterMenu, Board, Wires, Aurora, PackColumn, ModuleCard, ItemCard,
│   │               #   PanelShell, ItemPanel, ModulePanel, NewItemSheet, Toast, CopyButton, Markdown, MarkdownView
│   │   ├── panel/      # StatusTab, PlanList, RulingList, ActionList, FilesTab and the other tabs of the item panel
│   │   └── settings/   # ProjectFields, PackagesEditor, ModulesEditor, ParticipantsEditor, parts
│   └── pages/      # HomePage, BoardPage, ProjectSettingsPage, NoAccessPage
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

Some kept shared files (Avatar, ModalShell, useLanguagePreference) are not imported right now. Check before deleting.

## Routes

- `/` : `HomePage`. Signed out goes to `/login`. Signed in goes to the viewer's first project, or `NoAccessPage` if they are a participant in none.
- `/login` : sign in and forgot password. No signup, accounts are created by Heimir.
- `/auth/callback` : Supabase email confirm and password recovery redirects, then to `/` or `/reset-password`.
- `/reset-password` : new password form, then to `/`.
- `/p/:slug` : `BoardPage` for one project (protected, participant only).
- `/p/:slug/stillingar` : `ProjectSettingsPage` (protected, participant only): project name, repo path and context bundle, packages, modules and participants. Editors live in `src/vinnubord/components/settings/`.
- `*` : redirects to `/`.

## Supabase

- **Project:** `czdjxtsjgughimlazdmu`, region eu-west-2. **Shared with other small projects.** Touch only `hg_` objects. The Auth Site URL is shared too, do not change it; the code passes `emailRedirectTo` explicitly.
- The old `huginn_` tables, helper functions and the `huginn-meta-publish` cron job were dropped on 2026-10-31. Only `huginn_profiles` remains and must stay: the shared auth trigger `handle_new_user` on `auth.users` inserts into it for every new user of every project on this database, and `useProfile` reads it. The old buckets `huginn-attachments` and `huginn-avatars` are unused and can be deleted in the dashboard.
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
- `0002_hg_rls_hardening` : applied by Heimir in the SQL editor on 2026-10-31 (the MCP connector declines DROP statements). Not listed in `supabase_migrations.schema_migrations`.
- `0003_hg_triggers_storage` : applied through MCP. Adds updated_at touch on items and plans, the `hg_events` log written by security definer triggers, answering the last open question moves the item to waiting with `waiting_on` = service user, `closed_at` set on entering done/dropped and cleared on reopen, author stamping from `auth.uid()` (created_by, asked_by, uploaded_by, user_id, updated_by, answered_by, done_by), and the private bucket `hg-files` (50 MB limit) with storage policies `hg_files_storage_select/insert/delete` through `hg_can_access_path(name)`. There is no storage UPDATE policy, so uploads must use `upsert: false`.
- `0004_hg_trigger_fixes` : applied through MCP. Answering the last question no longer moves done, dropped or parked items; a `waiting_on` change logs `item.status` (data adds `waiting_on_from`); answer and done stamps cannot be forged and are stamped on insert too (new trigger `hg_actions_stamp_ins_trg`); a pos only update keeps `updated_at` and `updated_by`; an insert keeps a supplied `closed_at`; `hg_service_user` is no longer executable by `authenticated`.
- `0005_hg_add_participant` : applied through MCP. `hg_add_participant(p_project, p_email, p_short, p_name)` security definer RPC: only a participant of the project may call it, it looks the user up in auth.users by email ("Notandi fannst ekki" when there is none), refuses someone already in the project and always inserts `is_service = false`. Execute granted to `authenticated` only. Removing a participant (never yourself or the service user) and deleting a module (only one without items or comments) are guarded in the UI and in `lib/api.ts`, RLS is unchanged.
- `0006_hg_reads_clock_and_guards` : applied by Heimir on 2026-10-31 (the MCP connector was not connected in the fix session). Trigger `hg_reads_stamp_trg` (before insert or update) sets `hg_reads.read_at = now()`, so read marks use the server clock like `updated_at`; `markRead` no longer sends `read_at`. `hg_add_participant` also checks the short name (not empty, at most 3 characters, unique per project case insensitively, errcode 22023) and turns a `unique_violation` on the insert into the Icelandic "already a participant" message (23505). `npm run smoke:hg` scenario 5 asserts the server stamp.

### Auth

Email and password through Supabase Auth, email confirmation on. Password reset goes `/auth/callback?type=recovery` then `/reset-password`. Participants are Heimir, Árni and a Claude service user (`claude@huginn.pro`, auth id `6ea33ea7-0072-4e4b-a625-156ebf487399`, participant of metta with short `C`, `is_service = true`; password in `.env` as `HG_SMOKE_PASSWORD`). A sandbox user `sandbox@huginn.pro` (participant of no project, credentials `HG_SANDBOX_*` in `.env`) exists for testing the no-access path. Access to a project is decided by `hg_participants` only.

Plan 4's edge function must sign in as the Claude service user (preferred, so RLS applies) or set `updated_by` on every write, because `hg_stamp_author` keeps a supplied `updated_by` only when `auth.uid()` is null.

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

Two token layers. `src/index.css` holds the app chrome under `@theme` (Tailwind): purple accent `#6c5ce7` on neutral grey (`huginn-base`, `huginn-surface`, `huginn-card`, `huginn-border`), used by login and shared components.

The whiteboard has its own look (blue grey board, gold, lilac, coral, teal and stone status colors, Manrope with system fallbacks, loaded from a Google Fonts link in `index.html`). Every value lives as a custom property on `:root` at the top of `src/vinnubord/vinnubord.css`, `--hg-*`, grouped by section comments: Base (font, board, ink, line, surface, the five status tones, radii, `--hg-touch` 44 px target, field font size), Pack columns, Module cards, Board surface and zoom controls, Item cards, Notice and toast, Aurora, Side panel and bottom sheet, Panel content, Buttons and fields, Copy, code and path blocks, Status tab, files, questions and history, Module rows and comment box, Markdown reader, Top bar and filter menus, New item sheet, Project settings page, Motion (`--hg-ease`, `--hg-spring`, `--hg-dur-*`, zeroed under `prefers-reduced-motion`). Rules below the token block read only tokens; the few literals left are 1 px hairlines, breakpoints and stroke widths. Keep it that way, Heimir will restyle by editing tokens. Tone classes `.hg-tone-gold|lilac|coral|teal|stone` set `--hg-c` for cards, dots and pills.

Brand: raven mark and `huginn` wordmark in `src/shared/components/Logo.tsx`. Icons in `public/icons/` and `public/brand/`.

## Key Patterns

- **Realtime board data.** `useBoardData` loads the whole board through `lib/api.ts` and subscribes to hg_ tables filtered on `project_id`. Channel names use `crypto.randomUUID()` to avoid collisions between hook instances. Realtime DELETE events are not delivered to `project_id` filtered subscriptions under RLS (Supabase sends only the primary key for a delete, so the filter cannot match and replica identity full would not help): a deleted row disappears on other open boards only at their next change or reload. The deleting client reloads itself.
- **Pure logic is tested.** Anything that decides status, counters, filters, upload rules or the continuation prompt lives in `src/vinnubord/lib/` without React or Supabase, with a vitest file next to it. Test files import from `vitest` explicitly because `tsc -b` compiles `src`.
- **Gesture contract.** `useViewport` owns pan, wheel zoom and pinch on the board element and exposes a `gestureRef` (pinching state). `useCardDrag` is bound on the world layer and runs first: mouse lifts a card on press and drags past 3 px; touch lifts after a 350 ms long press, and a touch that moves more than 10 px before that gives up and the viewport pans instead. Two touches always pinch, also with a finger on a card, and a pinch cancels a lifted drag and returns the card to its start. `useCardDrag` never calls `stopPropagation`, and card elements are `div role="button"` (not `<button>`) because the viewport ignores pointers on buttons. Drag only writes `pos_x` and `pos_y`, springs run in the Wires animation frame so wires read card rects after they moved.
- **Panel survives refetch.** `BoardPage` keys `ItemPanel` by item id, so tab, scroll and drafts live across realtime refetches and reset when another item opens. `markRead` runs on open and whenever someone else changes the open item (not after the viewer's own change, `needsReadMark` in `lib/reads.ts`). The server stamps `read_at`. Optimistic toggles (`useOptimisticToggle`) follow the live value when realtime brings it.
- **Counter pills filter by count bucket.** `countBucket(item, actions, viewerId)` in `status.ts` decides which pill an item counts in (new, mine, others, build, parked), `countsFor` uses it, and `BUCKET_TONE` maps a bucket to the tone the filter matches, so a pill number and its filter always agree. Card color still comes from `itemTone`.
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
