# Huginn

Huginn is the shared work whiteboard for Metta ("vinnuborð Mettu"). Three participants read and write the same place: Heimir (decisions, running things), Árni (design, modules, specs in Markdown and HTML prototypes, never code) and Claude (analysis, plans, building, as its own service user). It replaces the Pending section of the metta2 CLAUDE.md, WhatsApp hand offs and memory notes as the single source for what is open. Live at **huginn.pro** (Vercel).

The old Trello style board, inbox, runes and Meta social planner are gone from the code. The repo, the name, login and the Supabase project stay.

Design spec: `docs/superpowers/specs/2026-10-31-huginn-vinnubord-design.md`. Plans: `docs/superpowers/plans/2026-10-31-vinnubord-{1-grunnur,2-bord,3-cli,4-skyndigreining}.md`.

Plan 5 (staða úr gögnum) is specced and planned, not built: spec `docs/superpowers/specs/2026-11-01-stada-ur-gognum-design.md`, plan `docs/superpowers/plans/2026-11-01-stada-ur-gognum.md`. Run it in an Opus session with subagent-driven-development; task 6 edits the `/huginn` skill in metta2_new.

## Current state

Plans 1 to 4 are built (423 vitest tests, `npm run build` green; `npm run smoke:hg` printed `ok 6/6` against the live DB at the end of plan 2).

- Plan 1 (grunnur): the `hg_` schema, API layer, realtime board data hook, pure status, filter, upload and continuation logic, the app shell, routes and the participant gate.
- Plan 2 (bord): the whiteboard. Pack columns and module cards, item cards with spring drag and wires with sparks on a canvas, pan and zoom with touch (pinch, two finger pan, 350 ms long press to drag), side panel and bottom sheet for items and modules (status, files, questions, history, comments, copy buttons, Markdown reader), top bar with counter pills, filters, search and a viewer menu, new item sheet with file upload, aurora and entry motion, new item toast, project settings. The live project metta is seeded with 5 packages and 28 modules.

- Plan 3 (cli): the `huginn` command line tool in `cli/` (read, write, `pull --brief`, `sync` mirror to `docs/huginn/` with `STATUS.md`), the `/huginn` skill and SessionStart hook in metta2_new, and the first fill of metta (73 items, `cli/seed/`).

- Plan 4 (skyndigreining): the edge function `hg-analyse` analyses new items with the Claude API (summary, body, tags, module, questions, status to waiting on Heimir). Built, deployed (version 10) and verified live on 2026-11-01: handpróf A to F all pass, at about 0.15 USD per analysis. Steps and results are in `docs/progress/04-vinnubord-skyndigreining.md`.

Open items are listed in `docs/progress/01-vinnubord-grunnur.md`, `docs/progress/02-vinnubord-bord.md`, `docs/progress/03-vinnubord-cli.md` and `docs/progress/04-vinnubord-skyndigreining.md`.

## Tech Stack

- **Frontend:** React 19 + Vite 6 + TypeScript
- **Styling:** Tailwind CSS 4 (via `@tailwindcss/vite`) with `huginn-*` color tokens in `@theme` in `src/index.css`. No `tailwind.config.ts`.
- **Backend:** Supabase (Postgres, Auth, RLS, Realtime, Storage)
- **Routing:** React Router v7
- **i18n:** `react-i18next`
- **Tests:** vitest, `src/**/*.test.ts` (pure logic in `src/vinnubord/lib/`), `cli/**/*.test.mjs` (CLI pure logic and parity with the web) and `supabase/functions/**/*.test.ts` (`lib.ts` of the edge function, which stays import free and Deno free so vitest can load it). `jsdom` is a dev dependency for the Markdown sanitizer test only (`// @vitest-environment jsdom`).
- **PWA:** `vite-plugin-pwa` auto update service worker, manifest description "Vinnuborð Mettu"
- **Markdown:** `marked` and `dompurify` render Markdown in the panel reader. Loaded lazily (`Markdown.tsx` is a lazy chunk), so the board bundle does not carry them. No other UI libraries, icons are inline SVG.
- **Image pipeline:** `sharp` via `scripts/build-brand-assets.mjs`

