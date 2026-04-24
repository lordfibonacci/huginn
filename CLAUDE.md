# Huginn

Personal-first project management PWA (Trello-style, multi-user). Capture thoughts via text or voice, triage them into Trello-style boards, collaborate with invited members. Live at **huginn.pro** (Vercel).

Heimir is the founder (Iceland, Markaðsdeildin). Each project is an independent business (real estate, camping, apps, etc.) — projects are NOT related sub-projects.

## Tech Stack

- **Frontend:** React 19 + Vite 6 + TypeScript
- **Styling:** Tailwind CSS 4 (via `@tailwindcss/vite` plugin) with `huginn-*` color tokens defined in `@theme` in `src/index.css`. **No `tailwind.config.ts`** — v4 uses the `@theme` directive.
- **Backend:** Supabase (Postgres, Auth, RLS, Realtime, Storage)
- **Rich Text:** Tiptap (ProseMirror-based) for card descriptions
- **Markdown / text viewer:** `marked` (GFM) + `DOMPurify` via `TextAttachmentViewer`. Clicking a `.md`/`.txt`/`.csv`/etc. attachment opens an inline reader; helpers `isMarkdownAttachment` / `isPlainTextAttachment` / `textAttachmentKind` live in the same file. Rendered HTML uses the `.huginn-markdown` class from `src/index.css`.
- **Drag & Drop:** `@dnd-kit/core` + `@dnd-kit/sortable` (lifted DndContext in `ProjectDetailPage` so board + inbox share it)
- **PWA:** `vite-plugin-pwa` auto-update service worker
- **Voice:** Web Speech API (browser-native)
- **Routing:** React Router v7 (nested routes with `Layout`)
- **Image pipeline:** `sharp` via `scripts/build-brand-assets.mjs` (PWA icons + optimised brand PNGs); run `npm run brand` after replacing source assets

## Commands

```bash
npm run dev       # Vite dev server (prefers 5173, falls back to 5174)
npm run build     # tsc -b && vite build (Vercel runs this)
npm run preview   # Preview production build
npm run lint      # ESLint — currently broken (v9 expects eslint.config.js, migration pending). Use `npm run build` / `tsc -b` as the verification gate.
npm run brand     # Regenerate PWA icons + optimise brand PNGs from /Graffík source
npm run translate # Regenerate is.json from en.json via OpenRouter Gemini
```

## Architecture

Feature-module structure. Desktop has a floating Trello-style toolbar (`ToolBar`) and an optional sidebar inbox (`InboxPanel`). Mobile uses a three-tab `BottomNav` (Inbox · Boards · You) and a dedicated `/inbox` page for quick capture.

```
src/
├── app/                  # AppRouter, Layout
├── features/
│   ├── inbox/
│   │   ├── components/   # InboxPanel, VoiceButton, ThoughtCard (legacy), etc.
│   │   └── hooks/        # useInbox, useVoiceRecorder, useThoughts (legacy)
│   └── projects/
│       ├── components/   # BoardView, ListColumn, CardPopup, TaskCard, ChecklistSection,
│       │                   LabelPicker/Badges, MemberPicker/Avatars, DatePicker,
│       │                   CalendarView, ProjectSettingsDrawer, ProjectColorPicker,
│       │                   BoardBackgroundPicker, ProjectCard (tile), ProjectGlyph,
│       │                   BoardMembersDrawer, BoardMembersStack, PendingInvitesPanel,
│       │                   CardThreeDotMenu, MoveCardDialog, RichTextEditor,
│       │                   CommentSection
│       └── hooks/        # useProjects, useLists, useProjectTasks, useChecklists,
│                           useChecklistItems (legacy), useLabels, useTaskLabels,
│                           useComments, useActivity, useAttachments, useBoardMembers,
│                           useBoardRole, usePendingInvites, useTaskMembers,
│                           useProjectNotes (legacy)
├── shared/
│   ├── components/       # Layout, BottomNav, ToolBar, ModalShell, Avatar,
│   │                       AccountMenu, AccountSettings, AccountSettingsDrawer,
│   │                       HexInput, Logo (Mark/Wordmark/Lockup/LoadingScreen/EmptyState)
│   ├── hooks/            # useAuth, useProfile, useAvatarUpload, useTaskCounts,
│   │                       useProfileSearch
│   └── lib/              # supabase client, types, dateUtils, boardBackgrounds
├── pages/                # LandingPage, LoginPage, AuthCallbackPage, ResetPasswordPage,
│                           ProjectsPage, ProjectDetailPage, InboxPage, SettingsPage
└── main.tsx
```

## Routes

