# Runes + Meta Social rune

## Context

Heimir runs several small businesses (real estate, camping, apps) and wants to manage their social media posting from inside Huginn rather than a separate app. Rather than bolt social features into every board, we introduce **Runes** — Trello-style Power-Ups, rebranded Norse. Each rune is an optional board module that attaches components to specific UI surfaces and is enabled per-board by an owner/admin. Most boards won't touch Runes; the social-media boards (one per business) will enable the Meta Social rune.

Scope covers two things at once, because one of them wouldn't exist without the other:

1. The **Runes framework** — a minimal registry + surface-mount system + enable/disable UI. Kept thin; grows as later runes demand new surfaces.
2. The **Meta Social rune** — the first rune. Schedules and auto-publishes posts to Facebook Pages and Instagram Business accounts via the Meta Graph API.

Only FB + IG are in scope. Heimir doesn't use X, TikTok, LinkedIn, or YouTube at any meaningful volume. No manual approval step — posts auto-publish at their scheduled time.

## Decisions

| Question | Choice |
|---|---|
| Name for the Power-Up concept | **Runes** (Norse, short, "etch a rune on a board") |
| A post = ? | A Huginn card. The rune adds metadata, a dedicated composer, and a calendar view — cards remain the storage. Path 3 of the brainstorm. |
| Per-platform captions | Yes. Base caption + optional FB/IG overrides. |
| Scheduling approach | Huginn-owned scheduler (pg_cron or Supabase scheduled edge function) fires `meta-publish` edge function at `scheduled_at`. We do **not** use Meta's native `scheduled_publish_time` — IG doesn't support it, and single-path logic across both platforms keeps the code simple. |
| Approval flow | None. Solo-post, auto-publish. |
| Token storage | `access_token_encrypted` via `pgcrypto`, key in edge function env. Browser never receives a token. |
| Media source | The card's existing `huginn_attachments` (image/video only). User picks which attachments to include per post and orders them. |
| Status lanes | Not tied to lists. Status is derived from `status` column + `scheduled_at`. Users can still arrange lists however they want (Draft / Scheduled / Posted) — the rune doesn't assume a list structure. |
| Which boards see the rune | Any board where owner/admin enabled it. Defaults to off. |

## The Runes framework

### Registry

A single TypeScript module exports the list of registered runes. Hard-coded in v1 — no dynamic loading, no third-party runes, no iframes.

```ts
// src/runes/index.ts
type RuneDefinition = {
  id: string;                  // 'meta-social'
  name: string;                // i18n key, e.g. 'runes.meta-social.name'
  tagline: string;             // i18n key
  icon: ReactNode;             // rendered in the board settings list
  surfaces: {
    boardButton?: ComponentType<{ projectId: string }>;
    boardSettings?: ComponentType<{ projectId: string }>;
    boardView?: ComponentType<{ projectId: string }>;
    cardBackSection?: ComponentType<{ task: Task }>;
    cardBadges?: ComponentType<{ task: Task }>;
    cardDetailBadges?: ComponentType<{ task: Task }>;
  };
  onEnable?: (projectId: string) => Promise<void>;
  onDisable?: (projectId: string) => Promise<void>;
};

export const RUNES: RuneDefinition[] = [metaSocialRune];
```

Each rune's surface components are mounted wherever the host surface is rendered (CardPopup, BoardView, ProjectSettingsDrawer, the top-bar button slot). A shared `useEnabledRunes(projectId)` hook returns the active set for a board.

### Surfaces in v1

Only the surfaces the Meta rune needs. Future runes add new kinds as required (list-actions, attachment-sections, etc.).

- `boardButton` — mounted into `ToolBar` alongside existing buttons
- `boardSettings` — mounted into `ProjectSettingsDrawer` inside a new "Runes" section
- `boardView` — mounted into `ProjectDetailPage` when activated (replaces the default `BoardView`)
- `cardBackSection` — mounted into `CardPopup` above the attachments section
- `cardBadges` — mounted into `TaskCard` front
- `cardDetailBadges` — mounted into `CardPopup` at the top of the card back

### Storage

```sql
create table huginn_board_runes (
  project_id uuid not null references huginn_projects(id) on delete cascade,
  rune_id    text not null,
  enabled    boolean not null default false,
  settings   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, rune_id)
);
alter publication supabase_realtime add table huginn_board_runes;
```

RLS:
- SELECT: `huginn_is_board_member(project_id, auth.uid())`
- INSERT / UPDATE / DELETE: `huginn_can_manage_board(project_id, auth.uid())`

### Enable/disable UI

`ProjectSettingsDrawer` gets a new "Runes" section listing every entry in the registry with a toggle. Flipping a toggle upserts `huginn_board_runes` and calls the rune's `onEnable` / `onDisable`. Non-admins see toggles disabled with a tooltip.

