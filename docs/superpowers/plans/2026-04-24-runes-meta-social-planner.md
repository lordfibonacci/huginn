# Runes + Meta Social Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a "Runes" (Trello-Power-Ups-style) framework and the first rune — Meta Social Planner — which schedules and auto-publishes posts to Facebook Pages and Instagram Business accounts via the Meta Graph API.

**Architecture:** New `huginn_board_runes` table + a hard-coded registry of rune definitions in `src/runes/index.ts`. Each rune declares surface components (boardButton, boardSettings, boardView, cardBackSection, cardBadges, cardDetailBadges) that host components mount via a `RuneSurfaceHost`. The Meta rune adds `huginn_social_accounts` and `huginn_social_posts` tables, a Meta OAuth flow (edge function + callback page), a composer UI on the card back, a dedicated calendar board view, and two edge functions (`meta-oauth-complete`, `meta-publish`) triggered by `pg_cron`.

**Tech Stack:** React 19 + Vite 6 + TypeScript, Supabase (Postgres + Auth + Realtime + Edge Functions + pg_cron + pg_net + pgcrypto), Tailwind CSS 4, react-i18next, existing `@dnd-kit` infrastructure.

**Spec:** `docs/superpowers/specs/2026-04-24-runes-meta-social-design.md`

**Verification gate:** `npm run build` (tsc -b && vite build). No tests exist in the repo; this plan does not introduce them. Each task ends with build-pass + commit. Manual smoke tests are called out where UI wiring matters.

**Supabase project:** `czdjxtsjgughimlazdmu` (shared — prefix everything `huginn_`). Use `mcp__claude_ai_Supabase__apply_migration` for SQL and `mcp__claude_ai_Supabase__deploy_edge_function` for edge functions.

---

## Phase 1 — Runes framework skeleton

### Task 1: Migration + core types

**Files:**
- Create migration: `add_huginn_board_runes` (via MCP)
- Modify: `src/shared/lib/types.ts`
- Create: `src/runes/types.ts`

- [ ] **Step 1: Apply migration**

Use `mcp__claude_ai_Supabase__apply_migration` with:
- `project_id`: `czdjxtsjgughimlazdmu`
- `name`: `add_huginn_board_runes`
- `query`:

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

alter table huginn_board_runes enable row level security;

create policy huginn_board_runes_select
  on huginn_board_runes for select
  using (huginn_is_board_member(project_id, auth.uid()));

create policy huginn_board_runes_insert
  on huginn_board_runes for insert
  with check (huginn_can_manage_board(project_id, auth.uid()));

create policy huginn_board_runes_update
  on huginn_board_runes for update
  using (huginn_can_manage_board(project_id, auth.uid()))
  with check (huginn_can_manage_board(project_id, auth.uid()));

create policy huginn_board_runes_delete
  on huginn_board_runes for delete
  using (huginn_can_manage_board(project_id, auth.uid()));

create trigger huginn_board_runes_touch_updated_at_trg
  before update on huginn_board_runes
  for each row execute function huginn_touch_updated_at();

alter publication supabase_realtime add table huginn_board_runes;
```

(If `huginn_touch_updated_at()` does not yet exist as a generic function — check with `list_tables` / a quick query. If missing, create it first as: `create or replace function huginn_touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;` and grant execute appropriately. If a table-specific `huginn_tasks_touch_updated_at` already exists, copy its body.)

- [ ] **Step 2: Add BoardRune type**

Edit `src/shared/lib/types.ts`. Append:

```ts
export interface BoardRune {
  project_id: string
  rune_id: string
  enabled: boolean
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}
```

- [ ] **Step 3: Create rune types module**

Create `src/runes/types.ts`:

```ts
import type { ComponentType, ReactNode } from 'react'
import type { Task } from '../shared/lib/types'

export interface RuneSurfaces {
  boardButton?: ComponentType<{ projectId: string }>
  boardSettings?: ComponentType<{ projectId: string }>
  boardView?: ComponentType<{ projectId: string }>
  cardBackSection?: ComponentType<{ task: Task }>
  cardBadges?: ComponentType<{ task: Task }>
  cardDetailBadges?: ComponentType<{ task: Task }>
}

export interface RuneDefinition {
  id: string
  nameKey: string     // i18n key, e.g. 'runes.meta-social.name'
  taglineKey: string  // i18n key
  icon: ReactNode
  surfaces: RuneSurfaces
  onEnable?: (projectId: string) => Promise<void>
  onDisable?: (projectId: string) => Promise<void>
}
```

- [ ] **Step 4: Verify + commit**

```bash
npm run build
git add src/shared/lib/types.ts src/runes/types.ts
git commit -m "feat(runes): add huginn_board_runes table and core rune types"
```

---

### Task 2: Empty registry + useEnabledRunes hook

**Files:**
- Create: `src/runes/index.ts`
- Create: `src/runes/useEnabledRunes.ts`

- [ ] **Step 1: Create empty registry**

`src/runes/index.ts`:

```ts
import type { RuneDefinition } from './types'

export const RUNES: RuneDefinition[] = []

export function getRune(id: string): RuneDefinition | undefined {
  return RUNES.find(r => r.id === id)
}

export type { RuneDefinition, RuneSurfaces } from './types'
```

- [ ] **Step 2: Create useEnabledRunes hook**

`src/runes/useEnabledRunes.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../shared/lib/supabase'
import { RUNES } from './index'
import type { RuneDefinition } from './types'
import type { BoardRune } from '../shared/lib/types'

