---
description: "Security review of staged changes: auth, JWT/session, SQL injection"
argument-hint: "[optional extra focus, e.g. \"backend/ JWT handling\"]"
allowed-tools: Read, Glob, Grep, Bash(git diff:*), Bash(git status:*)
---

Security-review the changes currently staged for commit. Additional focus from the caller (may be empty): $ARGUMENTS

## Staged changes (injected at invocation)

- Stat (if empty, nothing is staged: say so and stop): !`git diff --staged --stat`
- Status (`??` untracked files are NOT in the diff — list them as unreviewed at the end): !`git status --short`

Full staged diff:

!`git diff --staged`

## Security baseline (read for patterns, not as findings)

- @src/lib/supabase.ts — how clients are created; every query must run as the signed-in user so RLS scopes all rows automatically.
- @src/proxy.ts — session refresh + optimistic redirects; this is NOT the authorization layer, only a convenience.
- @src/app/api/sql-injection-demo/route.ts — deliberately vulnerable local demo. Its existence is NOT a finding.

## Checklist

### Auth (server actions & API routes)

1. Every new/changed server action and route handler authenticates via `getAuthedClient()` / `getUser()` — never treat a passing `src/proxy.ts` check as authorization.
2. Queries use the cookie-scoped client from `src/lib/supabase.ts`, so RLS scopes rows to the owner. Flag any service-role/admin client outside the demo route.
3. Owner-scoped updates still end with `.select("id").single()` so RLS-reduced zero rows surface as a PostgREST error, not silent success. Flag removals of this pattern.
4. New/changed migrations enable RLS and scope policies to `auth.uid()`; flag missing `ENABLE ROW LEVEL SECURITY`, `USING (true)`, or policy-free new tables.

### JWT / session / secrets

1. `backend/` (JWT + pg): tokens verified with an explicit expected algorithm; no `ignoreExpiration`, no permissive verify options; `JWT_SECRET` comes from env — flag committed values or weak fallback defaults.
2. No secrets, tokens, cookies, or session material logged, echoed in responses, or exposed via `NEXT_PUBLIC_*` vars / client components.
3. Changes to `src/proxy.ts` session-refresh or cookie handling must not skip the refresh step or widen redirect targets (open-redirect check on the `?next=`-style params).

### SQL injection

1. No string concatenation or template-literal interpolation reaches SQL. `pg` queries must use `$1`-style placeholders; flag any `${...}` inside a query string, even "safe-looking" numbers.
2. Dynamic identifiers (table/column/ORDER BY) must be allowlisted server-side, not sanitized or escaped by hand.
3. The demo route (`/api/sql-injection-demo`) stays demo-only: flag changes that expand its surface, strip the local-learning-only framing, rename it to look production-real, or wire it into deploy config. Do not re-report its intentional vulnerability as a finding.
4. `prisma/` and `src/generated/prisma` are dead leftovers — ignore them, but flag newly introduced `$queryRawUnsafe` / `$executeRawUnsafe` anywhere.

## Report

1. Findings table, most severe first: Severity (Critical/High/Medium/Low) | file:line (line numbers in the staged/new version) | issue | concrete fix.
2. Mark each finding **Confirmed** (exploitable as staged) or **Needs verification** (depends on surrounding code — go read it before reporting).
3. Unreviewed-files note: any `??` untracked files related to the change that the staged diff does not cover.
4. Verdict, one line: `BLOCK` / `FIX BEFORE COMMIT` / `CLEAN`, with a one-sentence justification.