## Meta Social rune — data model

### `huginn_social_accounts`

```sql
create table huginn_social_accounts (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references huginn_projects(id) on delete cascade,
  provider          text not null default 'meta',
  fb_page_id        text not null,
  fb_page_name      text not null,
  ig_business_id    text,
  ig_username       text,
  access_token_encrypted bytea not null,
  token_expires_at  timestamptz,
  connected_by      uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (project_id, fb_page_id)
);
```

RLS:
- SELECT non-sensitive columns: board members via `huginn_is_board_member`
- `access_token_encrypted` column-level: revoke from `authenticated` and `anon`. Only `service_role` (edge functions) can read.
- INSERT / UPDATE / DELETE: `huginn_can_manage_board`

### `huginn_social_posts`

```sql
create table huginn_social_posts (
  task_id              uuid primary key references huginn_tasks(id) on delete cascade,
  platforms            jsonb not null default '{"fb": false, "ig": false}'::jsonb,
  scheduled_at         timestamptz,
  timezone             text not null default 'UTC',
  caption_base         text not null default '',
  caption_ig           text,
  caption_fb           text,
  first_comment_ig     text,
  media_attachment_ids uuid[] not null default '{}',
  status               text not null default 'draft'
    check (status in ('draft', 'scheduled', 'publishing', 'published', 'failed')),
  published_at         timestamptz,
  fb_post_id           text,
  ig_post_id           text,
  error_message        text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index on huginn_social_posts(status, scheduled_at) where status = 'scheduled';
alter publication supabase_realtime add table huginn_social_posts;
```

RLS: SELECT + INSERT/UPDATE/DELETE via `huginn_can_access_task(task_id, auth.uid())`. Matches the task's access model.

`updated_at` trigger mirrors `huginn_tasks_touch_updated_at_trg`.

### Encryption helpers

```sql
-- in edge function env: HUGINN_TOKEN_ENCRYPTION_KEY (32 bytes, base64)
-- only service_role calls these
create or replace function huginn_encrypt_token(plain text, key bytea)
  returns bytea language sql security definer as $$
  select pgp_sym_encrypt(plain, encode(key, 'hex'));
$$;
create or replace function huginn_decrypt_token(cipher bytea, key bytea)
  returns text language sql security definer as $$
  select pgp_sym_decrypt(cipher, encode(key, 'hex'));
$$;
revoke all on function huginn_encrypt_token, huginn_decrypt_token from public, authenticated, anon;
grant execute on function huginn_encrypt_token, huginn_decrypt_token to service_role;
```

## Meta Social rune — UX surfaces

### `boardSettings` — "Meta Social" sub-panel

- If no account connected: "Connect Meta account" button → kicks off OAuth
- If connected: FB Page name + IG username (or "IG not linked" warning), "Reconnect" button, "Disconnect" button (danger, requires confirm)
- Default timezone picker (defaults to Iceland on first save)

### `boardButton` — "Social calendar"

Top-bar button (calendar glyph). Clicking opens the rune's `boardView`.

### `boardView` — calendar view

Reuse `CalendarView` infrastructure. Cells show media thumbnail + platform icons + status pill. Drag a post between cells to reschedule (updates `scheduled_at`). Click a post → opens that card's `CardPopup`.

Filter: only tasks that have a matching `huginn_social_posts` row with `scheduled_at IS NOT NULL`.

### `cardBackSection` — the "Publish" panel

Rendered on every card when the rune is enabled on the board, even if that card isn't a post yet (empty state = "Turn this card into a post" button; first save creates the `huginn_social_posts` row).

Fields:
- Platform toggles (☑ FB ☑ IG), disabled per platform if the connected account lacks that link (e.g. IG not linked on the Page)
- Datetime picker for `scheduled_at` + timezone (inherits board default)
- Caption (base) — a plain textarea with char counter. Emoji + @-handles of the connected Meta account's friends are NOT resolved — this is for the post text, not a Huginn mention.
- "Per-platform overrides" collapsible: FB caption, IG caption, IG first-comment
- Media picker — grid of the card's image/video attachments; tick to include, drag to reorder within the selected set
- Action row, driven by `status`:
  - `draft`: "Save draft" · "Schedule" (disabled unless `scheduled_at` in the future + at least one platform + valid media)
  - `scheduled`: "Unschedule" · "Publish now" · shows "Scheduled for Tue 14:00"
  - `publishing`: disabled, spinner "Publishing…"
  - `published`: "Posted ✓" with "Open on FB ↗" / "Open on IG ↗" links
  - `failed`: red banner with `error_message` + "Retry" button (flips back to scheduled for immediate re-run)