export function useEnabledRunes(projectId: string | undefined) {
  const [rows, setRows] = useState<BoardRune[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRunes = useCallback(async () => {
    if (!projectId) { setRows([]); setLoading(false); return }
    const { data, error } = await supabase
      .from('huginn_board_runes')
      .select('*')
      .eq('project_id', projectId)
    if (error) { console.error('Failed to fetch board runes:', error); return }
    setRows((data ?? []) as BoardRune[])
    setLoading(false)
  }, [projectId])

  useEffect(() => { fetchRunes() }, [fetchRunes])

  useEffect(() => {
    if (!projectId) return
    const channel = supabase
      .channel(`huginn_board_runes_${projectId}_${crypto.randomUUID()}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'huginn_board_runes',
        filter: `project_id=eq.${projectId}`,
      }, () => fetchRunes())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [projectId, fetchRunes])

  const enabled: RuneDefinition[] = rows
    .filter(r => r.enabled)
    .map(r => RUNES.find(def => def.id === r.rune_id))
    .filter((d): d is RuneDefinition => !!d)

  const settingsById = new Map(rows.map(r => [r.rune_id, r.settings]))

  const toggle = useCallback(async (runeId: string, next: boolean) => {
    if (!projectId) return
    const def = RUNES.find(r => r.id === runeId)
    const { error } = await supabase
      .from('huginn_board_runes')
      .upsert({ project_id: projectId, rune_id: runeId, enabled: next }, { onConflict: 'project_id,rune_id' })
    if (error) { console.error('Failed to toggle rune:', error); return }
    if (next && def?.onEnable) await def.onEnable(projectId)
    if (!next && def?.onDisable) await def.onDisable(projectId)
  }, [projectId])

  return { enabled, rows, settingsById, loading, toggle }
}
```

- [ ] **Step 3: Verify + commit**

```bash
npm run build
git add src/runes/index.ts src/runes/useEnabledRunes.ts
git commit -m "feat(runes): add empty rune registry + useEnabledRunes hook"
```

---

### Task 3: Board settings "Runes" section

**Files:**
- Modify: `src/features/projects/components/ProjectSettingsDrawer.tsx`
- Create: `src/runes/RunesSettingsSection.tsx`
- Modify: `src/shared/i18n/locales/en.json`

- [ ] **Step 1: Create the settings section**

`src/runes/RunesSettingsSection.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { RUNES } from './index'
import { useEnabledRunes } from './useEnabledRunes'
import { useBoardRole } from '../features/projects/hooks/useBoardRole'

interface Props {
  projectId: string
}

export function RunesSettingsSection({ projectId }: Props) {
  const { t } = useTranslation()
  const { rows, toggle, loading } = useEnabledRunes(projectId)
  const { canManage } = useBoardRole(projectId)

  if (RUNES.length === 0) return null

  return (
    <section className="pt-6 border-t border-huginn-border">
      <h3 className="text-sm font-semibold text-huginn-text-primary mb-1">
        {t('runes.sectionTitle')}
      </h3>
      <p className="text-xs text-huginn-text-secondary mb-4">
        {t('runes.sectionHint')}
      </p>

      <div className="space-y-3">
        {RUNES.map(def => {
          const row = rows.find(r => r.rune_id === def.id)
          const isOn = !!row?.enabled
          const ActiveSubPanel = isOn ? def.surfaces.boardSettings : undefined
          return (
            <div key={def.id} className="rounded-lg bg-huginn-card border border-huginn-border overflow-hidden">
              <label className="flex items-center gap-3 p-3 cursor-pointer">
                <div className="w-8 h-8 rounded-md bg-huginn-accent-soft flex items-center justify-center text-huginn-accent shrink-0">
                  {def.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-huginn-text-primary font-medium">{t(def.nameKey)}</div>
                  <div className="text-xs text-huginn-text-secondary">{t(def.taglineKey)}</div>
                </div>
                <input
                  type="checkbox"
                  checked={isOn}
                  disabled={loading || !canManage}
                  onChange={e => toggle(def.id, e.target.checked)}
                  className="w-10 h-5 shrink-0 accent-huginn-accent"
                  title={!canManage ? t('runes.adminOnly') : undefined}
                />
              </label>
              {ActiveSubPanel && (
                <div className="px-3 pb-3 pt-1 border-t border-huginn-border/50">
                  <ActiveSubPanel projectId={projectId} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Mount it in ProjectSettingsDrawer**

Open `src/features/projects/components/ProjectSettingsDrawer.tsx`. Near the top add:

```ts
import { RunesSettingsSection } from '../../../runes/RunesSettingsSection'
```

Inside the drawer's JSX, below the existing settings content (e.g. after the members/background/color/danger-zone sections — place it just above the danger zone if one exists, else at the bottom):

```tsx
<RunesSettingsSection projectId={projectId} />
```

Confirm `projectId` is in scope; if the drawer receives `project` instead, use `project.id`.

- [ ] **Step 3: Add i18n keys**

Edit `src/shared/i18n/locales/en.json`. Insert alphabetically under the root; add a `runes` object:

```json
"runes": {
  "adminOnly": "Only admins can enable or disable runes.",
  "sectionHint": "Optional modules that add new powers to this board. Each board can enable its own set.",
  "sectionTitle": "Runes"
}
```

Do **not** regenerate `is.json` yet — translation script runs as a batch later.

- [ ] **Step 4: Verify + commit**

```bash
npm run build
git add src/runes/RunesSettingsSection.tsx src/features/projects/components/ProjectSettingsDrawer.tsx src/shared/i18n/locales/en.json
git commit -m "feat(runes): add Runes section to project settings drawer"
```

**Manual smoke test:** open dev server, open any board's settings drawer — the Runes section should not render yet (empty registry). No errors in console.

---

## Phase 2 — Meta Social data model

### Task 4: Social accounts + posts migrations

**Files:**
- Three migrations via MCP

- [ ] **Step 1: Add pgcrypto + crypto helpers**

Apply migration `add_huginn_token_crypto`:

```sql
create extension if not exists pgcrypto;

create or replace function huginn_encrypt_token(plain text, key_hex text)
  returns bytea language sql security definer as $$
  select pgp_sym_encrypt(plain, key_hex);
$$;

create or replace function huginn_decrypt_token(cipher bytea, key_hex text)
  returns text language sql security definer as $$
  select pgp_sym_decrypt(cipher, key_hex);
$$;

revoke all on function huginn_encrypt_token(text, text) from public, authenticated, anon;
revoke all on function huginn_decrypt_token(bytea, text) from public, authenticated, anon;
grant execute on function huginn_encrypt_token(text, text) to service_role;
grant execute on function huginn_decrypt_token(bytea, text) to service_role;
```

- [ ] **Step 2: Add huginn_social_accounts**

Apply migration `add_huginn_social_accounts`:

```sql
create table huginn_social_accounts (
  id                     uuid primary key default gen_random_uuid(),
  project_id             uuid not null references huginn_projects(id) on delete cascade,
  provider               text not null default 'meta',
  fb_page_id             text not null,
  fb_page_name           text not null,
  ig_business_id         text,
  ig_username            text,
  access_token_encrypted bytea not null,
  token_expires_at       timestamptz,
  connected_by           uuid references auth.users(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (project_id, fb_page_id)
);

alter table huginn_social_accounts enable row level security;

-- Members can read safe columns; access_token_encrypted blocked below.
create policy huginn_social_accounts_select
  on huginn_social_accounts for select
  using (huginn_is_board_member(project_id, auth.uid()));

create policy huginn_social_accounts_insert
  on huginn_social_accounts for insert
  with check (huginn_can_manage_board(project_id, auth.uid()));

create policy huginn_social_accounts_update
  on huginn_social_accounts for update
  using (huginn_can_manage_board(project_id, auth.uid()))
  with check (huginn_can_manage_board(project_id, auth.uid()));

create policy huginn_social_accounts_delete
  on huginn_social_accounts for delete
  using (huginn_can_manage_board(project_id, auth.uid()));

-- Column-level lockdown on the encrypted token.
revoke select (access_token_encrypted) on huginn_social_accounts from authenticated, anon;

create trigger huginn_social_accounts_touch_updated_at_trg
  before update on huginn_social_accounts
  for each row execute function huginn_touch_updated_at();

alter publication supabase_realtime add table huginn_social_accounts;
```

- [ ] **Step 3: Add huginn_social_posts**

Apply migration `add_huginn_social_posts`:

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

create index huginn_social_posts_due_idx
  on huginn_social_posts (scheduled_at)
  where status = 'scheduled';

alter table huginn_social_posts enable row level security;

create policy huginn_social_posts_select
  on huginn_social_posts for select
  using (huginn_can_access_task(task_id, auth.uid()));

create policy huginn_social_posts_insert
  on huginn_social_posts for insert
  with check (huginn_can_access_task(task_id, auth.uid()));

create policy huginn_social_posts_update
  on huginn_social_posts for update
  using (huginn_can_access_task(task_id, auth.uid()))
  with check (huginn_can_access_task(task_id, auth.uid()));

create policy huginn_social_posts_delete
  on huginn_social_posts for delete
  using (huginn_can_access_task(task_id, auth.uid()));

create trigger huginn_social_posts_touch_updated_at_trg
  before update on huginn_social_posts
  for each row execute function huginn_touch_updated_at();

alter publication supabase_realtime add table huginn_social_posts;
```

- [ ] **Step 4: Verify schema via MCP**

Use `mcp__claude_ai_Supabase__list_tables` with `project_id=czdjxtsjgughimlazdmu`, filter on `huginn_social_%` and confirm both exist with expected columns + RLS enabled.

- [ ] **Step 5: Commit (no code changes, but record the migration list)**

Create `docs/migrations-runes.md` briefly noting the three migrations applied (optional — most Huginn migrations aren't documented in-repo, skip if in keeping with project norm).

No code to commit yet; proceed to Task 5.

---

### Task 5: TypeScript types + hooks for accounts and posts

**Files:**
- Modify: `src/shared/lib/types.ts`
- Create: `src/runes/meta-social/hooks/useSocialAccount.ts`
- Create: `src/runes/meta-social/hooks/useSocialPost.ts`
- Create: `src/runes/meta-social/hooks/useScheduledPosts.ts`

- [ ] **Step 1: Extend types**

Append to `src/shared/lib/types.ts`:

```ts
export interface SocialAccount {
  id: string
  project_id: string
  provider: 'meta'
  fb_page_id: string
  fb_page_name: string
  ig_business_id: string | null
  ig_username: string | null
  token_expires_at: string | null
  connected_by: string | null
  created_at: string
  updated_at: string
  // access_token_encrypted intentionally omitted — blocked by column-level RLS
}

export type SocialPostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed'

export interface SocialPost {
  task_id: string
  platforms: { fb: boolean; ig: boolean }
  scheduled_at: string | null
  timezone: string
  caption_base: string
  caption_ig: string | null
  caption_fb: string | null
  first_comment_ig: string | null
  media_attachment_ids: string[]
  status: SocialPostStatus
  published_at: string | null
  fb_post_id: string | null
  ig_post_id: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}
```

- [ ] **Step 2: useSocialAccount hook**

`src/runes/meta-social/hooks/useSocialAccount.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import type { SocialAccount } from '../../../shared/lib/types'

export function useSocialAccount(projectId: string | undefined) {
  const [account, setAccount] = useState<SocialAccount | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchAccount = useCallback(async () => {
    if (!projectId) { setAccount(null); setLoading(false); return }
    const { data, error } = await supabase
      .from('huginn_social_accounts')
      .select('id, project_id, provider, fb_page_id, fb_page_name, ig_business_id, ig_username, token_expires_at, connected_by, created_at, updated_at')
      .eq('project_id', projectId)
      .eq('provider', 'meta')
      .maybeSingle()
    if (error) { console.error('Failed to fetch social account:', error); return }
    setAccount((data as SocialAccount) ?? null)
    setLoading(false)
  }, [projectId])

  useEffect(() => { fetchAccount() }, [fetchAccount])

  useEffect(() => {
    if (!projectId) return
    const channel = supabase
      .channel(`huginn_social_accounts_${projectId}_${crypto.randomUUID()}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'huginn_social_accounts',
        filter: `project_id=eq.${projectId}`,
      }, () => fetchAccount())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [projectId, fetchAccount])

  async function disconnect() {
    if (!account) return
    const { error } = await supabase.rpc('huginn_disconnect_social_account', { account_id: account.id })
    if (error) console.error('Failed to disconnect:', error)
  }

  return { account, loading, disconnect }
}
```

The `huginn_disconnect_social_account` RPC is created in Task 15. For now it doesn't exist — the hook compiles because `rpc` accepts arbitrary strings at the type level; calling `disconnect()` before Task 15 will just error at runtime.

- [ ] **Step 3: useSocialPost hook**

`src/runes/meta-social/hooks/useSocialPost.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import type { SocialPost, SocialPostStatus } from '../../../shared/lib/types'

export function useSocialPost(taskId: string | undefined) {
  const [post, setPost] = useState<SocialPost | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchPost = useCallback(async () => {
    if (!taskId) { setPost(null); setLoading(false); return }
    const { data, error } = await supabase
      .from('huginn_social_posts')
      .select('*')
      .eq('task_id', taskId)
      .maybeSingle()
    if (error) { console.error('Failed to fetch social post:', error); return }
    setPost((data as SocialPost) ?? null)
    setLoading(false)
  }, [taskId])

  useEffect(() => { fetchPost() }, [fetchPost])

  useEffect(() => {
    if (!taskId) return
    const channel = supabase
      .channel(`huginn_social_posts_${taskId}_${crypto.randomUUID()}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'huginn_social_posts',
        filter: `task_id=eq.${taskId}`,
      }, () => fetchPost())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [taskId, fetchPost])

  async function upsert(patch: Partial<SocialPost>) {
    if (!taskId) return
    const prev = post
    const next = { ...(post ?? makeEmpty(taskId)), ...patch }
    setPost(next)
    const { error } = await supabase
      .from('huginn_social_posts')
      .upsert({ ...next }, { onConflict: 'task_id' })
    if (error) { console.error('Failed to upsert social post:', error); setPost(prev); return false }
    return true
  }

  async function setStatus(status: SocialPostStatus, extra: Partial<SocialPost> = {}) {
    return upsert({ status, ...extra })
  }

  return { post, loading, upsert, setStatus }
}

function makeEmpty(taskId: string): SocialPost {
  return {
    task_id: taskId,
    platforms: { fb: false, ig: false },
    scheduled_at: null,
    timezone: 'UTC',
    caption_base: '',
    caption_ig: null,
    caption_fb: null,
    first_comment_ig: null,
    media_attachment_ids: [],
    status: 'draft',
    published_at: null,
    fb_post_id: null,
    ig_post_id: null,
    error_message: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}
```

- [ ] **Step 4: useScheduledPosts hook (for calendar)**

`src/runes/meta-social/hooks/useScheduledPosts.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import type { SocialPost, Task } from '../../../shared/lib/types'

export interface ScheduledPostRow {
  post: SocialPost
  task: Task
}

// Fetches social posts for a given project (via task.project_id), with their tasks joined.
export function useScheduledPosts(projectId: string | undefined) {
  const [rows, setRows] = useState<ScheduledPostRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRows = useCallback(async () => {
    if (!projectId) { setRows([]); setLoading(false); return }
    // Two-step: find task ids in project, then fetch social posts referencing them.
    const { data: tasks, error: taskErr } = await supabase
      .from('huginn_tasks')
      .select('*')
      .eq('project_id', projectId)
      .eq('archived', false)
    if (taskErr) { console.error(taskErr); return }
    const taskIds = (tasks ?? []).map(t => t.id)
    if (taskIds.length === 0) { setRows([]); setLoading(false); return }
    const { data: posts, error: postErr } = await supabase
      .from('huginn_social_posts')
      .select('*')
      .in('task_id', taskIds)
    if (postErr) { console.error(postErr); return }
    const taskMap = new Map((tasks as Task[]).map(t => [t.id, t]))
    const combined = (posts as SocialPost[])
      .map(p => ({ post: p, task: taskMap.get(p.task_id)! }))
      .filter(r => !!r.task)
    setRows(combined)
    setLoading(false)
  }, [projectId])

  useEffect(() => { fetchRows() }, [fetchRows])

  useEffect(() => {
    if (!projectId) return
    // Subscribe unfiltered to huginn_social_posts (can't filter by project_id on this table);
    // the re-fetch scopes correctly. Cheap because the set per board is small.
    const channel = supabase
      .channel(`huginn_social_posts_board_${projectId}_${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'huginn_social_posts' },
         () => fetchRows())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [projectId, fetchRows])

  return { rows, loading }
}
```

- [ ] **Step 5: Verify + commit**

```bash
npm run build
git add src/shared/lib/types.ts src/runes/meta-social/hooks/
git commit -m "feat(runes/meta-social): add social account + post types and hooks"
```

---

## Phase 3 — Meta rune scaffolding (surfaces wired, no backend publish yet)

### Task 6: Register the rune + board settings sub-panel (disconnected state)

**Files:**
- Create: `src/runes/meta-social/MetaIcon.tsx`
- Create: `src/runes/meta-social/MetaBoardSettings.tsx`
- Create: `src/runes/meta-social/index.ts`
- Modify: `src/runes/index.ts`
- Modify: `src/shared/i18n/locales/en.json`

- [ ] **Step 1: Icon**

`src/runes/meta-social/MetaIcon.tsx`:

```tsx
// A simple combined FB+IG mark. No brand logos; abstract calendar-to-broadcast glyph.
export function MetaIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="15" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <circle cx="16" cy="14" r="2" />
      <path d="M8 14h4" />
    </svg>
  )
}
```

- [ ] **Step 2: Board settings sub-panel (no OAuth yet — button is a placeholder)**

`src/runes/meta-social/MetaBoardSettings.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { useSocialAccount } from './hooks/useSocialAccount'

export function MetaBoardSettings({ projectId }: { projectId: string }) {
  const { t } = useTranslation()
  const { account, loading } = useSocialAccount(projectId)

  if (loading) return <div className="text-xs text-huginn-text-secondary py-2">{t('common.loading')}</div>

  if (!account) {
    return (
      <div className="flex items-center justify-between gap-3 py-2">
        <div className="text-xs text-huginn-text-secondary">{t('runes.meta-social.notConnected')}</div>
        <button
          type="button"
          disabled
          className="px-3 py-1.5 text-xs rounded-md bg-huginn-accent text-white opacity-60 cursor-not-allowed"
          title="OAuth flow wires up in Task 9"
        >
          {t('runes.meta-social.connect')}
        </button>
      </div>
    )
  }

  return (
    <div className="text-xs space-y-1 py-2">
      <div><span className="text-huginn-text-secondary">{t('runes.meta-social.page')}:</span> <span className="text-huginn-text-primary">{account.fb_page_name}</span></div>
      <div><span className="text-huginn-text-secondary">{t('runes.meta-social.instagram')}:</span> <span className="text-huginn-text-primary">{account.ig_username ?? t('runes.meta-social.igNotLinked')}</span></div>
    </div>
  )
}
```

- [ ] **Step 3: Rune definition**

Create `src/runes/meta-social/index.tsx` (**not** `.ts` — the JSX in `icon` requires `.tsx`):

```tsx
import type { RuneDefinition } from '../types'
import { MetaIcon } from './MetaIcon'
import { MetaBoardSettings } from './MetaBoardSettings'

export const metaSocialRune: RuneDefinition = {
  id: 'meta-social',
  nameKey: 'runes.meta-social.name',
  taglineKey: 'runes.meta-social.tagline',
  icon: <MetaIcon />,
  surfaces: {
    boardSettings: MetaBoardSettings,
  },
}
```

Vite/TS resolves `./meta-social` to the `.tsx` file automatically — no import change needed in `src/runes/index.ts`.

- [ ] **Step 4: Register in RUNES**

Edit `src/runes/index.ts`:

```ts
import type { RuneDefinition } from './types'
import { metaSocialRune } from './meta-social'

export const RUNES: RuneDefinition[] = [metaSocialRune]

export function getRune(id: string): RuneDefinition | undefined {
  return RUNES.find(r => r.id === id)
}

export type { RuneDefinition, RuneSurfaces } from './types'
```

- [ ] **Step 5: i18n keys**

Edit `src/shared/i18n/locales/en.json`. Extend the `runes` object:

```json
"runes": {
  "adminOnly": "Only admins can enable or disable runes.",
  "sectionHint": "Optional modules that add new powers to this board. Each board can enable its own set.",
  "sectionTitle": "Runes",
  "meta-social": {
    "name": "Meta Social Planner",
    "tagline": "Schedule and auto-publish posts to Facebook & Instagram.",
    "notConnected": "No Meta account connected.",
    "connect": "Connect Meta",
    "reconnect": "Reconnect",
    "disconnect": "Disconnect",
    "page": "Page",
    "instagram": "Instagram",
    "igNotLinked": "No Instagram Business account linked"
  }
}
```

- [ ] **Step 6: Verify + smoke test + commit**

```bash
npm run build
npm run dev   # open any board, toggle settings drawer
```

Expected: Runes section renders; Meta Social Planner toggle visible; toggling ON shows the "No Meta account connected" sub-panel with a disabled Connect button; toggling OFF hides the sub-panel. Realtime: reload → state persists. Board members without admin role see the toggle disabled.

```bash
git add src/runes/meta-social/ src/runes/index.ts src/shared/i18n/locales/en.json
git commit -m "feat(runes/meta-social): register rune + board settings sub-panel (pre-OAuth)"
```

---

### Task 7: Card-back Publish section mount (shell only)

**Files:**
- Create: `src/runes/meta-social/MetaPublishSection.tsx`
- Modify: `src/runes/meta-social/index.ts` (add to surfaces)
- Modify: `src/features/projects/components/CardPopup.tsx`
- Modify: `src/shared/i18n/locales/en.json`

- [ ] **Step 1: Shell component**

`src/runes/meta-social/MetaPublishSection.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import type { Task } from '../../shared/lib/types'
import { useSocialPost } from './hooks/useSocialPost'
import { useSocialAccount } from './hooks/useSocialAccount'

export function MetaPublishSection({ task }: { task: Task }) {
  const { t } = useTranslation()
  const { post, upsert } = useSocialPost(task.id)
  const { account } = useSocialAccount(task.project_id ?? undefined)

  if (!task.project_id) return null   // inbox cards cannot be posts

  if (!account) {
    return (
      <div className="rounded-lg border border-huginn-border bg-huginn-card p-3 text-xs text-huginn-text-secondary">
        {t('runes.meta-social.connectFirst')}
      </div>
    )
  }

  if (!post) {
    return (
      <div className="rounded-lg border border-huginn-border bg-huginn-card p-3 flex items-center justify-between">
        <div className="text-xs text-huginn-text-secondary">{t('runes.meta-social.notAPost')}</div>
        <button
          type="button"
          onClick={() => upsert({ status: 'draft' })}
          className="px-3 py-1.5 text-xs rounded-md bg-huginn-accent text-white hover:bg-huginn-accent-hover"
        >
          {t('runes.meta-social.turnIntoPost')}
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-huginn-border bg-huginn-card p-3 text-xs text-huginn-text-secondary">
      {t('runes.meta-social.composerComingInTask10')}  {/* full composer lands in Task 10 */}
      <div className="mt-1 text-huginn-text-primary">Status: {post.status}</div>
    </div>
  )
}
```

- [ ] **Step 2: Register the surface**

Edit `src/runes/meta-social/index.ts`:

```ts
import type { RuneDefinition } from '../types'
import { MetaIcon } from './MetaIcon'
import { MetaBoardSettings } from './MetaBoardSettings'
import { MetaPublishSection } from './MetaPublishSection'

export const metaSocialRune: RuneDefinition = {
  id: 'meta-social',
  nameKey: 'runes.meta-social.name',
  taglineKey: 'runes.meta-social.tagline',
  icon: <MetaIcon />,
  surfaces: {
    boardSettings: MetaBoardSettings,
    cardBackSection: MetaPublishSection,
  },
}
```

- [ ] **Step 3: Mount in CardPopup**

Open `src/features/projects/components/CardPopup.tsx`. At the top:

```ts
import { useEnabledRunes } from '../../../runes/useEnabledRunes'
```

Inside the component body, near the top (after existing hooks):

```ts
const { enabled: enabledRunes } = useEnabledRunes(task.project_id ?? undefined)
```

In the JSX, above the attachments section (search for `huginn_attachments` rendering or the `AttachmentsSection` component):

```tsx
{enabledRunes.map(rune => {
  const Section = rune.surfaces.cardBackSection
  return Section ? <Section key={rune.id} task={task} /> : null
})}
```

- [ ] **Step 4: Additional i18n keys**

Extend `en.json` `runes["meta-social"]`:

```json
"connectFirst": "Connect a Meta account in board settings to start planning posts.",
"notAPost": "This card isn't a post yet.",
"turnIntoPost": "Turn into post",
"composerComingInTask10": "Composer coming in next task."
```

- [ ] **Step 5: Verify + smoke test + commit**

```bash
npm run build
npm run dev
```

Expected on a board with Meta rune enabled + no account connected: card-back shows "Connect a Meta account…". With account connected (you can manually `INSERT` a fake row via MCP for testing, then delete it): shows "Turn into post" button; clicking creates a draft row and flips to "Status: draft".

```bash
git add src/runes/meta-social/ src/features/projects/components/CardPopup.tsx src/shared/i18n/locales/en.json
git commit -m "feat(runes/meta-social): mount publish section shell on card back"
```

---

## Phase 4 — Meta OAuth

### Task 8: meta-oauth-complete edge function

**Files:**
- Create: `supabase/functions/meta-oauth-complete/index.ts` (or deploy directly via MCP)
- Supabase edge function secrets set via MCP

- [ ] **Step 1: Configure edge function secrets**

In the Meta Developer Portal, create (or use existing) a Meta App for Huginn. Note the App ID and App Secret. Generate a 32-byte base64 encryption key:

```bash
# Generate a raw 32-byte key and emit it as hex (pgcrypto wants hex).
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Save that hex string — this is `HUGINN_TOKEN_ENCRYPTION_KEY_HEX`.

Set Supabase edge function secrets (use the Supabase CLI; MCP does not yet expose secret-setting):

```bash
supabase secrets set \
  META_APP_ID=... \
  META_APP_SECRET=... \
  META_OAUTH_REDIRECT_URI=https://huginn.pro/auth/meta-callback \
  HUGINN_TOKEN_ENCRYPTION_KEY_HEX=<the hex string from above>
```

For local `dev` testing, add the same redirect URI under "Valid OAuth Redirect URIs" in the Meta app's Facebook Login > Settings page, and include `http://localhost:5173/auth/meta-callback` as well.

- [ ] **Step 2: Edge function source**

Create `supabase/functions/meta-oauth-complete/index.ts`:

```ts
// Deno edge function. Exchanges an OAuth code for a long-lived Page token,
// discovers the IG Business ID, and upserts an encrypted row in huginn_social_accounts.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const META_APP_ID = Deno.env.get('META_APP_ID')!
const META_APP_SECRET = Deno.env.get('META_APP_SECRET')!
const META_OAUTH_REDIRECT_URI = Deno.env.get('META_OAUTH_REDIRECT_URI')!
const HUGINN_TOKEN_ENCRYPTION_KEY_HEX = Deno.env.get('HUGINN_TOKEN_ENCRYPTION_KEY_HEX')!
const GRAPH = 'https://graph.facebook.com/v21.0'

interface ReqBody {
  code: string
  project_id: string
  selected_fb_page_id?: string  // second-step call after user picks
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const authHeader = req.headers.get('Authorization') ?? ''
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr || !user) return new Response('Unauthorized', { status: 401 })

  const body = await req.json() as ReqBody
  const { code, project_id, selected_fb_page_id } = body
  if (!code || !project_id) return new Response('Missing params', { status: 400 })

  // Verify caller can manage this board.
  const { data: canManage } = await supabase.rpc('huginn_can_manage_board', {
    project_id, user_id: user.id,
  })
  if (!canManage) return new Response('Forbidden', { status: 403 })

  // 1. Exchange code for short-lived user token.
  const tokenUrl = new URL(`${GRAPH}/oauth/access_token`)
  tokenUrl.searchParams.set('client_id', META_APP_ID)
  tokenUrl.searchParams.set('client_secret', META_APP_SECRET)
  tokenUrl.searchParams.set('redirect_uri', META_OAUTH_REDIRECT_URI)
  tokenUrl.searchParams.set('code', code)
  const shortRes = await fetch(tokenUrl)
  if (!shortRes.ok) return jsonError('oauth_exchange_failed', await shortRes.text())
  const shortJson = await shortRes.json() as { access_token: string }

  // 2. Exchange for long-lived user token.
  const longUrl = new URL(`${GRAPH}/oauth/access_token`)
  longUrl.searchParams.set('grant_type', 'fb_exchange_token')
  longUrl.searchParams.set('client_id', META_APP_ID)
  longUrl.searchParams.set('client_secret', META_APP_SECRET)
  longUrl.searchParams.set('fb_exchange_token', shortJson.access_token)
  const longRes = await fetch(longUrl)
  const longJson = await longRes.json() as { access_token: string }

  // 3. List Pages.
  const pagesRes = await fetch(`${GRAPH}/me/accounts?access_token=${longJson.access_token}`)
  const pagesJson = await pagesRes.json() as {
    data: Array<{ id: string, name: string, access_token: string }>
  }
  if (!pagesJson.data?.length) return jsonError('no_pages', 'No manageable Facebook Pages found.')

  // If user hasn't yet picked a page, return the list for the UI picker.
  if (!selected_fb_page_id) {
    return json({ step: 'select_page', pages: pagesJson.data.map(p => ({ id: p.id, name: p.name })) })
  }

  const page = pagesJson.data.find(p => p.id === selected_fb_page_id)
  if (!page) return jsonError('page_not_found', 'Selected page not in the authorized list.')

  // 4. Discover IG Business Account (if linked).
  const igRes = await fetch(`${GRAPH}/${page.id}?fields=instagram_business_account{id,username}&access_token=${page.access_token}`)
  const igJson = await igRes.json() as { instagram_business_account?: { id: string, username: string } }

  // 5. Encrypt + upsert.
  const { data: enc, error: encErr } = await supabase.rpc('huginn_encrypt_token', {
    plain: page.access_token, key_hex: HUGINN_TOKEN_ENCRYPTION_KEY_HEX,
  })
  if (encErr) return jsonError('encrypt_failed', encErr.message)

  const { error: upsertErr } = await supabase
    .from('huginn_social_accounts')
    .upsert({
      project_id,
      provider: 'meta',
      fb_page_id: page.id,
      fb_page_name: page.name,
      ig_business_id: igJson.instagram_business_account?.id ?? null,
      ig_username: igJson.instagram_business_account?.username ?? null,
      access_token_encrypted: enc,
      token_expires_at: null,  // Page tokens from long-lived exchange do not expire
      connected_by: user.id,
    }, { onConflict: 'project_id,fb_page_id' })
  if (upsertErr) return jsonError('upsert_failed', upsertErr.message)

  return json({ step: 'done' })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  })
}
function jsonError(code: string, message: string) {
  return json({ error: code, message }, 400)
}
```

- [ ] **Step 3: Deploy edge function**

Use `mcp__claude_ai_Supabase__deploy_edge_function` with:
- `project_id`: `czdjxtsjgughimlazdmu`
- `name`: `meta-oauth-complete`
- `files`: the file content from above keyed as `index.ts`

Expected response: deployment success. Verify via `mcp__claude_ai_Supabase__get_edge_function`.

- [ ] **Step 4: Commit source**

```bash
mkdir -p supabase/functions/meta-oauth-complete
# paste the source into supabase/functions/meta-oauth-complete/index.ts
git add supabase/functions/meta-oauth-complete/
git commit -m "feat(runes/meta-social): meta-oauth-complete edge function"
```

---

### Task 9: /auth/meta-callback page + page picker + Connect wiring

**Files:**
- Create: `src/pages/MetaCallbackPage.tsx`
- Modify: `src/app/routes.tsx` (or wherever routes live)
- Modify: `src/runes/meta-social/MetaBoardSettings.tsx`
- Modify: `src/shared/i18n/locales/en.json`

- [ ] **Step 1: Connect button kicks off OAuth**

Edit `MetaBoardSettings.tsx`. Replace the placeholder Connect button with:

```tsx
import { useCallback } from 'react'
// ... existing imports

function buildMetaAuthUrl(projectId: string, csrfToken: string): string {
  const appId = import.meta.env.VITE_META_APP_ID as string
  const redirectUri = import.meta.env.VITE_META_OAUTH_REDIRECT_URI as string
  const state = btoa(JSON.stringify({ project_id: projectId, csrf: csrfToken }))
  const scopes = [
    'pages_show_list', 'pages_manage_posts', 'pages_read_engagement',
    'instagram_basic', 'instagram_content_publish', 'business_management',
  ].join(',')
  const u = new URL('https://www.facebook.com/v21.0/dialog/oauth')
  u.searchParams.set('client_id', appId)
  u.searchParams.set('redirect_uri', redirectUri)
  u.searchParams.set('state', state)
  u.searchParams.set('scope', scopes)
  return u.toString()
}

// inside the component:
const onConnect = useCallback(() => {
  const csrf = crypto.randomUUID()
  sessionStorage.setItem('huginn.meta.oauth.csrf', csrf)
  sessionStorage.setItem('huginn.meta.oauth.project_id', projectId)
  window.location.href = buildMetaAuthUrl(projectId, csrf)
}, [projectId])
```

Replace the disabled button JSX with an enabled one wired to `onConnect`, and add a "Disconnect" button when `account` is present that calls `disconnect()` (from the hook).

- [ ] **Step 2: Callback page**

`src/pages/MetaCallbackPage.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../shared/lib/supabase'

type Phase = 'verifying' | 'picking' | 'saving' | 'done' | 'error'

interface PageOpt { id: string, name: string }

export default function MetaCallbackPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [phase, setPhase] = useState<Phase>('verifying')
  const [pages, setPages] = useState<PageOpt[]>([])
  const [projectId, setProjectId] = useState<string>('')
  const [code, setCode] = useState<string>('')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    (async () => {
      const codeParam = params.get('code')
      const stateParam = params.get('state')
      const errorParam = params.get('error_description') || params.get('error')
      if (errorParam) { setError(errorParam); setPhase('error'); return }
      if (!codeParam || !stateParam) { setError('missing_params'); setPhase('error'); return }

      let parsed: { project_id: string, csrf: string }
      try { parsed = JSON.parse(atob(stateParam)) } catch { setError('bad_state'); setPhase('error'); return }
      const expectedCsrf = sessionStorage.getItem('huginn.meta.oauth.csrf')
      if (!expectedCsrf || expectedCsrf !== parsed.csrf) { setError('csrf_mismatch'); setPhase('error'); return }

      setCode(codeParam)
      setProjectId(parsed.project_id)

      const { data, error: fnErr } = await supabase.functions.invoke('meta-oauth-complete', {
        body: { code: codeParam, project_id: parsed.project_id },
      })
      if (fnErr || !data) { setError(fnErr?.message ?? 'invoke_failed'); setPhase('error'); return }
      if ((data as any).error) { setError((data as any).message); setPhase('error'); return }
      if ((data as any).step === 'select_page') {
        setPages((data as any).pages as PageOpt[])
        setPhase('picking')
      } else {
        sessionStorage.removeItem('huginn.meta.oauth.csrf')
        setPhase('done')
        setTimeout(() => navigate(`/projects/${parsed.project_id}`), 800)
      }
    })()
  }, [params, navigate])

  async function choosePage(pageId: string) {
    setPhase('saving')
    const { data, error: fnErr } = await supabase.functions.invoke('meta-oauth-complete', {
      body: { code, project_id: projectId, selected_fb_page_id: pageId },
    })
    if (fnErr || (data as any)?.error) {
      setError((data as any)?.message ?? fnErr?.message ?? 'save_failed')
      setPhase('error'); return
    }
    sessionStorage.removeItem('huginn.meta.oauth.csrf')
    setPhase('done')
    setTimeout(() => navigate(`/projects/${projectId}`), 800)
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-huginn-surface flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <div className="text-huginn-danger text-lg">{t('runes.meta-social.oauthError')}</div>
          <div className="text-xs text-huginn-text-secondary break-words">{error}</div>
          <button onClick={() => navigate('/projects')}
            className="px-3 py-1.5 rounded-md bg-huginn-accent text-white text-sm">
            {t('common.back')}
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'picking') {
    return (
      <div className="min-h-screen bg-huginn-surface flex items-center justify-center p-6">
        <div className="max-w-md w-full space-y-3">
          <div className="text-huginn-text-primary">{t('runes.meta-social.pickPage')}</div>
          <div className="space-y-2">
            {pages.map(p => (
              <button key={p.id} onClick={() => choosePage(p.id)}
                className="w-full text-left px-3 py-2 rounded-md bg-huginn-card border border-huginn-border hover:border-huginn-accent text-sm text-huginn-text-primary">
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-huginn-surface flex items-center justify-center p-6">
      <div className="text-huginn-text-secondary">{t('common.loading')}</div>
    </div>
  )
}
```

- [ ] **Step 3: Register route**

Edit `src/app/routes.tsx` (or the router file). Add:

```tsx
import MetaCallbackPage from '../pages/MetaCallbackPage'

// Inside the route table, alongside /auth/callback:
{ path: '/auth/meta-callback', element: <MetaCallbackPage /> }
```

- [ ] **Step 4: Env vars**

Append to `.env.example` (or create if absent):

```
VITE_META_APP_ID=
VITE_META_OAUTH_REDIRECT_URI=http://localhost:5173/auth/meta-callback
```

Add the actual values locally to `.env` (do not commit real values). Add them to Vercel production env as `VITE_META_APP_ID` and `VITE_META_OAUTH_REDIRECT_URI=https://huginn.pro/auth/meta-callback`.

- [ ] **Step 5: i18n keys**

Extend `runes["meta-social"]`:

```json
"oauthError": "Couldn't connect to Meta.",
"pickPage": "Which Facebook Page should Huginn manage?"
```

And ensure `common.back` and `common.loading` exist — they should already.

- [ ] **Step 6: Verify + smoke test + commit**

```bash
npm run build
npm run dev
```

Manual flow: open a board as admin → settings → enable Meta Social Planner rune → Connect Meta → Facebook login → authorize → land on page picker → pick a Page → redirected back to board → sub-panel shows Page name + IG username (or "No Instagram Business account linked").

```bash
git add src/pages/MetaCallbackPage.tsx src/app/routes.tsx src/runes/meta-social/MetaBoardSettings.tsx .env.example src/shared/i18n/locales/en.json
git commit -m "feat(runes/meta-social): OAuth callback page + Connect wiring"
```

---

## Phase 5 — Composer + media picker

### Task 10: Full composer UI

**Files:**
- Modify: `src/runes/meta-social/MetaPublishSection.tsx`
- Create: `src/runes/meta-social/MediaPicker.tsx`
- Create: `src/runes/meta-social/validation.ts`
- Modify: `src/shared/i18n/locales/en.json`

- [ ] **Step 1: Validation helpers**

`src/runes/meta-social/validation.ts`:

```ts
import type { Attachment } from '../../shared/lib/types'

export interface MediaIssue {
  attachmentId: string
  reason: string
}

const IG_IMAGE_MAX_BYTES = 8 * 1024 * 1024
const IG_VIDEO_MAX_BYTES = 100 * 1024 * 1024

export function validateForMeta(
  attachments: Attachment[],
  selectedIds: string[],
  platforms: { fb: boolean, ig: boolean },
): MediaIssue[] {
  const issues: MediaIssue[] = []
  const selected = selectedIds.map(id => attachments.find(a => a.id === id)).filter(Boolean) as Attachment[]
  if (selected.length === 0) return [{ attachmentId: '', reason: 'noMedia' }]

  const images = selected.filter(a => a.type === 'image')
  const videos = selected.filter(a => a.type === 'video')

  if (videos.length > 1) issues.push({ attachmentId: videos[1].id, reason: 'multiVideoNotSupported' })
  if (videos.length > 0 && images.length > 0) issues.push({ attachmentId: videos[0].id, reason: 'mixedMediaNotSupported' })

  if (platforms.ig) {
    for (const a of selected) {
      if (a.type === 'image' && a.file_size && a.file_size > IG_IMAGE_MAX_BYTES) {
        issues.push({ attachmentId: a.id, reason: 'igImageTooLarge' })
      }
      if (a.type === 'video' && a.file_size && a.file_size > IG_VIDEO_MAX_BYTES) {
        issues.push({ attachmentId: a.id, reason: 'igVideoTooLarge' })
      }
    }
    if (images.length > 10) issues.push({ attachmentId: images[10].id, reason: 'igCarouselMax10' })
    if (images.length === 1) { /* fine */ }
    else if (images.length >= 2 && images.length <= 10) { /* carousel */ }
  }
  return issues
}
```

(If `Attachment.type` or `file_size` doesn't exist on the existing type, inspect `src/shared/lib/types.ts` and adjust — fall back to `mime_type?.startsWith('image/')` / `.startsWith('video/')` heuristics if needed.)

- [ ] **Step 2: MediaPicker**

`src/runes/meta-social/MediaPicker.tsx`:

```tsx
import type { Attachment } from '../../shared/lib/types'

interface Props {
  attachments: Attachment[]
  selectedIds: string[]
  onChange: (next: string[]) => void
  invalidIds: Set<string>
}

export function MediaPicker({ attachments, selectedIds, onChange, invalidIds }: Props) {
  const mediaAttachments = attachments.filter(a =>
    a.type === 'image' || a.type === 'video' || a.mime_type?.startsWith('image/') || a.mime_type?.startsWith('video/'),
  )
  if (mediaAttachments.length === 0) {
    return <div className="text-xs text-huginn-text-secondary">Add an image or video attachment to this card first.</div>
  }
  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id])
  }
  return (
    <div className="grid grid-cols-3 gap-2">
      {mediaAttachments.map(a => {
        const isSelected = selectedIds.includes(a.id)
        const isInvalid = invalidIds.has(a.id)
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => toggle(a.id)}
            className={[
              'relative aspect-square rounded-md overflow-hidden border-2',
              isSelected ? 'border-huginn-accent' : 'border-huginn-border',
              isInvalid ? 'ring-2 ring-huginn-danger' : '',
            ].join(' ')}
          >
            {a.type === 'video' || a.mime_type?.startsWith('video/')
              ? <video src={a.url} className="w-full h-full object-cover" muted />
              : <img src={a.url} alt="" className="w-full h-full object-cover" />
            }
            {isSelected && (
              <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-huginn-accent text-white text-[10px] flex items-center justify-center">
                {selectedIds.indexOf(a.id) + 1}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Rewrite MetaPublishSection with the full composer**

Replace `MetaPublishSection.tsx` with:

```tsx
import { useMemo, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { Task } from '../../shared/lib/types'
import { useSocialPost } from './hooks/useSocialPost'
import { useSocialAccount } from './hooks/useSocialAccount'
import { useAttachments } from '../../features/projects/hooks/useAttachments'
import { MediaPicker } from './MediaPicker'
import { validateForMeta } from './validation'

export function MetaPublishSection({ task }: { task: Task }) {
  const { t } = useTranslation()
  const projectId = task.project_id ?? undefined
  const { post, upsert, setStatus } = useSocialPost(task.id)
  const { account } = useSocialAccount(projectId)
  const { attachments } = useAttachments(task.id)

  const [showOverrides, setShowOverrides] = useState(false)

  if (!projectId) return null
  if (!account) {
    return (
      <div className="rounded-lg border border-huginn-border bg-huginn-card p-3 text-xs text-huginn-text-secondary">
        {t('runes.meta-social.connectFirst')}
      </div>
    )
  }
  if (!post) {
    return (
      <div className="rounded-lg border border-huginn-border bg-huginn-card p-3 flex items-center justify-between">
        <div className="text-xs text-huginn-text-secondary">{t('runes.meta-social.notAPost')}</div>
        <button type="button"
          onClick={() => upsert({ status: 'draft' })}
          className="px-3 py-1.5 text-xs rounded-md bg-huginn-accent text-white hover:bg-huginn-accent-hover">
          {t('runes.meta-social.turnIntoPost')}
        </button>
      </div>
    )
  }

  const igDisabled = !account.ig_business_id
  const issues = validateForMeta(attachments, post.media_attachment_ids, post.platforms)
  const invalidIds = new Set(issues.map(i => i.attachmentId).filter(Boolean))
  const canSchedule =
    post.status === 'draft' &&
    issues.length === 0 &&
    (post.platforms.fb || post.platforms.ig) &&
    !!post.scheduled_at &&
    new Date(post.scheduled_at).getTime() > Date.now()

  return (
    <div className="rounded-lg border border-huginn-border bg-huginn-card p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-huginn-text-primary">{t('runes.meta-social.composerTitle')}</div>
        <StatusPill status={post.status} scheduledAt={post.scheduled_at} publishedAt={post.published_at} />
      </div>

      {/* Platforms */}
      <div className="flex items-center gap-4 text-xs">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={post.platforms.fb}
            onChange={e => upsert({ platforms: { ...post.platforms, fb: e.target.checked } })} />
          Facebook
        </label>
        <label className={`flex items-center gap-1.5 ${igDisabled ? 'opacity-50' : ''}`}
               title={igDisabled ? t('runes.meta-social.igNotLinked') : undefined}>
          <input type="checkbox" disabled={igDisabled}
            checked={post.platforms.ig}
            onChange={e => upsert({ platforms: { ...post.platforms, ig: e.target.checked } })} />
          Instagram
        </label>
      </div>

      {/* Scheduled at */}
      <label className="block text-xs">
        <span className="text-huginn-text-secondary">{t('runes.meta-social.scheduledAt')}</span>
        <input type="datetime-local"
          className="mt-1 w-full rounded-md bg-huginn-base border border-huginn-border px-2 py-1 text-huginn-text-primary"
          value={toLocalInput(post.scheduled_at)}
          onChange={e => upsert({ scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
        />
      </label>

      {/* Base caption */}
      <label className="block text-xs">
        <span className="text-huginn-text-secondary">{t('runes.meta-social.caption')}</span>
        <textarea rows={4}
          className="mt-1 w-full rounded-md bg-huginn-base border border-huginn-border px-2 py-1 text-huginn-text-primary text-sm"
          value={post.caption_base}
          onChange={e => upsert({ caption_base: e.target.value })}
        />
      </label>

      {/* Per-platform overrides */}
      <button type="button" onClick={() => setShowOverrides(v => !v)}
        className="text-xs text-huginn-accent hover:underline">
        {showOverrides ? t('runes.meta-social.hideOverrides') : t('runes.meta-social.showOverrides')}
      </button>
      {showOverrides && (
        <div className="space-y-2">
          <textarea rows={3} placeholder={t('runes.meta-social.fbOverridePh')}
            className="w-full rounded-md bg-huginn-base border border-huginn-border px-2 py-1 text-xs text-huginn-text-primary"
            value={post.caption_fb ?? ''}
            onChange={e => upsert({ caption_fb: e.target.value || null })} />
          <textarea rows={3} placeholder={t('runes.meta-social.igOverridePh')}
            className="w-full rounded-md bg-huginn-base border border-huginn-border px-2 py-1 text-xs text-huginn-text-primary"
            value={post.caption_ig ?? ''}
            onChange={e => upsert({ caption_ig: e.target.value || null })} />
          <input type="text" placeholder={t('runes.meta-social.firstCommentPh')}
            className="w-full rounded-md bg-huginn-base border border-huginn-border px-2 py-1 text-xs text-huginn-text-primary"
            value={post.first_comment_ig ?? ''}
            onChange={e => upsert({ first_comment_ig: e.target.value || null })} />
        </div>
      )}

      {/* Media */}
      <div>
        <div className="text-xs text-huginn-text-secondary mb-1">{t('runes.meta-social.media')}</div>
        <MediaPicker attachments={attachments}
          selectedIds={post.media_attachment_ids}
          invalidIds={invalidIds}
          onChange={ids => upsert({ media_attachment_ids: ids })} />
      </div>

      {/* Issues */}
      {issues.length > 0 && (
        <ul className="text-xs text-huginn-danger space-y-0.5">
          {issues.map((i, idx) => <li key={idx}>• {t(`runes.meta-social.validation.${i.reason}`)}</li>)}
        </ul>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {post.status === 'draft' && (
          <button type="button" disabled={!canSchedule}
            onClick={() => setStatus('scheduled')}
            className="px-3 py-1.5 text-xs rounded-md bg-huginn-accent text-white hover:bg-huginn-accent-hover disabled:opacity-50">
            {t('runes.meta-social.schedule')}
          </button>
        )}
        {post.status === 'scheduled' && (
          <>
            <button type="button"
              onClick={() => setStatus('draft')}
              className="px-3 py-1.5 text-xs rounded-md bg-huginn-hover text-huginn-text-primary">
              {t('runes.meta-social.unschedule')}
            </button>
            <button type="button"
              onClick={() => setStatus('scheduled', { scheduled_at: new Date().toISOString() })}
              className="px-3 py-1.5 text-xs rounded-md bg-huginn-accent text-white">
              {t('runes.meta-social.publishNow')}
            </button>
          </>
        )}
        {post.status === 'published' && (
          <div className="text-xs text-huginn-text-secondary flex gap-2">
            {post.fb_post_id && <a className="text-huginn-accent" target="_blank" rel="noreferrer"
              href={`https://facebook.com/${post.fb_post_id}`}>Open on FB ↗</a>}
            {post.ig_post_id && <a className="text-huginn-accent" target="_blank" rel="noreferrer"
              href={`https://www.instagram.com/p/${post.ig_post_id}`}>Open on IG ↗</a>}
          </div>
        )}
        {post.status === 'failed' && (
          <>
            <div className="text-xs text-huginn-danger flex-1 truncate" title={post.error_message ?? ''}>
              {post.error_message ?? t('runes.meta-social.failed')}
            </div>
            <button type="button"
              onClick={() => setStatus('scheduled', { scheduled_at: new Date().toISOString(), error_message: null })}
              className="px-3 py-1.5 text-xs rounded-md bg-huginn-hover text-huginn-text-primary">
              {t('runes.meta-social.retry')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function StatusPill({ status, scheduledAt, publishedAt }: { status: string, scheduledAt: string | null, publishedAt: string | null }) {
  const bg =
    status === 'published' ? 'bg-huginn-success/20 text-huginn-success' :
    status === 'failed' ? 'bg-huginn-danger/20 text-huginn-danger' :
    status === 'publishing' ? 'bg-huginn-warning/20 text-huginn-warning' :
    status === 'scheduled' ? 'bg-huginn-accent-soft text-huginn-accent' :
    'bg-huginn-hover text-huginn-text-secondary'
  const label =
    status === 'scheduled' && scheduledAt ? new Date(scheduledAt).toLocaleString() :
    status === 'published' && publishedAt ? `Posted ${new Date(publishedAt).toLocaleString()}` :
    status
  return <span className={`text-[10px] px-2 py-0.5 rounded-full ${bg}`}>{label}</span>
}

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
```

- [ ] **Step 4: Add validation i18n + composer strings**

Extend `runes["meta-social"]`:

```json
"composerTitle": "Publish",
"scheduledAt": "Scheduled time",
"caption": "Caption",
"showOverrides": "Show per-platform overrides",
"hideOverrides": "Hide overrides",
"fbOverridePh": "Facebook caption (optional)",
"igOverridePh": "Instagram caption (optional)",
"firstCommentPh": "Instagram first comment (optional)",
"media": "Media",
"schedule": "Schedule",
"unschedule": "Unschedule",
"publishNow": "Publish now",
"retry": "Retry",
"failed": "Publish failed",
"validation": {
  "noMedia": "Attach at least one image or video to this card and select it.",
  "multiVideoNotSupported": "Only one video per post is supported in v1.",
  "mixedMediaNotSupported": "Posts can be all images (up to 10) OR one video — not a mix.",
  "igImageTooLarge": "Instagram images must be under 8 MB.",
  "igVideoTooLarge": "Instagram videos must be under 100 MB.",
  "igCarouselMax10": "Instagram carousels are limited to 10 images."
}
```

- [ ] **Step 5: Verify + smoke test + commit**

```bash
npm run build
npm run dev
```

Flow: open card on a board with the rune enabled + account connected → see composer → pick FB + IG → pick datetime → type caption → tick a media attachment → Schedule button enables. Click Schedule → status flips to Scheduled. Toggle an override → per-platform captions persist.

```bash
git add src/runes/meta-social/MetaPublishSection.tsx src/runes/meta-social/MediaPicker.tsx src/runes/meta-social/validation.ts src/shared/i18n/locales/en.json
git commit -m "feat(runes/meta-social): full card-back composer with media picker + validation"
```

---

## Phase 6 — Calendar view + card badges

### Task 11: Social calendar boardView + boardButton

**Files:**
- Create: `src/runes/meta-social/MetaCalendarView.tsx`
- Create: `src/runes/meta-social/MetaBoardButton.tsx`
- Modify: `src/runes/meta-social/index.ts`
- Modify: `src/features/projects/pages/ProjectDetailPage.tsx` (or wherever `ToolBar`/main board area is rendered)

- [ ] **Step 1: Board button**

`src/runes/meta-social/MetaBoardButton.tsx`:

```tsx
import { useTranslation } from 'react-i18next'

interface Props {
  projectId: string
  active: boolean
  onClick: () => void
}

export function MetaBoardButton({ active, onClick }: Props) {
  const { t } = useTranslation()
  return (
    <button type="button" onClick={onClick}
      className={[
        'px-2.5 py-1.5 text-xs rounded-md flex items-center gap-1.5',
        active ? 'bg-huginn-accent text-white' : 'bg-huginn-card text-huginn-text-primary hover:bg-huginn-hover',
      ].join(' ')}>
      📅 {t('runes.meta-social.calendar')}
    </button>
  )
}
```

- [ ] **Step 2: Calendar view**

`src/runes/meta-social/MetaCalendarView.tsx` — a minimal month-grid that reuses week-of-month logic from the existing `CalendarView` where possible. Keep it simple: fetch scheduled posts, group by day, render a 7-column grid of day cells with media-thumb + platform-icon chips per post, open the card on click.

```tsx
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useScheduledPosts } from './hooks/useScheduledPosts'
import { useNavigate } from 'react-router-dom'

export function MetaCalendarView({ projectId }: { projectId: string }) {
  const { t } = useTranslation()
  const { rows, loading } = useScheduledPosts(projectId)
  const navigate = useNavigate()
  const [monthStart, setMonthStart] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const days = useMemo(() => buildMonthGrid(monthStart), [monthStart])
  const postsByDay = useMemo(() => {
    const m = new Map<string, typeof rows>()
    for (const r of rows) {
      if (!r.post.scheduled_at) continue
      const key = new Date(r.post.scheduled_at).toDateString()
      const arr = m.get(key) ?? []
      arr.push(r)
      m.set(key, arr)
    }
    return m
  }, [rows])

  if (loading) return <div className="p-6 text-huginn-text-secondary">{t('common.loading')}</div>

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <button className="px-2 py-1 text-sm rounded-md bg-huginn-card text-huginn-text-primary"
          onClick={() => setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1))}>‹</button>
        <div className="text-sm text-huginn-text-primary">
          {monthStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </div>
        <button className="px-2 py-1 text-sm rounded-md bg-huginn-card text-huginn-text-primary"
          onClick={() => setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1))}>›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs">
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
          <div key={d} className="text-huginn-text-secondary py-1 text-center">{d}</div>
        ))}
        {days.map(d => {
          const key = d.toDateString()
          const inMonth = d.getMonth() === monthStart.getMonth()
          const items = postsByDay.get(key) ?? []
          return (
            <div key={key} className={[
              'min-h-[84px] rounded-md p-1 flex flex-col gap-1',
              inMonth ? 'bg-huginn-card border border-huginn-border' : 'bg-huginn-base/40 border border-transparent',
            ].join(' ')}>
              <div className="text-[10px] text-huginn-text-secondary">{d.getDate()}</div>
              {items.slice(0, 3).map(r => (
                <button key={r.post.task_id}
                  onClick={() => navigate(`/projects/${projectId}?card=${r.task.id}`)}
                  className="text-left px-1 py-0.5 rounded bg-huginn-accent-soft text-huginn-accent text-[10px] truncate">
                  {r.post.platforms.fb && 'ⓕ '}{r.post.platforms.ig && 'ⓘ '}
                  {new Date(r.post.scheduled_at!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </button>
              ))}
              {items.length > 3 && <div className="text-[9px] text-huginn-text-secondary">+{items.length - 3}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function buildMonthGrid(firstOfMonth: Date): Date[] {
  const first = new Date(firstOfMonth)
  // Monday-first: shift so column 0 is Monday
  const shift = (first.getDay() + 6) % 7
  const gridStart = new Date(first); gridStart.setDate(first.getDate() - shift)
  const days: Date[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart); d.setDate(gridStart.getDate() + i)
    days.push(d)
  }
  return days
}
```

(If you want the existing `CalendarView` infrastructure, open it and copy — but the above is self-contained and matches the spec's intent.)

- [ ] **Step 3: Register surfaces**

Edit `src/runes/meta-social/index.tsx`. The button needs stateful props (`active`, `onClick`) that come from the host, so don't put it in the registry — wire it directly in `ProjectDetailPage` in Step 4. The registry exposes `boardView` only:

```tsx
import type { RuneDefinition } from '../types'
import { MetaIcon } from './MetaIcon'
import { MetaBoardSettings } from './MetaBoardSettings'
import { MetaPublishSection } from './MetaPublishSection'
import { MetaCalendarView } from './MetaCalendarView'

export const metaSocialRune: RuneDefinition = {
  id: 'meta-social',
  nameKey: 'runes.meta-social.name',
  taglineKey: 'runes.meta-social.tagline',
  icon: <MetaIcon />,
  surfaces: {
    boardSettings: MetaBoardSettings,
    cardBackSection: MetaPublishSection,
    boardView: MetaCalendarView,
  },
}
```

- [ ] **Step 4: Wire the button + view into ProjectDetailPage**

Open `src/features/projects/pages/ProjectDetailPage.tsx` (or whatever the detail page is actually called — check the `src/pages/` folder if it's there; CLAUDE.md says it's `ProjectDetailPage`). Add:

```tsx
import { useEnabledRunes } from '../../../runes/useEnabledRunes'
import { MetaBoardButton } from '../../../runes/meta-social/MetaBoardButton'

// inside the component:
const { enabled: enabledRunes } = useEnabledRunes(projectId)
const metaRune = enabledRunes.find(r => r.id === 'meta-social')
const [showRuneView, setShowRuneView] = useState<string | null>(null)
```

In the ToolBar JSX area, add a button when the Meta rune is enabled:

```tsx
{metaRune && (
  <MetaBoardButton
    projectId={projectId}
    active={showRuneView === 'meta-social'}
    onClick={() => setShowRuneView(cur => cur === 'meta-social' ? null : 'meta-social')}
  />
)}
```

Above where `<BoardView>` renders, add conditional:

```tsx
{showRuneView === 'meta-social' && metaRune?.surfaces.boardView
  ? <metaRune.surfaces.boardView projectId={projectId} />
  : <BoardView ... existing props ... />
}
```

- [ ] **Step 5: i18n**

Extend `runes["meta-social"]`:

```json
"calendar": "Social calendar"
```

- [ ] **Step 6: Verify + smoke test + commit**

```bash
npm run build
npm run dev
```

Flow: board with rune enabled → calendar button in toolbar → click → month grid renders, any scheduled posts show as chips. Click a chip → card opens. Click button again → back to normal board view.

```bash
git add src/runes/meta-social/ src/features/projects/pages/ProjectDetailPage.tsx src/shared/i18n/locales/en.json
git commit -m "feat(runes/meta-social): social calendar board view + toolbar toggle"
```

---

### Task 12: Card front + detail badges

**Files:**
- Create: `src/runes/meta-social/MetaCardBadges.tsx`
- Create: `src/runes/meta-social/MetaCardDetailBadges.tsx`
- Modify: `src/runes/meta-social/index.ts`
- Modify: `src/features/projects/components/TaskCard.tsx` (mount card-front badges)
- Modify: `src/features/projects/components/CardPopup.tsx` (mount card-detail badges)

- [ ] **Step 1: Card front badges**

`src/runes/meta-social/MetaCardBadges.tsx`:

```tsx
import type { Task } from '../../shared/lib/types'
import { useSocialPost } from './hooks/useSocialPost'

export function MetaCardBadges({ task }: { task: Task }) {
  const { post } = useSocialPost(task.id)
  if (!post) return null
  const color =
    post.status === 'published' ? 'bg-huginn-success/20 text-huginn-success' :
    post.status === 'failed' ? 'bg-huginn-danger/20 text-huginn-danger' :
    post.status === 'scheduled' ? 'bg-huginn-accent-soft text-huginn-accent' :
    'bg-huginn-hover text-huginn-text-secondary'
  const label =
    post.status === 'scheduled' && post.scheduled_at ? shortTime(post.scheduled_at) :
    post.status === 'published' ? 'Posted' :
    post.status === 'failed' ? 'Failed' :
    'Draft'
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${color} inline-flex items-center gap-1`}>
      {post.platforms.fb && <span aria-label="Facebook">ⓕ</span>}
      {post.platforms.ig && <span aria-label="Instagram">ⓘ</span>}
      <span>{label}</span>
    </span>
  )
}

function shortTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
         d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
```

- [ ] **Step 2: Card detail badges**

`src/runes/meta-social/MetaCardDetailBadges.tsx`:

```tsx
import type { Task } from '../../shared/lib/types'
import { useSocialPost } from './hooks/useSocialPost'

export function MetaCardDetailBadges({ task }: { task: Task }) {
  const { post } = useSocialPost(task.id)
  if (!post || post.status === 'draft') return null
  if (post.status === 'scheduled' && post.scheduled_at) {
    const platforms = [post.platforms.fb && 'FB', post.platforms.ig && 'IG'].filter(Boolean).join(' + ')
    return <div className="text-xs text-huginn-accent">📅 Scheduled {new Date(post.scheduled_at).toLocaleString()} · {platforms}</div>
  }
  if (post.status === 'published' && post.published_at) {
    return <div className="text-xs text-huginn-success">✅ Published {timeAgo(post.published_at)}</div>
  }
  if (post.status === 'failed') {
    return <div className="text-xs text-huginn-danger">⚠ Publish failed{post.error_message ? `: ${post.error_message}` : ''}</div>
  }
  if (post.status === 'publishing') {
    return <div className="text-xs text-huginn-warning">⏳ Publishing…</div>
  }
  return null
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}
```

- [ ] **Step 3: Register surfaces**

In `src/runes/meta-social/index.tsx`, add imports for the new components and extend `surfaces`:

```tsx
import { MetaCardBadges } from './MetaCardBadges'
import { MetaCardDetailBadges } from './MetaCardDetailBadges'

// ...

surfaces: {
  boardSettings: MetaBoardSettings,
  cardBackSection: MetaPublishSection,
  boardView: MetaCalendarView,
  cardBadges: MetaCardBadges,
  cardDetailBadges: MetaCardDetailBadges,
},
```

- [ ] **Step 4: Mount in TaskCard via BoardView**

To avoid subscribing per-card, fetch `enabledRunes` once in `BoardView` and pass it down.

Edit `src/features/projects/components/BoardView.tsx`. Near the top:

```tsx
import { useEnabledRunes } from '../../../runes/useEnabledRunes'
import type { RuneDefinition } from '../../../runes/types'
```

Inside the component (near the top, with existing hooks):

```tsx
const { enabled: enabledRunes } = useEnabledRunes(projectId)
```

Where `<TaskCard ... />` is rendered, add the prop: `<TaskCard ... enabledRunes={enabledRunes} />`.

Edit `src/features/projects/components/TaskCard.tsx`. Extend the props type:

```tsx
import type { RuneDefinition } from '../../../runes/types'

interface TaskCardProps {
  // ...existing props
  enabledRunes?: RuneDefinition[]
}
```

Inside the JSX, below the existing labels/badges area on the card front:

```tsx
{enabledRunes?.map(rune => {
  const Badge = rune.surfaces.cardBadges
  return Badge ? <Badge key={rune.id} task={task} /> : null
})}
```

If `BoardView` isn't where `<TaskCard>` is rendered (CLAUDE.md hints `ListColumn` does the rendering), thread `enabledRunes` through the intermediate component the same way.

- [ ] **Step 5: Mount in CardPopup**

In `CardPopup.tsx`, already has `useEnabledRunes`. Above the card back section (near the title/description area, at the top of the body), add:

```tsx
{enabledRunes.map(rune => {
  const Detail = rune.surfaces.cardDetailBadges
  return Detail ? <Detail key={rune.id} task={task} /> : null
})}
```

- [ ] **Step 6: Verify + smoke test + commit**

```bash
npm run build
npm run dev
```

Flow: scheduled post shows chip on the card in the board view (platform icons + time). Open card → top has "📅 Scheduled …". Publish goes through (later task) → chip flips to "Posted".

```bash
git add src/runes/meta-social/ src/features/projects/components/TaskCard.tsx src/features/projects/components/BoardView.tsx src/features/projects/components/CardPopup.tsx
git commit -m "feat(runes/meta-social): card front + detail badges for post status"
```

---

## Phase 7 — Publishing pipeline

### Task 13: meta-publish edge function

**Files:**
- Create: `supabase/functions/meta-publish/index.ts`

- [ ] **Step 1: Edge function source**

`supabase/functions/meta-publish/index.ts`:

```ts
// Deno edge function. Publishes a scheduled social post to Meta (FB Page + IG Business).
// Called by pg_cron with a shared-secret bearer. Uses service-role to read encrypted token + mark status.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const META_PUBLISH_SECRET = Deno.env.get('META_PUBLISH_SECRET')!
const HUGINN_TOKEN_ENCRYPTION_KEY_HEX = Deno.env.get('HUGINN_TOKEN_ENCRYPTION_KEY_HEX')!
const GRAPH = 'https://graph.facebook.com/v21.0'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const auth = req.headers.get('Authorization') ?? ''
  if (auth !== `Bearer ${META_PUBLISH_SECRET}`) return new Response('Unauthorized', { status: 401 })

  const { post_id } = await req.json() as { post_id: string }
  if (!post_id) return new Response('Missing post_id', { status: 400 })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    // Load post + task + account + media URLs.
    const { data: post, error: postErr } = await supabase
      .from('huginn_social_posts').select('*').eq('task_id', post_id).single()
    if (postErr || !post) throw new Error(`post_not_found: ${postErr?.message}`)

    const { data: task, error: taskErr } = await supabase
      .from('huginn_tasks').select('project_id').eq('id', post.task_id).single()
    if (taskErr || !task?.project_id) throw new Error('task_not_found')

    const { data: account, error: accErr } = await supabase
      .from('huginn_social_accounts')
      .select('fb_page_id, ig_business_id, access_token_encrypted')
      .eq('project_id', task.project_id).eq('provider', 'meta').single()
    if (accErr || !account) throw new Error('account_not_found')

    const { data: token, error: decErr } = await supabase.rpc('huginn_decrypt_token', {
      cipher: account.access_token_encrypted, key_hex: HUGINN_TOKEN_ENCRYPTION_KEY_HEX,
    })
    if (decErr || !token) throw new Error(`decrypt_failed: ${decErr?.message}`)

    // Resolve media URLs (ordered).
    const { data: atts, error: attErr } = await supabase
      .from('huginn_attachments')
      .select('id, url, type, mime_type')
      .in('id', post.media_attachment_ids)
    if (attErr) throw new Error(`attachments_lookup: ${attErr.message}`)
    const attIndex = new Map(atts!.map(a => [a.id, a]))
    const ordered = post.media_attachment_ids
      .map((id: string) => attIndex.get(id))
      .filter((a: any) => !!a)
    if (ordered.length === 0) throw new Error('no_media')

    const fbCaption = post.caption_fb ?? post.caption_base
    const igCaption = post.caption_ig ?? post.caption_base

    let fb_post_id: string | null = null
    let ig_post_id: string | null = null

    // --- FB publish ---
    if (post.platforms.fb) {
      fb_post_id = await publishFb({
        pageId: account.fb_page_id, token, media: ordered, message: fbCaption,
      })
    }

    // --- IG publish ---
    if (post.platforms.ig && account.ig_business_id) {
      ig_post_id = await publishIg({
        igUser: account.ig_business_id, token, media: ordered, caption: igCaption,
        firstComment: post.first_comment_ig,
      })
    }

    await supabase.from('huginn_social_posts').update({
      status: 'published',
      published_at: new Date().toISOString(),
      fb_post_id, ig_post_id,
      error_message: null,
    }).eq('task_id', post_id)

    return json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await supabase.from('huginn_social_posts').update({
      status: 'failed', error_message: msg.slice(0, 500),
    }).eq('task_id', post_id)
    return json({ ok: false, error: msg }, 500)
  }
})

// ---- platform helpers ----

async function publishFb({ pageId, token, media, message }: {
  pageId: string, token: string, media: Array<{ url: string, type: string, mime_type?: string }>, message: string,
}): Promise<string> {
  const isVideo = media.length === 1 && (media[0].type === 'video' || media[0].mime_type?.startsWith('video/'))
  if (isVideo) {
    const form = new FormData()
    form.set('file_url', media[0].url); form.set('description', message); form.set('access_token', token)
    const res = await fetch(`${GRAPH}/${pageId}/videos`, { method: 'POST', body: form })
    const json = await res.json()
    if (!res.ok) throw new Error(`fb_video: ${JSON.stringify(json)}`)
    return json.id
  }
  if (media.length === 1) {
    const form = new FormData()
    form.set('url', media[0].url); form.set('message', message); form.set('access_token', token)
    const res = await fetch(`${GRAPH}/${pageId}/photos`, { method: 'POST', body: form })
    const json = await res.json()
    if (!res.ok) throw new Error(`fb_photo: ${JSON.stringify(json)}`)
    return json.post_id ?? json.id
  }
  // Multi-image: unpublished children + feed post with attached_media.
  const childIds: string[] = []
  for (const m of media) {
    const form = new FormData()
    form.set('url', m.url); form.set('published', 'false'); form.set('access_token', token)
    const r = await fetch(`${GRAPH}/${pageId}/photos`, { method: 'POST', body: form })
    const j = await r.json()
    if (!r.ok) throw new Error(`fb_child_photo: ${JSON.stringify(j)}`)
    childIds.push(j.id)
  }
  const feedForm = new FormData()
  feedForm.set('message', message)
  feedForm.set('access_token', token)
  feedForm.set('attached_media', JSON.stringify(childIds.map(id => ({ media_fbid: id }))))
  const r = await fetch(`${GRAPH}/${pageId}/feed`, { method: 'POST', body: feedForm })
  const j = await r.json()
  if (!r.ok) throw new Error(`fb_feed: ${JSON.stringify(j)}`)
  return j.id
}

async function publishIg({ igUser, token, media, caption, firstComment }: {
  igUser: string, token: string, media: Array<{ url: string, type: string, mime_type?: string }>,
  caption: string, firstComment: string | null,
}): Promise<string> {
  const isVideo = media.length === 1 && (media[0].type === 'video' || media[0].mime_type?.startsWith('video/'))
  let creationId: string

  if (isVideo) {
    creationId = await waitForContainer(await createIgContainer({
      igUser, token, body: { media_type: 'REELS', video_url: media[0].url, caption },
    }), token)
  } else if (media.length === 1) {
    creationId = await createIgContainer({
      igUser, token, body: { image_url: media[0].url, caption },
    })
  } else {
    // Carousel: create child containers (no caption), then parent with children ids.
    const children: string[] = []
    for (const m of media) {
      const id = await createIgContainer({ igUser, token, body: { image_url: m.url, is_carousel_item: true } })
      children.push(id)
    }
    creationId = await createIgContainer({
      igUser, token,
      body: { media_type: 'CAROUSEL', children: children.join(','), caption },
    })
  }

  // Publish the container.
  const pubForm = new FormData()
  pubForm.set('creation_id', creationId); pubForm.set('access_token', token)
  const pubRes = await fetch(`${GRAPH}/${igUser}/media_publish`, { method: 'POST', body: pubForm })
  const pubJson = await pubRes.json()
  if (!pubRes.ok) throw new Error(`ig_publish: ${JSON.stringify(pubJson)}`)
  const mediaId = pubJson.id as string

  if (firstComment) {
    const cf = new FormData()
    cf.set('message', firstComment); cf.set('access_token', token)
    await fetch(`${GRAPH}/${mediaId}/comments`, { method: 'POST', body: cf })
    // Swallow errors on first-comment — the post itself succeeded.
  }
  return mediaId
}

async function createIgContainer({ igUser, token, body }: {
  igUser: string, token: string, body: Record<string, string | boolean>,
}): Promise<string> {
  const form = new FormData()
  for (const [k, v] of Object.entries(body)) form.set(k, String(v))
  form.set('access_token', token)
  const res = await fetch(`${GRAPH}/${igUser}/media`, { method: 'POST', body: form })
  const json = await res.json()
  if (!res.ok) throw new Error(`ig_container: ${JSON.stringify(json)}`)
  return json.id
}

// Poll container status for video (Reels) until FINISHED or timeout.
async function waitForContainer(id: string, token: string): Promise<string> {
  const deadline = Date.now() + 5 * 60 * 1000  // 5 min
  while (Date.now() < deadline) {
    const res = await fetch(`${GRAPH}/${id}?fields=status_code&access_token=${token}`)
    const json = await res.json()
    if (json.status_code === 'FINISHED') return id
    if (json.status_code === 'ERROR') throw new Error(`ig_reels_transcode_error: ${JSON.stringify(json)}`)
    await new Promise(r => setTimeout(r, 5000))
  }
  throw new Error('ig_reels_transcode_timeout')
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  })
}
```

- [ ] **Step 2: Set edge function secret + deploy**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # META_PUBLISH_SECRET
supabase secrets set META_PUBLISH_SECRET=<value>
```

Use `mcp__claude_ai_Supabase__deploy_edge_function`:
- `project_id`: `czdjxtsjgughimlazdmu`
- `name`: `meta-publish`
- `files`: single file `index.ts` with the source above.

- [ ] **Step 3: Manual invocation test**

Create a draft post on a test board, set `status='scheduled'` and `scheduled_at = now()`, then manually invoke:

```bash
curl -X POST \
  -H "Authorization: Bearer <META_PUBLISH_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"post_id":"<task_id>"}' \
  https://<supabase-project>.functions.supabase.co/meta-publish
```

Expected: live post appears on the FB Page and/or IG account, `huginn_social_posts` row flips to `status='published'` with `fb_post_id`/`ig_post_id` populated.

On failure: `status='failed'` with human-readable `error_message`. Investigate and iterate.

- [ ] **Step 4: Commit source**

```bash
mkdir -p supabase/functions/meta-publish
# paste source
git add supabase/functions/meta-publish/
git commit -m "feat(runes/meta-social): meta-publish edge function (FB + IG + Reels + carousel)"
```

---

### Task 14: pg_cron scheduler

**Files:**
- Migration via MCP: `add_meta_publish_cron`

- [ ] **Step 1: Enable extensions**

Verify `pg_cron` and `pg_net` are enabled via `mcp__claude_ai_Supabase__list_extensions`. If not:

```sql
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;
```

- [ ] **Step 2: Configure cron**

Apply migration `add_meta_publish_cron`:

```sql
-- Store publish URL + secret as database settings (set via a single ALTER; fill in the real values)
alter database postgres set app.meta_publish_url = 'https://<project-ref>.functions.supabase.co/meta-publish';
alter database postgres set app.meta_publish_secret = '<same META_PUBLISH_SECRET>';

-- The worker function the cron calls.
create or replace function huginn_fire_due_social_posts()
returns void
language plpgsql
security definer
as $$
declare
  r record;
begin
  for r in
    update huginn_social_posts
       set status = 'publishing'
     where status = 'scheduled'
       and scheduled_at <= now()
    returning task_id
  loop
    perform net.http_post(
      url := current_setting('app.meta_publish_url'),
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.meta_publish_secret'),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('post_id', r.task_id)
    );
  end loop;
end;
$$;

revoke all on function huginn_fire_due_social_posts() from public, authenticated, anon;
grant execute on function huginn_fire_due_social_posts() to service_role;

-- Cron: every minute.
select cron.schedule(
  'huginn-meta-publish',
  '* * * * *',
  $$ select huginn_fire_due_social_posts(); $$
);
```

- [ ] **Step 3: Verify cron is scheduled**

Via MCP `execute_sql`:

```sql
select jobid, schedule, command, active from cron.job where jobname = 'huginn-meta-publish';
```

Expected one row, `active=true`, schedule `* * * * *`.

- [ ] **Step 4: End-to-end test**

Create a scheduled post (via composer) `scheduled_at = now() + 90 seconds`, wait, verify it publishes. Watch `huginn_social_posts.status` transitions: `scheduled` → `publishing` (within the cron minute) → `published` (after the edge function completes).

- [ ] **Step 5: Commit (migration-only, nothing in-repo)**

Skip commit — everything is in Supabase.

---

## Phase 8 — Disconnect + polish + i18n

### Task 15: Disconnect flow (fails scheduled posts safely)

**Files:**
- Migration via MCP: `add_disconnect_social_account_rpc`
- Modify: `src/runes/meta-social/MetaBoardSettings.tsx` (add Disconnect button)

- [ ] **Step 1: RPC**

Apply migration `add_disconnect_social_account_rpc`:

```sql
create or replace function huginn_disconnect_social_account(account_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_project_id uuid;
begin
  select project_id into v_project_id
  from huginn_social_accounts where id = account_id;

  if v_project_id is null then
    raise exception 'account_not_found';
  end if;

  if not huginn_can_manage_board(v_project_id, auth.uid()) then
    raise exception 'forbidden';
  end if;

  -- Fail any scheduled posts on this board's tasks so the cron can't fire them.
  update huginn_social_posts sp
     set status = 'failed', error_message = 'Meta account disconnected'
    from huginn_tasks t
   where sp.task_id = t.id
     and t.project_id = v_project_id
     and sp.status in ('scheduled', 'publishing');

  delete from huginn_social_accounts where id = account_id;
end;
$$;

revoke all on function huginn_disconnect_social_account(uuid) from public, anon;
grant execute on function huginn_disconnect_social_account(uuid) to authenticated;
```

- [ ] **Step 2: Wire Disconnect button**

In `MetaBoardSettings.tsx`, when `account` exists, render alongside "Reconnect":

```tsx
<button type="button"
  onClick={async () => {
    if (!confirm(t('runes.meta-social.disconnectConfirm'))) return
    await disconnect()
  }}
  className="px-2.5 py-1 text-xs rounded-md bg-huginn-danger/20 text-huginn-danger hover:bg-huginn-danger/30">
  {t('runes.meta-social.disconnect')}
</button>
```

Where `disconnect` comes from the `useSocialAccount(projectId)` hook.

Also add a "Reconnect" button that calls the same `onConnect` handler as Connect.

- [ ] **Step 3: i18n**

Extend:

```json
"disconnectConfirm": "Disconnect this Meta account? Any scheduled posts on this board will be marked as failed."
```

- [ ] **Step 4: Verify + smoke test + commit**

```bash
npm run build
npm run dev
```

Connect → create scheduled post → Disconnect → confirm scheduled post flipped to `failed` with "Meta account disconnected" as the error.

```bash
git add src/runes/meta-social/MetaBoardSettings.tsx src/shared/i18n/locales/en.json
git commit -m "feat(runes/meta-social): disconnect flow with safe failure of pending posts"
```

---

### Task 16: Translate + final build

**Files:**
- Modify: `src/shared/i18n/locales/is.json` (via `npm run translate`)

- [ ] **Step 1: Run translator**

```bash
npm run translate
```

Confirm only Meta/Runes keys were newly translated (diff `is.json`). If `OPEN_ROUTER_API` isn't set locally, skip — Icelandic translations can be batched in a follow-up.

- [ ] **Step 2: Full build + dev smoke run**

```bash
npm run build
npm run dev
```

Click through the full flow one more time on a real board:
1. Enable rune → connect Meta → pick Page → see connected status
2. Create a card, add an image, turn into post, set FB+IG, schedule 2 minutes out
3. See chip on card front, detail badge on card back, entry on social calendar
4. Wait for cron → post appears on FB Page and IG feed
5. Status flips to Published, links open the live posts
6. Disconnect → existing scheduled post on another card flips to failed

- [ ] **Step 3: Commit**

```bash
git add src/shared/i18n/locales/is.json
git commit -m "chore(i18n): translate runes + meta-social strings to Icelandic"
```

- [ ] **Step 4: Meta App Review submission (out-of-band)**

Submit `pages_manage_posts` + `instagram_content_publish` for review in the Meta Developer Portal. Record the submission date + decision in a session note. Until approved, only the developer-test-user pool can exercise the publish path.

---

## Plan self-review

After completing all tasks, verify:

1. `npm run build` passes cleanly (no TS errors, no missing imports).
2. All `huginn_board_runes`, `huginn_social_accounts`, `huginn_social_posts` tables exist with RLS enabled and are in `supabase_realtime` publication.
3. `mcp__claude_ai_Supabase__list_edge_functions` shows `meta-oauth-complete` and `meta-publish`.
4. `cron.job` contains `huginn-meta-publish` row, active.
5. Vercel production env has `VITE_META_APP_ID` and `VITE_META_OAUTH_REDIRECT_URI` set.
6. Supabase secrets contain `META_APP_ID`, `META_APP_SECRET`, `META_OAUTH_REDIRECT_URI`, `HUGINN_TOKEN_ENCRYPTION_KEY_HEX`, `META_PUBLISH_SECRET`.
7. `.env.example` lists the two Vite env vars so future collaborators know what's needed.
8. End-to-end post published on a real FB Page + IG feed from Huginn.

## Deferred to follow-up specs

- Analytics pull (likes, reach, comments) — new edge function + cron to hydrate.
- IG Stories + mixed image/video carousels.
- Retry queueing with exponential backoff (current retry = manual).
- Bulk CSV import.
- Recurring posts — reuse `huginn_tasks.recurring` field.
- AI caption assistance.
- Other platforms (X, TikTok, LinkedIn, YouTube, Threads, Pinterest).
- Third-party runes / dynamic rune loading.
