# Migrations

SQL migrations for the `hg_` tables on Supabase project `czdjxtsjgughimlazdmu` (shared, touch only `hg_` objects).

- Applied with the Supabase MCP tool `apply_migration`. The migration name is the file name without `.sql` (for example `0001_hg_schema`).
- Never run `supabase db push`.
- Files are numbered and applied in order. Do not edit a file after it has been applied, add a new one.
- Any DROP or DELETE is done by hand by Heimir, never by a migration run from an agent.
- 0002_hg_rls_hardening was applied by Heimir in the SQL editor because the connector declined it (DROP statements), so it is not recorded in supabase_migrations.schema_migrations.

## Files

- 0001_hg_schema: the hg_ tables, RLS through hg_is_participant, helpers and the realtime publication.
- 0002_hg_rls_hardening: composite parent foreign keys, participant trust, own read marks, project policies and function grants.
- 0003_hg_triggers_storage: updated_at, closed_at, author stamps, the hg_events log, the ball move on answers and the hg-files bucket.
- 0004_hg_trigger_fixes: trigger corrections (no reopen on answer, unforgeable stamps, drag is not a change).
- 0005_hg_add_participant: security definer RPC that adds a participant by email.
- 0006_hg_reads_clock_and_guards: read_at stamped with the server clock, and short name checks plus a race safe duplicate message in hg_add_participant.
- 0007_hg_analyse: analysed_at and the analysis lock on hg_items, the lock and event RPCs for hg-analyse, and the pg_net enqueue triggers (URL and secret from Vault).
- 0008_hg_plan_moves_item: a plan entering building or done moves its item (building, ready, waiting on the oldest open action or question, or done).
- 0009_hg_plan_done_clears_next: a plan entering done also clears next_step and next_prompt of the item whenever it moves the item.
- 0010_hg_unread: created_by on hg_actions, hg_unread (the viewer's unread events per item and kind) and hg_mark_all_read.
- 0010b_hg_unread_open_only: hg_unread returns groups for open items only.
- 0011_hg_views: hg_views (name, filter json, position) and hg_view_positions (card positions per view), participant RLS, realtime.
- 0011b_hg_views_project_keys: composite (id, project_id) keys so a view position's view and item are in its own project.
- 0012_hg_action_edits: updated_at, updated_by, cancelled and cancel_reason on hg_actions, edit stamps, action.updated and action.cancelled events.
- 0013_hg_view_pack_positions: hg_view_pack_positions (pack column positions per view, composite project keys), participant RLS, realtime.