Validation surfaced inline (not at schedule time):
- IG images must be ≤ 8 MB, JPEG
- IG videos: MP4/MOV, ≤ 100 MB for regular, aspect ratio within IG bounds
- FB similar but looser
- Multi-image posts: IG needs 2–10 images, all same aspect ratio family

Validation errors block the "Schedule" button with a per-file reason tooltip.

### `cardBadges` — front of card

- Platform icons (FB / IG glyphs) for whatever's enabled on the post
- Status pill: "Tue 14:00" (scheduled) / "Posted ✓" / "Failed" — color-coded

### `cardDetailBadges` — top of card back

One-line summary: "📅 Scheduled Tue 14:00 · IG + FB" or "✅ Published 2h ago" or "⚠ Publish failed: <reason>".

## OAuth flow

1. User clicks "Connect Meta account" in board settings
2. Browser redirects to `https://www.facebook.com/v21.0/dialog/oauth` with scopes: `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`, `business_management`. `state` includes the target `project_id` + CSRF token.
3. Meta redirects to `/auth/meta-callback?code=…&state=…`
4. The callback page POSTs `code` + `state` to edge function `meta-oauth-complete`
5. Edge function:
   - Validates CSRF
   - Exchanges `code` → short-lived user token
   - Exchanges short-lived → long-lived user token
   - Calls `/me/accounts` to get the FB Page list; user picks which Page (if multiple) — we return the list to the browser for the picker step, *then* receive their pick back
   - Fetches the Page token (long-lived, non-expiring)
   - Queries `/{page_id}?fields=instagram_business_account` to discover the IG Business ID
   - Encrypts the Page token and upserts `huginn_social_accounts`

Browser only handles the redirect + Page picker UI. Tokens never reach it.

## Publishing pipeline

### Edge function `meta-publish`

Input: `post_id` (a `huginn_social_posts.task_id`). Service-role invocation only.

Flow:
1. Load post + account. Decrypt token.
2. If `status !== 'publishing'`, flip it to `publishing` (should already be done by the scheduler, belt-and-suspenders).
3. Resolve media URLs from `media_attachment_ids` via `huginn_attachments.url`.
4. Per enabled platform:
   - **FB single image:** POST `/{page_id}/photos` with `url` + `message` + `access_token`
   - **FB multi-image:** POST each photo with `published=false` → collect IDs → POST `/{page_id}/feed` with `attached_media=[{media_fbid: …}]`
   - **FB video:** POST `/{page_id}/videos` with `file_url` + `description`
   - **IG single image:** POST `/{ig_user}/media` with `image_url` + `caption` → get container ID → POST `/{ig_user}/media_publish` with `creation_id`
   - **IG carousel:** same, but `media_type=CAROUSEL` + child container IDs
   - **IG first comment:** after `media_publish`, POST `/{media_id}/comments` with `first_comment_ig`
5. On success: store `fb_post_id` / `ig_post_id`, set `status='published'`, `published_at=now()`.
6. On any platform failure: `status='failed'`, `error_message=<message>`. Partial success (FB posted, IG failed) counts as `failed` for v1 — we keep the FB post ID so the user sees "posted to FB, failed on IG" in the error UI.

### Scheduler

`pg_cron` runs every minute:

```sql
select cron.schedule(
  'meta-publish-scheduler',
  '* * * * *',
  $$
  with due as (
    update huginn_social_posts
       set status = 'publishing'
     where status = 'scheduled'
       and scheduled_at <= now()
     returning task_id
  )
  select net.http_post(
    url := current_setting('app.meta_publish_url'),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.meta_publish_secret'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('post_id', task_id)
  )
  from due;
  $$
);
```

The `app.meta_publish_url` + `app.meta_publish_secret` are set once via `alter database … set`. The `meta-publish` edge function validates the bearer header before processing.

Atomicity: the `UPDATE … WHERE status='scheduled'` flips to `publishing` in a single statement, so two cron ticks can't double-fire the same post.

## Env vars

New entries for `.env` (Vite-visible) and Supabase edge functions (server-only):

**Vite (browser):**
```
VITE_META_APP_ID=...
VITE_META_OAUTH_REDIRECT_URI=https://huginn.pro/auth/meta-callback
```

**Edge functions (server):**
```
META_APP_ID=...
META_APP_SECRET=...
META_OAUTH_REDIRECT_URI=https://huginn.pro/auth/meta-callback
HUGINN_TOKEN_ENCRYPTION_KEY=<32-byte base64>
META_PUBLISH_SECRET=<shared secret for cron → edge function auth>
```

**Vercel production + Supabase edge function secrets** — document both sets in the handoff at end of v1.

## Routes

- `/auth/meta-callback` — client page; reads `code` + `state` from URL, POSTs to `meta-oauth-complete`, handles Page-picker UI, closes on success. Fits into `AppRouter`.