- `/` — public `LandingPage` (marketing). Authenticated users get bounced: desktop → `/projects`, mobile (< 768px) → `/inbox`.
- `/login` — sign-in / sign-up / forgot-password state machine. `?mode=signup` deep-links into the signup form. Signup gated by `VITE_INVITE_CODE` (default `Huginn_app2026!`).
- `/auth/callback` — handles Supabase email-confirm and password-recovery redirects.
- `/reset-password` — new password form (uses the recovery session).
- `/projects` — tile grid of boards (protected).
- `/projects/:id` — `ProjectDetailPage`: board view + optional inbox sidebar + floating ToolBar.
- `/inbox` — capture-first page (protected); voice + text.
- `/settings` — `SettingsPage`; also opens in-place as `AccountSettingsDrawer` from the toolbar avatar.

## Supabase

- **Project:** `czdjxtsjgughimlazdmu` (shared with other small projects). All Huginn tables prefixed `huginn_`.
- **Region:** eu-west-2.

### Tables

- `huginn_projects` — boards. Has `background` (preset id OR a custom CSS string), `color` (solid `#hex` OR `gradient:#a,#b`).
- `huginn_lists` — Trello-style columns on a board. Sorted by `position`.
- `huginn_tasks` — cards. `project_id IS NULL` ⇒ inbox card. Fields include `archived`, `updated_at` (trigger), `position`, `start_date`, `due_date`, `recurring`.
- `huginn_labels` + `huginn_task_labels` — project-scoped labels, label-task junction.
- `huginn_checklists` + `huginn_checklist_items` — multiple named checklists per card.
- `huginn_comments` — user comments on cards.
- `huginn_activity` — auto-logged feed (e.g. `attached` action with `{ name, url, type }` in `details`).
- `huginn_attachments` — file/image/link per card. `is_cover` promotes an image to the board-tile hero + CardPopup hero.
- `huginn_board_members` — project membership. `role ∈ {owner, admin, member}`, `status ∈ {pending, active}`, `invited_by uuid`. Pending invites appear on the invitee's `/projects` as `PendingInvitesPanel`.
- `huginn_task_members` — card assignees.
- `huginn_profiles` — `display_name`, `email`, `avatar_url`.
- `huginn_mentions` — one row per @ inserted in a description (`comment_id IS NULL`) or comment. RLS via `huginn_can_access_task`. Realtime-published.
- `huginn_card_views` — `(task_id, user_id)` PK + `viewed_at`. Updated on `CardPopup` / `TaskDetailDrawer` / `TaskDetailPanel` mount. Unread-mention count = `huginn_mentions WHERE created_at > my last viewed_at`. Self-only RLS. Realtime-published.
- (legacy, not used in UI) `huginn_thoughts`, `huginn_notes`.

### RLS — membership-based

All project-scoped tables route through `SECURITY DEFINER` helpers:
- `huginn_is_board_member(project_id, user_id)` — only active members.
- `huginn_board_role(project_id, user_id)` — returns role for active members.
- `huginn_can_manage_board(project_id, user_id)` — owner or admin.
- `huginn_can_access_task(task_id, user_id)` — handles both project tasks and owner-only inbox tasks (`project_id IS NULL`).
- `huginn_can_access_checklist(checklist_id, user_id)` — derives via task.

Triggers:
- `huginn_projects_add_owner_trg` — on insert, adds creator as `owner` active member.
- `huginn_tasks_touch_updated_at_trg` — `BEFORE UPDATE` bumps `updated_at`.

Pending-invite RPCs:
- `huginn_pending_invites_for(user_id)` — returns user's pending invites joined with project + inviter profile.
- `huginn_accept_invite(member_id)` — invitee flips their own row to `active`.

### Storage

- `huginn-attachments` — card files/images (public bucket). Path pattern: `${user_id}/${task_id}/${ts}_${name}`. Policies: public read, owner insert/update/delete where the first path segment equals `auth.uid()`.
- `huginn-avatars` — user profile pictures (public read, owner write). Path: `${user_id}/avatar-${ts}.${ext}`. Max 2 MB. Image MIME types only.

### Realtime publication

Tables must be in the `supabase_realtime` publication for `postgres_changes` to fire. Check with `SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename LIKE 'huginn_%'`. To enrol a new table: `ALTER PUBLICATION supabase_realtime ADD TABLE huginn_foo`.

### Auth

Email/password via Supabase Auth. **Email confirmation is ON**. Code passes `emailRedirectTo: ${origin}/auth/callback` so confirmation links bounce back to Huginn regardless of the Supabase Site URL (which is shared with Lovable apps, do not change). Password reset uses `/auth/callback?type=recovery` → `/reset-password`.

