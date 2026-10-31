# Migrations

SQL migrations for the `hg_` tables on Supabase project `czdjxtsjgughimlazdmu` (shared, touch only `hg_` objects).

- Applied with the Supabase MCP tool `apply_migration`. The migration name is the file name without `.sql` (for example `0001_hg_schema`).
- Never run `supabase db push`.
- Files are numbered and applied in order. Do not edit a file after it has been applied, add a new one.
- Any DROP or DELETE is done by hand by Heimir, never by a migration run from an agent.
- 0002_hg_rls_hardening was applied by Heimir in the SQL editor because the connector declined it (DROP statements), so it is not recorded in supabase_migrations.schema_migrations.
