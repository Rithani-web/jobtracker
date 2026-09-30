-- Adds soft-archiving to applications: archived_at is NULL for active rows,
-- or the timestamp when the row was archived (set / cleared by the
-- archiveApplication / unarchiveApplication server actions).
--
-- Any status may be archived. Archived rows:
--   - leave the default (Active) list view
--   - keep counting toward dashboard metrics
--   - keep their interviews / follow-ups / contacts untouched
--
-- No RLS change: same table, same "own rows" policy.
-- Apply via: node supabase/scripts/push-schema.mjs (all migrations are idempotent).

alter table public.applications
  add column if not exists archived_at timestamptz;

-- Newest-first browsing in the Archived view.
create index if not exists applications_archived_at_idx
  on public.applications (archived_at);