## Commands

```bash
npm run dev       # Vite dev server (prefers 5173, falls back to 5174)
npm run build     # tsc -b && vite build (Vercel runs this). Main verification gate.
npm run test      # vitest run
npm run preview   # Preview production build
npx -y deno@2 check --no-lock --node-modules-dir=none supabase/functions/hg-analyse/index.ts  # the only type check for index.ts (tsc -b covers src only)
npm run lint      # ESLint, currently broken (v9 expects eslint.config.js). Use build and test instead.
npm run brand     # Regenerate PWA icons and brand PNGs from ../Graffík source
npm run translate # Regenerate is.json from en.json via OpenRouter Gemini
npm run seed:metta # One time only, already run 2026-10-31. Refuses a real run once metta has items (--again overrides); --dry-run still works
node cli/huginn.mjs <command> # The huginn CLI (login, pull, sync, item, plan ...), see cli/README.md
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
cli/
├── huginn.mjs      # entry: login, whoami, pull, sync and the write command groups
├── lib/            # config, client, format, status, write (pure), ops (Supabase writes), commands, mirror (pure), sync + *.test.mjs
├── seed/           # seed.mjs, seedlib.mjs (pure, tested), metta-2026-10-31.json
└── README.md       # setup, credentials, every command and the mirror rules (Icelandic)
supabase/
├── migrations/        # numbered SQL migrations for hg_ objects
└── functions/hg-analyse/  # index.ts (Deno entry), lib.ts (pure helpers and SYSTEM_PROMPT), lib.test.ts. No prompt.md, the prompt is SYSTEM_PROMPT in lib.ts.
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
- `hg_packages`, `hg_modules` : fixed board structure. Modules belong to a package, have status_line, color, is_ghost. `color` is a tone name or a `#rrggbb` hex; the metta modules carry the metta module colors (`--color-m-*` in metta2_new `src/index.css`) since 2026-11-01. Kiosk, Öryggisfundir, Ábendingar and most of Þvert á allt and Sala og samstarf have no metta color and keep a tone.
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
- `0007_hg_analyse` : applied through MCP 2026-10-31. Adds `analysed_at` and `analyse_lock_until` on `hg_items`; `hg_touch_updated_at` also ignores `analyse_lock_until` (a lock only update marks nothing unread); `hg_claim_analysis(p_item)` atomic 2 minute lock (security invoker); `hg_log_analysis(p_item, p_kind, p_data)` security definer RPC that lets only the project's service participant write `analysis.done` and `analysis.failed` events; `hg_enqueue_analyse` security definer with triggers `hg_items_analyse_trg` and `hg_files_analyse_trg` (after insert) that post to the function through pg_net, reading URL and secret from Vault and doing nothing when either is missing.
- `0008_hg_plan_moves_item` : applied through MCP 2026-11-01. Trigger `hg_plans_move_item_trg` (after insert or update of status on `hg_plans`): a plan entering `building` puts the item in `building`; a plan entering `done` leaves the item alone while another plan is building, puts it in `ready` while another is todo, otherwise the item waits on the owner of the oldest open action, else on `asked_to` of the oldest unanswered question, else goes `done`. Items in done or dropped are never touched. `npm run smoke:hg` scenario 7 covers it.

### Edge function hg-analyse

Quick analysis of new items (plan 4). Live since 2026-11-01 (version 10). Deployed with the MCP `deploy_edge_function` as two files (`index.ts`, `lib.ts`), `verify_jwt` false because it checks its own bearer (`HG_ANALYSE_SECRET`). Edge secrets by name: `HG_ANALYSE_SECRET`, `HG_SERVICE_EMAIL`, `HG_SERVICE_PASSWORD`, and `HG_ANTHROPIC_API_KEY` or `ANTHROPIC_API_KEY` (the HG_ one wins when not empty; never change `ANTHROPIC_API_KEY`, other functions on the shared project may use it). Vault entries by name: `hg_analyse_secret` (same value as `HG_ANALYSE_SECRET`) and `hg_analyse_url`. Never write values in the repo. Flow: the `0007` triggers post `{ item_id }` through pg_net, the function answers 202 and works in `EdgeRuntime.waitUntil`: 20 s debounce, sign in as the service user, atomic 2 minute lock (`hg_claim_analysis`), gated write. The free plan has a 150 s wall clock per worker, which is why the Anthropic timeout is 90 s with no retries. Model `claude-opus-5-5`, effort medium.

