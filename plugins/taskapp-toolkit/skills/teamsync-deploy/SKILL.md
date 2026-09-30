---
name: teamsync-deploy
description: Deploys TeamSync (the AI-native PM app planned in teamsync/docs/) — migrations, preview, production. DRAFT status the TeamSync codebase does not exist yet; every command below is UNVERIFIED and must be executed and corrected by the agent before relying on it. Use when the user asks to deploy, ship, or release TeamSync, or to verify/finalize this skill once TeamSync code exists.
allowed-tools: Bash, Read
---

# TeamSync deploy — **DRAFT**

> ⚠️ **Status: DRAFT.** TeamSync is planning docs only (`teamsync/docs/`) — there is no
> app code, no Vercel project, and no Supabase project yet. This skill describes the
> *intended* flow so the deploy is consistent when code exists. **Do not trust any
> command here until you have run it.** When you run a step for real, replace the
> placeholder with the verified command and delete the ⚠️ from that section. When all
> sections are verified, move the skill out of DRAFT (remove this banner and update
> the `description`).

Target architecture (from `teamsync/docs/06-technical-architecture.md`): Next.js on
**Vercel**, **Supabase** (Postgres + Auth + RLS) single region, migrations as
forward-only SQL, GitHub Actions gate on every PR, preview deploy per PR, `main` →
production.

## Intended flow (in order)

1. **Prerequisites (one-time)**
   - Vercel project created from the TeamSync repo; team + region chosen to match the
     Supabase region (beachhead geography — see docs 06 §2).
   - Supabase project created; connection string in `supabase/.env.local` as
     `SUPABASE_DB_URL` (same convention as JobTracker's scripts — reuse the
     `push-schema.mjs` pattern, pointed at the TeamSync migrations dir).
   - Vercel env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     (all envs); `ANTHROPIC_API_KEY`, rate-limit + Sentry secrets (server envs only —
     never exposed to the client; see docs 06 §4).
2. **Pre-deploy gate** — ⚠️ exact commands TBD when the repo exists; per docs:
   typecheck · lint · unit + RLS policy tests · build · bundle-budget check (GitHub
   Actions must be green; do not deploy red).
3. **Migrations first, then app** — forward-only SQL files, expand → contract for
   destructive changes (docs 06 §6). Applied to the target Supabase environment
   (preview project/branch for previews, production project for releases).
4. **Deploy** — `vercel deploy` for preview, merge/promote to production via `main`.
   ⚠️ Command + project link TBD on first run.
5. **Post-deploy smoke** — ⚠️ TBD: sign-in round-trip + one RLS-scoped read against
   the deployed URL (mirror of JobTracker's `smoke-app.mjs` approach).

## Finalization checklist (future agent: do these, then un-draft)

- [ ] Create/clone the TeamSync repo, confirm stack matches docs 06 §2
- [ ] Run each numbered step for real; replace every ⚠️ with the verified command
- [ ] Record real gotchas (region mismatch, env var misses, migration ordering) in a
      Gotchas section — only errors actually hit
- [ ] Update `description` (drop the DRAFT warning) and delete this banner