### Env vars (`.env`)

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_INVITE_CODE=Huginn_app2026!   # soft-gate for signup; rotate via Vercel env vars
OPEN_ROUTER_API=sk-or-v1-...       # for npm run translate (not needed at runtime)
```

## Internationalization

Two UI languages: **Icelandic (default)** and **English**. Managed by `react-i18next` via `src/shared/i18n/`.

- **Source of truth:** `src/shared/i18n/locales/en.json` (hand-maintained). Keys in `is.json` are emitted alphabetically by the translate script — insert manual additions in alpha order to avoid diff churn on the next run.
- `src/shared/i18n/locales/is.json` is generated by `npm run translate` — calls OpenRouter Gemini 3.1 Pro with the English source, hash-diffed per key so only changed/new keys get re-translated. Hand edits to `is.json` stick (cache in `.is.cache.json`, gitignored) as long as the English source doesn't change. Retries transient 504s and persists after each batch so partial progress isn't lost.
- **Language resolution order:** `huginn_profiles.locale` (DB) → `localStorage.huginn.lang` → `navigator.language` (English browsers → English, everyone else → Icelandic).
- **Switcher** in `AccountMenu`; preference synced to the nullable `huginn_profiles.locale` column (text, no default).
- **Dates:** `src/shared/lib/dateUtils.ts` uses `Intl.DateTimeFormat` / `Intl.RelativeTimeFormat` with the active locale. i18next plural suffixes (`_one`/`_other`) handle Icelandic-specific plural rules.
- **Voice:** `useVoiceRecorder` sets `recognition.lang` from `i18n.language` so Icelandic users dictate in Icelandic.
- **Missing keys** log to console in dev only — catches drift when adding new features. Convention: add key to `en.json`, run `npm run translate`, commit both JSONs.

## Design System

Tokens live in `src/index.css` under `@theme`. **Purple on neutral grey** (NOT midnight blue — that was an early spec; the midnight colour still exists but only as one of the per-project board-background presets).

- `--color-huginn-base: #1d2125` — nav, sidebars, toolbar
- `--color-huginn-surface: #282e33` — page background
- `--color-huginn-card: #22272b` — cards, inputs, drawers
- `--color-huginn-hover: #333c43`
- `--color-huginn-border: #3d474f`
- `--color-huginn-accent: #6c5ce7` (purple)
- `--color-huginn-accent-hover: #5b4bd5`
- `--color-huginn-accent-soft: rgba(108, 92, 231, 0.15)`
- `--color-huginn-success: #00b894` · `--color-huginn-warning: #fdcb6e` · `--color-huginn-danger: #e17055`
- `--color-huginn-text-primary: #e8e8f0` · `--color-huginn-text-secondary: #888888` · `--color-huginn-text-muted: #555555`

Board backgrounds (per-project): 9 presets (Default/Ocean/Sunset/Forest/Ember/Arctic/Midnight/Aurora/Storm) + custom 2-stop or 3-stop gradients. See `src/shared/lib/boardBackgrounds.ts` (`buildCustomGradient`, `parseCustomGradient`).

Project glyph: faceted SVG diamond (`ProjectGlyph`). Accepts a solid hex `#6c5ce7` OR `gradient:#from,#to`. Rendered with dark top-right facet + light bottom-left highlight + optional coloured halo (`drop-shadow`).

Brand: raven mark + `huginn` wordmark. `Lockup` / `Mark` / `Wordmark` components in `src/shared/components/Logo.tsx`. Favicon + PWA icons in `public/icons/` and `public/brand/`.

## Key Patterns

