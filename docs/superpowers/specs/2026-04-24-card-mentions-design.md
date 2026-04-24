# Card @-mentions

## Context

Heimir collaborates with partner Árni (and other invited members) on shared boards in Huginn. Today there's no way to draw a specific person's attention to a specific card — comments and descriptions are visible to everyone but addressed to no one. Heimir wants to type `@árni` in a comment or description and have Árni see a notification badge on that card the next time he opens the board, plus a global counter so he doesn't need to hunt across boards.

This is a "draw partner's attention" tool, not a full notification system. No emails, no push, no notification preferences. Just an in-app dot that clears when the recipient opens the card.

## Decisions

| Question | Choice |
|---|---|
| Where notifications surface | Per-card dot **and** global counter in top nav |
| Click target on global counter | Opens a dropdown listing each unread mention; clicking jumps to the card |
| Global counter location | New bell icon in `GlobalTopBar` (between command palette and language toggle) |
| Mention picker — description | Tiptap `@tiptap/extension-mention` |
| Mention picker — comments | Custom `@`-trigger dropdown over the existing textarea |
| Self-mentions | Don't notify the mentioner |
| Edit semantics | Description: diff on save; new mentions inserted, removed deleted, unchanged untouched. Comments: append-only — mentions tied to the comment row, deleted via cascade if comment is deleted. |
| Read trigger | Opening `CardPopup` / `TaskDetailDrawer` / `TaskDetailPanel` |

## Data model

Two new tables, both prefixed `huginn_` and both in the `supabase_realtime` publication.

### `huginn_mentions`

```sql
create table huginn_mentions (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references huginn_tasks(id) on delete cascade,
  comment_id    uuid references huginn_comments(id) on delete cascade,
  mentioned_user_id uuid not null references auth.users(id) on delete cascade,
  mentioner_id  uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now()
);
create index on huginn_mentions(mentioned_user_id, created_at desc);
create index on huginn_mentions(task_id);
```

`comment_id IS NULL` ⇒ mention is in the description. RLS policies route through `huginn_can_access_task(task_id, user_id)`.

### `huginn_card_views`

```sql
create table huginn_card_views (
  task_id   uuid not null references huginn_tasks(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (task_id, user_id)
);
```

RLS policies for both SELECT and INSERT/UPDATE: `user_id = auth.uid() AND huginn_can_access_task(task_id, auth.uid())`. No DELETE policy needed — rows are upserted, never deleted (cascades handle task removal).

### Unread count formula

```
unread mentions for me on task T =
  count(huginn_mentions
        where mentioned_user_id = auth.uid()
          and task_id = T
          and created_at > coalesce(
            (select viewed_at from huginn_card_views
             where task_id = T and user_id = auth.uid()),
            '-infinity'
          ))
```

For the global counter, drop the `and task_id = T` and join to project for the dropdown's display fields.

## Mention picker UX

### Description (Tiptap)

Register `@tiptap/extension-mention` on `RichTextEditor` with a suggestion source backed by `useBoardMembers(projectId)`. Mentions render as a styled inline chip — accent-colored background, member's display name, no avatar inline (keep dense). The mention node stores `{ id: userId, label: displayName }` in the document JSON.

On save (the existing 700ms debounce), diff the doc's mention nodes against the current `huginn_mentions` rows for this task where `comment_id IS NULL`. Insert new ones, delete removed ones. Self-mentions skip the insert.

### Comments (custom)

Existing `CommentSection` uses a textarea. Add an autocomplete dropdown:

- Typing `@` opens a small popover anchored under the cursor (use `getCaretCoordinates` or the textarea's selection rect).
- Filter `useBoardMembers(projectId)` by display name as the user types more chars.
- Arrow keys navigate, Enter inserts `@displayname `, Escape closes.
- Inserted tokens are tracked in a parallel `Set<userId>` kept in component state (the textarea text holds `@displayname` as plain text; the user-id mapping comes from the picker).
- On send, the comment is inserted as today, plus `huginn_mentions` rows for each non-self user_id in the parallel set.

Rendered comments highlight `@displayname` substrings in accent color (simple regex replace — no need to deep-link to profiles).

## Hooks

- `useUnreadMentionsByTask(projectId): Record<string, number>` — board-level. Subscribes to `huginn_mentions` and `huginn_card_views` filtered to the current user. Returns map for `TaskCard` dot rendering.
- `useGlobalMentions(): { count: number; rows: MentionRow[] }` — top-bar counter + dropdown. `MentionRow` includes the joined project name, task title, mentioner display name, created_at.
- `useMarkCardViewed(taskId)` — fires an upsert on mount. Used by `CardPopup`, `TaskDetailDrawer`, `TaskDetailPanel`.

## New dependency

`@tiptap/extension-mention` and `tippy.js` (peer dep — Tiptap mention's default suggestion popup uses Tippy). Add via `npm install`.

## UI surfaces touched

| File | Change |
|---|---|
| `src/features/projects/components/RichTextEditor.tsx` | Register Tiptap mention extension, wire member suggestion source |
| `src/features/projects/components/CardPopup.tsx` | Diff description mentions on save; call `useMarkCardViewed` |
| `src/features/projects/components/CommentSection.tsx` | Add @ picker + parallel user_id tracking; insert mention rows on send |
| `src/features/projects/components/TaskCard.tsx` | Render unread mention dot (purple accent, top-right) |
| `src/features/inbox/components/TaskDetailDrawer.tsx` + `TaskDetailPanel.tsx` | Call `useMarkCardViewed` |
| `src/shared/components/GlobalTopBar.tsx` | Add bell icon + dropdown |
| `src/features/projects/hooks/useMentions.ts` (new) | Both new hooks live here |

## Realtime

`huginn_mentions` and `huginn_card_views` both go in `supabase_realtime` publication. The two new hooks subscribe with channels named `huginn_mentions_${userId}_${randomUUID}` and `huginn_card_views_${userId}_${randomUUID}` to avoid collisions.

When another user sends a mention to me on a card, the dot appears in real time. When I open the card, the upsert echoes back through realtime and clears the dot in any other tabs I have open.

## Out of scope

- Email / push / desktop notifications.
- Notification preferences / muting per-card or per-board.
- Mentioning all members at once (`@everyone`, `@channel`).
- Mentioning a card from outside the board (e.g., from inbox capture).
- Activity feed integration — mentions don't get logged in `huginn_activity` (keeps the feed focused on structural changes; mentions are their own UX).

## Verification

1. Two browser sessions: Heimir on the Metta board, Árni on the Camping board.
2. Heimir opens a card on Metta, types `@Árni hello` in the description, blurs the editor.
3. Within ~1s Árni's top-bar bell shows a `1` and the dropdown lists "Metta · [card title] · Heimir mentioned you".
4. Árni clicks the dropdown row → navigates to the card on Metta board → CardPopup opens → bell drops to `0` → dot on the `TaskCard` (visible on the board behind the popup) disappears.
5. Heimir adds a comment with `@Árni still you` → the bell on Árni's session goes to `1` again.
6. Árni edits the description on a different card to remove an existing `@Heimir` → Heimir's count decrements (mention row deleted by the diff).
7. Self-test: Heimir mentions himself in a comment → no row inserted, no badge appears.
8. Mobile: open a card on `TaskDetailDrawer`, confirm `viewed_at` updates and the dot clears.
