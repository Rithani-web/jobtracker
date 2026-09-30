-- JobTracker initial schema for Supabase (Postgres).
--
-- Mirrors prisma/schema.prisma so the app can swap data layers 1:1:
--   applications / interviews / contacts / follow_ups
-- Choice fields are CHECK-constrained here (Postgres can enforce what
-- SQLite could only enforce in app code).
--
-- Every table carries user_id so RLS can scope rows to their owner:
--   - defaults to auth.uid(), so authenticated clients never send it
--   - FK to auth.users with ON DELETE CASCADE cleans up on account delete
--
-- Apply via: Supabase Dashboard → SQL Editor (paste + run),
--            or `node supabase/scripts/push-schema.mjs` (needs DB password),
--            or the Supabase CLI (`supabase db push`).

-- ───────────────────────────── Tables ─────────────────────────────

create table if not exists public.applications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company      text not null,
  role         text not null,
  status       text not null default 'Saved'
               constraint applications_status_check
               check (status in ('Saved', 'Applied', 'Interviewing', 'Offer', 'Rejected', 'Withdrawn')),
  applied_date timestamptz,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.interviews (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  scheduled_at   timestamptz not null,
  type           text not null default 'Other'
                 constraint interviews_type_check
                 check (type in ('PhoneScreen', 'Technical', 'Behavioral', 'Onsite', 'Final', 'Other')),
  outcome        text not null default 'Pending'
                 constraint interviews_outcome_check
                 check (outcome in ('Pending', 'Passed', 'Rejected')),
  notes          text
);

create table if not exists public.contacts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name           text not null,
  company        text,
  email          text,
  phone          text,
  notes          text,
  -- Optional link: "the recruiter for this application" (matches Prisma SetNull).
  application_id uuid references public.applications (id) on delete set null
);

create table if not exists public.follow_ups (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  due_date       timestamptz not null,
  done           boolean not null default false,
  note           text
);

-- ───────────────────────────── Indexes ─────────────────────────────

create index if not exists applications_user_id_idx   on public.applications (user_id);
create index if not exists interviews_application_idx on public.interviews (application_id);
create index if not exists interviews_user_id_idx     on public.interviews (user_id);
create index if not exists contacts_application_idx   on public.contacts (application_id);
create index if not exists contacts_user_id_idx       on public.contacts (user_id);
create index if not exists follow_ups_application_idx on public.follow_ups (application_id);
create index if not exists follow_ups_user_id_idx     on public.follow_ups (user_id);

-- ───────────────────────── updated_at trigger ─────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists applications_set_updated_at on public.applications;
create trigger applications_set_updated_at
  before update on public.applications
  for each row execute function public.set_updated_at();

-- ─────────────────────── Row Level Security ───────────────────────
-- Each role may only see and touch its own rows. One FOR ALL policy per
-- table covers select / insert / update / delete.

alter table public.applications enable row level security;
alter table public.interviews   enable row level security;
alter table public.contacts     enable row level security;
alter table public.follow_ups   enable row level security;

drop policy if exists "own rows" on public.applications;
create policy "own rows" on public.applications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own rows" on public.interviews;
create policy "own rows" on public.interviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own rows" on public.contacts;
create policy "own rows" on public.contacts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own rows" on public.follow_ups;
create policy "own rows" on public.follow_ups
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
