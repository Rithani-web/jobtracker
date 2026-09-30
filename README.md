# JobTracker

A job-application tracker for a single signed-in user: track applications, interviews, follow-ups, and contacts end-to-end.

## Tech stack

- [Next.js](https://nextjs.org) 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4
- [Supabase](https://supabase.com) (Postgres + Auth), with Row-Level Security scoping every row to the signed-in user

## Getting started

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

### Environment

Two env files are required (never commit them — they are gitignored):

- `.env.local` — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `supabase/.env.local` — `SUPABASE_DB_URL` (used by the scripts below)

## Commands

```bash
npm run dev      # dev server
npm run build    # production build
npm run lint     # eslint
```

Verification scripts (see `supabase/scripts/`):

```bash
node supabase/scripts/push-schema.mjs   # apply supabase/migrations/*.sql
node supabase/scripts/seed.mjs          # re-seed demo users + data
node supabase/scripts/test-supabase.mjs # schema/RLS verification suite
node supabase/scripts/smoke-app.mjs     # E2E smoke via Auth + session cookie
```

Seeded demo users: `user1..8@seed.jobtracker.test`, password `Password123!`.

## Project layout

- `src/app/` — dashboard, `/applications` (+ detail w/ timeline), `/contacts`, `/follow-ups`, `/login`
- `src/app/actions/` — server actions, one file per entity
- `src/lib/` — domain enums, form parsing, Supabase clients
- `supabase/` — migrations and verification scripts

## Deployment

Not deployed yet. Before deploying: set `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` on the host and add the deployed domain to Supabase Auth's allowed redirect URLs.