## File layout

```
src/
├── runes/
│   ├── index.ts                          # RUNES registry + RuneDefinition type
│   ├── useEnabledRunes.ts                # reads huginn_board_runes
│   ├── RuneSurfaceHost.tsx               # helper for mounting surface components
│   └── meta-social/
│       ├── index.ts                      # exports the RuneDefinition
│       ├── MetaBoardSettings.tsx
│       ├── MetaBoardButton.tsx
│       ├── MetaCalendarView.tsx
│       ├── MetaPublishSection.tsx        # cardBackSection
│       ├── MetaCardBadges.tsx
│       ├── MetaCardDetailBadges.tsx
│       ├── MediaPicker.tsx
│       ├── hooks/
│       │   ├── useSocialAccount.ts
│       │   ├── useSocialPost.ts
│       │   └── useScheduledPosts.ts
│       └── validation.ts                 # Meta media limits
├── pages/
│   └── MetaCallbackPage.tsx
└── features/
    └── projects/components/
        ├── ProjectSettingsDrawer.tsx     # +Runes section
        ├── CardPopup.tsx                 # +cardBackSection/cardDetailBadges mount
        ├── TaskCard.tsx                  # +cardBadges mount
        ├── BoardView.tsx                 # unchanged
        └── ...

supabase/
├── migrations/
│   ├── YYYYMMDD_add_huginn_board_runes.sql
│   ├── YYYYMMDD_add_huginn_social_accounts.sql
│   ├── YYYYMMDD_add_huginn_social_posts.sql
│   ├── YYYYMMDD_add_token_crypto_helpers.sql
│   └── YYYYMMDD_add_meta_publish_cron.sql
└── functions/
    ├── meta-oauth-complete/
    │   └── index.ts
    └── meta-publish/
        └── index.ts
```

## Security

- Tokens are encrypted with `pgp_sym_encrypt`. Key lives only in edge function env — not in the DB, not in the client bundle.
- `access_token_encrypted` column has `authenticated` + `anon` revoked. Even a leaked anon key can't read it.
- The cron → edge function call authenticates with a shared secret in the `Authorization` header; edge function rejects any other caller.
- OAuth `state` includes a CSRF token Huginn generates before redirecting, stored in `sessionStorage`, checked by the callback page before posting to the edge function.
- The edge function rate-limits per-board publish calls (sanity bound, even though cron shouldn't flood).
- Disconnecting a Meta account deletes the `huginn_social_accounts` row. Existing `huginn_social_posts` rows keep their `fb_post_id` / `ig_post_id` for audit. Any `status='scheduled'` posts are flipped to `status='failed'` with `error_message='Meta account disconnected'` by the same RPC that drops the account, so the cron can't fire them against a missing token.
- If a card attachment referenced in `media_attachment_ids` is deleted before publish, the edge function returns `status='failed'` with an explicit error rather than silently skipping the file. This is consistent with the "validation errors block scheduling" rule for the composer-time case.
- If the connected Meta account has no linked IG Business account (`ig_business_id IS NULL`), the composer disables the IG platform toggle with a tooltip: "No Instagram Business account linked to this Page."

## Meta app review reality

Heimir has FB Pages + IG Business accounts linked. That clears the prerequisites. However, `pages_manage_posts` + `instagram_content_publish` require Meta App Review — typically 1–3 weeks. Until approved, the app works only for Heimir's own account + any test users added to the Meta developer app. We build and test under test-user mode, submit for review, flip on broader use on approval. The v1 implementation plan must include the app-review submission as its own step.

## v1 scope (this spec)

- Runes framework table, registry, `useEnabledRunes`, surface mount points
- `boardSettings` Runes section with enable/disable toggles
- Meta Social rune registered with all six surface components
- OAuth flow end-to-end (edge function + callback page + Page picker)
- `huginn_social_accounts` + `huginn_social_posts` tables with RLS, realtime, encryption helpers
- Composer: base caption + per-platform overrides + IG first comment + scheduled_at + media picker + platform toggles
- Validation for Meta media limits
- Calendar view (reusing `CalendarView`) filtered to scheduled posts
- Card front + back badges
- `meta-publish` edge function handling FB + IG single/multi-image + IG carousel + first-comment
- `pg_cron` scheduler every minute
- Status transitions with retry on failure

## Out of scope (deferred)

- Analytics pull (likes, reach, comments on live posts)
- Reels, Stories, video beyond basic upload
- Retry queueing / exponential backoff
- Bulk CSV import
- Recurring posts ("every Tuesday 10am") — reuse `huginn_tasks.recurring`?
- AI caption assistance
- Other platforms (X, TikTok, LinkedIn, YouTube, Threads, Pinterest)
- Third-party runes / dynamic rune loading
