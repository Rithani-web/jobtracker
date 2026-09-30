-- Notification center: a per-user list of "needs attention" reminders.
--
-- JobTracker has no cross-user events, so notifications are derived from the
-- user's own data and materialized by src/lib/notifications.ts (syncNotifications,
-- called from GET /api/notifications):
--
--   follow_up_overdue  — an undone follow-up past its due date
--   interview_upcoming — an interview scheduled within the next 24 hours
--
-- sync is idempotent: a unique (user_id, kind, entity_id) index backs the
-- upsert's ON CONFLICT, so re-syncing never duplicates rows. Rows whose
-- condition cleared (follow-up done, interview rescheduled/deleted) are
-- pruned by sync; read_at state survives for items still in scope.
--
-- entity_id points at follow_ups.id OR interviews.id (polymorphic — no FK).
-- Rows cascade away with their application via application_id.
--
-- RLS: same pattern as every table — "own rows" for auth.uid() = user_id.
-- Apply via: node supabase/scripts/push-schema.mjs (all migrations are idempotent).

create table if not exists public.notifications (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind           text not null
                 constraint notifications_kind_check
                 check (kind in ('follow_up_overdue', 'interview_upcoming')),
  entity_id      uuid not null,
  application_id uuid references public.applications (id) on delete cascade,
  title          text not null,
  body           text,
  read_at        timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists notifications_user_id_idx
  on public.notifications (user_id);
create index if not exists notifications_application_idx
  on public.notifications (application_id);

-- Conflict target for the sync upsert; also enforces one notification per
-- (user, kind, source entity).
create unique index if not exists notifications_user_kind_entity_uq
  on public.notifications (user_id, kind, entity_id);

alter table public.notifications enable row level security;

drop policy if exists "own rows" on public.notifications;
create policy "own rows" on public.notifications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
