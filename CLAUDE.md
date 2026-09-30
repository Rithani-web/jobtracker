# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

JobTracker — a job-application tracker (applications, interviews, follow-ups, contacts) for a single signed-in user. Next.js 16 App Router + React 19 + Tailwind v4, with **Supabase** (Postgres + Auth + RLS) as the data layer. The `prisma/` directory and `src/generated/prisma` are unused leftovers of the previous SQLite data layer — do not build on them; `.env.example` is also stale from that era.

## Commands

```bash
npm run dev      # dev server
npm run build    # production build
npm run lint     # eslint (flat config)
```

There is no unit-test runner. Verification is script-based (`node supabase/scripts/<script>.mjs`):

| Script | Purpose |
|---|---|
| `push-schema.mjs` | Applies `supabase/migrations/*.sql` (sorted) to the database. Requires `SUPABASE_DB_URL` in `supabase/.env.local`. |
| `seed.mjs [n]` | Re-seeds demo users + data (idempotent — wipes prior seed users). Users `user1..8@seed.jobtracker.test`, password `Password123!`. |
| `test-supabase.mjs` | Schema/RLS verification suite via the real PostgREST + Auth APIs. |
| `smoke-app.mjs` | E2E smoke: signs in via Auth, injects the session cookie, loads protected pages. |
| `inspect-db.mjs` / `find-pooler.mjs` | Ground-truth DB inspection / pooler endpoint discovery (the direct `db.<ref>.supabase.co` host is IPv6-only; use the IPv4 session pooler). |

Playwright QA (throwaway, expects the app on `BASE_URL`, default `http://localhost:3100`): `node qa-artifacts/qa-test.mjs`.

**Environment files:** root `.env.local` holds `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`. `supabase/.env.local` holds `SUPABASE_DB_URL` and credentials for the scripts. Never print or commit secret values.

## Architecture

**Auth and tenancy** — `src/proxy.ts` (Next.js 16 renamed middleware to proxy) refreshes the Supabase session on every request and does optimistic redirects to/from `/login`. It is *not* the authorization layer: real enforcement is RLS in Postgres plus `getUser()` checks inside server actions. Pages and actions obtain a client via `createClient()` / `getAuthedClient()` from `src/lib/supabase.ts`; because that client reads the session from cookies, every query runs as the signed-in user and RLS scopes all rows automatically.

**Mutations** — server actions in `src/app/actions/*.ts` (`"use server"`), one file per entity. Shared conventions:
- `src/lib/form.ts` provides FormData parsing (`text`, `optText`, `id`, `parseDateInput`) and `revalidateAll()`, which every mutating action calls so lists/dashboard/detail stay in sync.
- Stateful actions use the `ActionState` contract `{ error: string | null; ok: boolean }` from `src/lib/domain.ts` with `useActionState` on the client.
- Owner-scoped updates end with `.select("id").single()`: RLS reduces a foreign/missing id to zero rows, which surfaces as a PostgREST error instead of a silent success. Preserve this pattern.

**Domain vocabulary** — `src/lib/domain.ts` is the single source for status / interview-type / outcome enums (plain DB strings, validated in app code with `isStatus` etc.), date formatting/parsing helpers, and the shared Tailwind class tokens (`cardClass`, `btnPrimary`, `inputClass`, badge helpers). Reuse these tokens instead of restyling inline.

**Routes** — dashboard (`page.tsx`), `/applications` + `/applications/[id]` (with timeline), `/contacts`, `/follow-ups`, `/login`. API: `/api/applications` (safe, parameterized) and `/api/notifications`.

**Schema** — four tables (`applications`, `interviews`, `contacts`, `follow_ups`), RLS-scoped to the owning user. Applications use soft-archive (`archived_at`, migration `0002`): archived rows leave the Active list but keep counting in dashboard metrics and keep their children. Migration `0003` adds `notifications` (surfaced by the header bell via `/api/notifications`).

**No `loading.tsx` files, deliberately** — route-level `loading.tsx` breaks `notFound()` HTTP status behavior (pages would 200 with a skeleton instead of 404). Do not add them.

## Other directories

- `mcp-server/` — `jobtracker-mcp`, a TypeScript stdio MCP server exposing JobTracker data as tools; queries Postgres directly via `pg` over the Supabase session pooler (see the TLS workaround note in its connection config — a known quirk of that pooler's cert chain, worth properly trusting the chain instead). Scoped to one user via `MCP_USER_EMAIL`. Build with `npm run build`; `smoke.mjs` exercises the tools.
- `my-mcp-server/` — Python MCP server scratch copy (learning).
- `plugin/` + `.claude-plugin/` — Claude Code plugin packaging: hooks plus the `jobtracker-plugin` skills (job-review, scope-a-feature, weekly-summary, frontend-design).
- `skills/`, `temp-skills-repo/` — vendored copies of Anthropic's skills repo; unrelated to the app.
- `qa-artifacts/` — throwaway QA output; safe to delete wholesale.
- `AGENTS.md` (imported above) is regenerated by `next dev`; commit changes to it rather than stripping the block.
