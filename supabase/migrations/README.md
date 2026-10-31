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