### Auth

Email and password through Supabase Auth, email confirmation on. Password reset goes `/auth/callback?type=recovery` then `/reset-password`. Participants are Heimir, Árni and a Claude service user (`claude@huginn.pro`, auth id `6ea33ea7-0072-4e4b-a625-156ebf487399`, participant of metta with short `C`, `is_service = true`; password in `.env` as `HG_SMOKE_PASSWORD`). A sandbox user `sandbox@huginn.pro` (participant of no project, credentials `HG_SANDBOX_*` in `.env`) exists for testing the no-access path. Access to a project is decided by `hg_participants` only.

`hg-analyse` signs in as the Claude service user with the anon key (so RLS and the stamp triggers apply, no service role key) and skips items that user created itself, because those are Claude Code's own already analysed items. Árni's CLI items under his own account are analysed.

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

The whiteboard has its own look (blue grey board, gold, lilac, coral, teal and stone status colors, Manrope with system fallbacks, loaded from a Google Fonts link in `index.html`). Every value lives as a custom property on `:root` at the top of `src/vinnubord/vinnubord.css`, `--hg-*`, grouped by section comments: Base (font, board, ink, line, surface, the five status tones, radii, `--hg-touch` 44 px target, field font size), Pack columns, Module cards, Board surface and zoom controls, Item cards, Notice and toast, Aurora, Side panel and bottom sheet, Panel content, Buttons and fields, Copy, code and path blocks, Status tab, files, questions and history, Module rows and comment box, Markdown reader, Top bar and filter menus, New item sheet, Project settings page, Motion (`--hg-ease`, `--hg-spring`, `--hg-dur-*`, zeroed under `prefers-reduced-motion`). Rules below the token block read only tokens; the few literals left are 1 px hairlines, breakpoints and stroke widths. Keep it that way, Heimir will restyle by editing tokens. Tone classes `.hg-tone-gold|lilac|coral|teal|stone` set `--hg-c` for cards, dots and pills. A module with a hex color (`moduleAccent` in `lib/layout.ts`) sets `--hg-c` inline, so its bar, tint (`--hg-module-tint`, `--hg-module-border-tint`) and glow use its own color instead of the status tone; the settings color picker shows no swatch selected for a hex, and picking a tone overwrites it. Hovering a card magnifies it like a local zoom: `scale` is `--hg-card-peek-k` over the board zoom `--hg-z` (set on `.hg-world` by Board), clamped to `--hg-card-peek-min|max`, after `--hg-card-peek-delay`; mouse only (`hover: hover`), never while panning, dragging or dimmed. `.hg-board` sets `user-select: none`.

Brand: raven mark and `huginn` wordmark in `src/shared/components/Logo.tsx`. Icons in `public/icons/` and `public/brand/`.

## Key Patterns