- **Hooks with Realtime.** Every data hook fetches on mount AND subscribes to Supabase Realtime. Channel names use `crypto.randomUUID()` to avoid collisions between hook instances.
- **Beware the RLS filter trap.** Postgres realtime evaluates a filter like `project_id=eq.X` against the event's NEW row, so rows that LEAVE the filter (task moved to another board or to inbox → `project_id` becomes null/other) never emit on the source board. When a table's filtered column can change, subscribe unfiltered and scope in the fetch instead. `useProjectTasks` now does this so every viewer of the source board sees tasks leave; `useInbox` and `useTaskCounts` too. `removeTaskLocal` stays as an optimistic drop ahead of the realtime echo.
- **Profile freshness across users.** `huginn_profiles` is in the realtime publication; `useProfile` watches the signed-in user's row, and `useBoardMembers` / `useTaskMembers` listen for UPDATEs on members' profile rows so teammate avatar/name/locale changes propagate without refresh.
- **Optimistic updates with rollback.** Mutations update local state first; on error revert to previous state.
- **ModalShell.** Centered modal on desktop, bottom drawer on mobile. Used by Project/Account settings + Move dialog.
- **Shared DndContext.** `ProjectDetailPage` owns the DndContext so the inbox sidebar and board can drag cards to each other. BoardView lists are per-list `SortableContext`s using `verticalListSortingStrategy`. Never unmount the active sortable item mid-drag (causes dnd-kit to lose track).
- **Phantom preview for inbox → list drops.** `inboxPreview` state injects a virtual task into `tasksWithPreview` so the destination list animates cards out of the way.
- **Feature barrels.** Each feature has an `index.ts` re-exporting its public API.
- **Feedback loop trap in controlled editors.** CardPopup's description debounces DB writes (700 ms), RichTextEditor's prop-sync skips when the editor is focused, and the card popup's `useEffect` only resets local state when `task.id` changes — not on every `task.notes` realtime echo. Violating any of these caused lost keystrokes in an earlier iteration.
- **Pending-reorder gate.** `handleDragEnd` in `ProjectDetailPage` fires N parallel per-row UPDATEs. Each emits its own realtime event → `tasks` / `lists` refetch with a PARTIALLY-reordered server snapshot mid-flight. The `[tasks]` and `[lists]` resync useEffects guard on `pendingReorderRef.current` to skip the resync until all writes complete. Without this, the card visibly jumps to wrong slots for 200–400 ms before the final echo settles ("drop lag").
- **Instant, Trello-style drops.** `DragOverlay dropAnimation={null}` plus every `useSortable` uses `transition: null` + `animateLayoutChanges: () => false`. If you reintroduce a transition or layout-animation, hover-time transforms finish animating to zero *after* release — visible as a flash or lag.
- **Per-list card sort lives in `ProjectDetailPage`**, not `BoardView`, because `handleDragEnd` needs to flip a list to `'manual'` on same-list card drops. `dragSourceListId` suspends the source list's sort visually during the drag (renders as manual) so dnd-kit's arrayMove has a stable order to reorder.
- **`dragOver` is for cross-list state changes only.** Calling `arrayMove` in `dragOver` for same-list reorders causes max-update-depth crashes when the active card's height differs from its swap partner (cursor stays over the same target → re-fire → loop). Same-list reorder happens only in `dragEnd`. dnd-kit's `verticalListSortingStrategy` handles the visual via transforms (instant snap thanks to `transition: null`).
- **Cross-list `dragOver` needs the `recentCrossListRef` guard.** Without it, `closestCorners` ping-pongs between cards in adjacent lists when the active card is tall (cover images), looping forever. Suppress the inverse of the most recent cross-list move within ~120 ms.
- **Mid-drag realtime refetches must be gated by `isDraggingRef`.** A teammate uploading an attachment or labelling a card during your drag re-creates `coverImageMap` / `taskLabelsMap`, re-renders every `TaskCard`, and worsens collision-detection thrash. Queue a trailing refetch (`pendingCoverRefetchRef` / `pendingLabelRefetchRef`) and flush it on `dragEnd` / `dragCancel`.
- **DragOverlay must render with the same data as the source card.** Pass `coverImageUrl` and `labels` to the overlay's `<TaskCard>` so the active rect's height matches what dnd-kit measured at drag start.
- **`backdrop-blur-*` creates a stacking context.** Absolutely-positioned children can't z-index above the parent's siblings. If a popover renders behind sibling content, give the parent an explicit `z-*` or use a document-level `mousedown` listener (not a fixed overlay) for outside-click dismissal.

## Multi-User

Fully shipped. Owner / admin / member roles (viewer removed). Pending-invite flow: adding a member inserts a `pending` row → they see it on `/projects` → accept (active) or decline (delete). Members get real-time access to everything on the board including the activity feed with inline image previews.

## Deployment

- **Prod:** https://huginn.pro on Vercel (auto-deploys on `main`).
- **Build command:** `npm run build` (Vercel default).
- **Env vars (Vercel):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_INVITE_CODE` — all Production scope. Without these the bundle throws `supabaseUrl is required` at mount.
- **Site URL** in Supabase Auth is *not* Huginn-specific (shared project). Do not change it; the code passes `emailRedirectTo` explicitly.

## Conventions

- Commit messages: `feat:`, `fix:`, `style:`, `refactor:`, `simplify:`, `docs:` prefixes. Commits include `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` when Claude authored.
- No tests yet.
- `.env` and `.superpowers/` are gitignored. `.playwright-mcp/` + `login-with-brand*.png` also gitignored.
- Favicon / branded icons are regenerated via `npm run brand`; source PNGs live outside the repo at `../Graffík/`.
- Feature work uses the superpowers `brainstorming` skill: brainstorm → write spec to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` → implement. Existing specs live alongside as reference.
- Top-level `ErrorBoundary` (`src/shared/components/ErrorBoundary.tsx`) wraps the router — render exceptions show the error panel instead of a blank screen. Useful for diagnosing live bugs from screenshots.
