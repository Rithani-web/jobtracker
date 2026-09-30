---
name: new-entity
description: Scaffolds a complete CRUD feature for a new JobTracker entity — card and form components, list page with add button and filters, RLS-scoped server actions, nav registration — always presenting a plan for approval before creating any file. Use when the user runs /new-entity or asks to add a new entity or CRUD resource to JobTracker.
argument-hint: [entity-name]
disable-model-invocation: true
---

# /new-entity

When invoked with a name, scaffold a full CRUD feature for that entity.

Entity: $ARGUMENTS (ask if missing; singular concept → plural table, e.g. "document" → `documents`).

**IMPORTANT — always use plan mode.** Before creating ANY file: read the reference files, present the full plan (every file you will create or modify, the migration, the routes), and wait for the user's explicit approval. Never scaffold unreviewed.

Read the existing pattern first: `supabase/migrations/0001_init.sql`, `src/lib/types.ts`, `src/lib/domain.ts`, `src/app/actions/followups.ts`, `src/components/followup-form.tsx`, `src/app/follow-ups/page.tsx`. This repo has NO `lib/<name>s.ts` data layer and NO sidebar component — deliverables below map to the project's real layout:

**1. Migration — `supabase/migrations/NNNN_<name>.sql`** (next free number, idempotent): `id uuid primary key default gen_random_uuid()`; `user_id uuid not null default auth.uid() references auth.users (id) on delete cascade`; optional `application_id ... references public.applications (id) on delete cascade`; named CHECK constraints for choice fields; `user_id` (+ `application_id`) indexes; `enable row level security` + one policy `"own rows"` `for all using (auth.uid() = user_id) with check (auth.uid() = user_id)`. Apply with `node supabase/scripts/push-schema.mjs`. Every Supabase access filters by `user_id` — via RLS through the session client or explicitly.

**2. Types — `src/lib/types.ts` + `src/lib/domain.ts`**: `X` UI model (camelCase, real `Date`s), `XRow` (snake_case, ISO strings), `toX()` via the file's `toDate` helper. Choice fields become `const X = [...] as const` + `isX()` guard in `domain.ts`, with badge-class maps if the UI needs them.

**3. Server actions — `src/app/actions/<name>.ts`** (this project's CRUD home, not a lib file): `"use server"`; every action starts with `getAuthedClient()` and bails without a user; `ActionState` style for create/update, `Promise<void>` fire-and-forget for delete/toggle; FormData parsing via `src/lib/form.ts` helpers; updates end `.select("id").single()` so RLS-filtered zero-row updates surface as errors; FK ids resolved through RLS-scoped lookups (see `resolveApplicationId`); every mutation calls `revalidateAll(applicationId?)`.

**4. Components** — `src/components/<name>-form.tsx`: `"use client"`, `useActionState` + `<FormMessages state={state} />` + `<SubmitButton>` (create/edit with validation and the Saving… state). `src/components/<name>-card.tsx`: display card using `cardClass` and the badge/chip tokens from `domain.ts`.

**5. List page — `src/app/<name>s/page.tsx`**: `export const dynamic = "force-dynamic"` + `metadata`; fetch via `getAuthedClient()` with `if (!user) return null; // proxy.ts redirects`; add button opening the form; URL-encoded filters; every list has an `<EmptyState>` zero branch. NEVER add `loading.tsx` (breaks `notFound()` status codes).

**6. Nav + revalidation**: add the route to the header nav in `src/app/layout.tsx` (there is no `components/sidebar.tsx` in this project) and the new path to `revalidateAll()` in `src/lib/form.ts`.

**Verify**: `npx eslint src && npm run build`; push the migration; exercise create → list → detail → delete against the dev server with a seeded login (`user1@seed.jobtracker.test` / `Password123!`); then run `/job-review` on the new files.