- **Realtime board data.** `useBoardData` loads the whole board through `lib/api.ts` and subscribes to hg_ tables filtered on `project_id`. Channel names use `crypto.randomUUID()` to avoid collisions between hook instances. Realtime DELETE events are not delivered to `project_id` filtered subscriptions under RLS (Supabase sends only the primary key for a delete, so the filter cannot match and replica identity full would not help): a deleted row disappears on other open boards only at their next change or reload. The deleting client reloads itself.
- **Pure logic is tested.** Anything that decides status, counters, filters, upload rules or the continuation prompt lives in `src/vinnubord/lib/` without React or Supabase, with a vitest file next to it. Test files import from `vitest` explicitly because `tsc -b` compiles `src`.
- **Gesture contract.** `useViewport` owns pan, wheel zoom and pinch on the board element and exposes a `gestureRef` (pinching state). `useCardDrag` is bound on the world layer and runs first: mouse lifts a card on press and drags past 3 px; touch lifts after a 350 ms long press, and a touch that moves more than 10 px before that gives up and the viewport pans instead. Two touches always pinch, also with a finger on a card, and a pinch cancels a lifted drag and returns the card to its start. `useCardDrag` never calls `stopPropagation`, and card elements are `div role="button"` (not `<button>`) because the viewport ignores pointers on buttons. Drag only writes `pos_x` and `pos_y`, springs run in the Wires animation frame so wires read card rects after they moved.
- **Panel survives refetch.** `BoardPage` keys `ItemPanel` by item id, so tab, scroll and drafts live across realtime refetches and reset when another item opens. `markRead` runs on open and whenever someone else changes the open item (not after the viewer's own change, `needsReadMark` in `lib/reads.ts`). The server stamps `read_at`. Optimistic toggles (`useOptimisticToggle`) follow the live value when realtime brings it.
- **Counter pills filter by count bucket.** `countBucket(item, actions, viewerId)` in `status.ts` decides which pill an item counts in (new, mine, others, build, parked), `countsFor` uses it, and `BUCKET_TONE` maps a bucket to the tone the filter matches, so a pill number and its filter always agree. Card color still comes from `itemTone`.
- **Analysis rules.** `hg-analyse` never touches an item that is not `new` (the write is gated on status and on `updated_at`, with one re-merge). The author's body is kept verbatim under `## Upprunalegur texti`, the author's module and tags win over the model's. Success writes `analysis.done`, failure writes `analysis.failed` with error and stage and leaves the item `new`; both show in the item history. Skips (not found, not new, locked, created by the service user) are console only, no board event.
- **Status is stored, not computed.** Claude and the participants move status. Two triggers move it for them: answering the last open question (0003) and a plan entering building or done (0008). Dragging only arranges the board.
- **Board sizes have a CLI copy.** Changing pack, module or card tokens (`--hg-pack-*`, `--hg-module-*`, `--hg-card-*` sizes) means updating `base` in `cli/lib/write.mjs`; `parity.test.mjs` fails until they match. A whole board re-layout is data, not code: write `pos_x`/`pos_y` of packages and items as a participant (a pos only update keeps `updated_at`), using `estimateModuleHeight` and `estimateCardHeight` from `cli/lib/write.mjs` for sizes.
- **CLI copies web logic.** `cli/` is plain Node ESM and cannot import the TS in `src`, so it copies the rules it needs as `.mjs` (status names, `isOnBoard`, `waitsFor`, upload limits, `placeNewCard`, card sizes from `--hg-*` tokens) and `cli/lib/parity.test.mjs` asserts they match `src/vinnubord/lib` and `vinnubord.css`. Change both sides together. It signs in as a normal user with the anon key (the Claude service user in Heimir's setup), so RLS and the triggers apply; credentials live in `~/.huginn/`, never in a repo. Flags are strict: write commands and `sync` reject unknown flags.
- **ErrorBoundary** wraps the router, render errors show a panel instead of a blank screen.

## Deployment

- **Prod:** https://huginn.pro on Vercel, auto deploys on `main`. Build command `npm run build`.
- **Env vars (Vercel):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, Production scope. Without them the bundle throws `supabaseUrl is required`. `VITE_INVITE_CODE` is no longer used and can be removed.

## Conventions

- **Style:** no em dashes or hyphen dashes as punctuation anywhere: prose, UI copy, code comments, docs. Use commas, periods or colons. Icelandic UI, no all caps banners.
- Commit messages: `feat:`, `fix:`, `style:`, `refactor:`, `simplify:`, `docs:`, `chore:`, `test:` prefixes, scope `(vinnubord)` for this rebuild. Include a `Co-Authored-By:` trailer for the Claude model that authored the commit.
- Claude pushes. Heimir never pushes himself (2026-10-31), so when work is merged and verified on main, push it after checking the repo is clean and not behind origin. Never leave a push as a todo for Heimir.
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

Commit the CLAUDE.md update and push once the build is green.

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
