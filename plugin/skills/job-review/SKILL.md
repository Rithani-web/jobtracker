---
name: job-review
description: Reviews a specified file against 7 JobTracker-specific quality checks (user scoping, auth gating, error handling, loading states, empty states, TypeScript hygiene, config hygiene) and outputs PASS/FAIL/WARN plus a fix list. Use when the user runs /job-review or asks for a JobTracker-style review of a file.
argument-hint: [file-path]
disable-model-invocation: false
---

# /job-review

When invoked with a filename, review it using these JobTracker-specific checks.

Review target: $ARGUMENTS. If no file was given, ask which file to review before doing anything else. If a directory is given, review the code files in it (.ts, .tsx, .mjs). Read the entire file before judging anything. This is a review only — do not modify the file. Cite every finding as `file:line`.

Output one line per check — `N. PASS|FAIL|WARN — <one-sentence evidence with file:line>` — then list every failed check with the exact line to fix.

**1. User scoping (no data leaks)** — Every Supabase query is scoped to the signed-in user: run through the session client (`getAuthedClient()` / `createClient()` from `@/lib/supabase`) so RLS enforces ownership, or explicitly `.eq("user_id", user.id)`. FAIL if a service-role key or direct DB connection touches user data without an explicit `user_id` filter, a query trusts a client-supplied user id without `getUser()`, or a server action skips the user check.

**2. Auth gating** — Protected pages must not render anything for anonymous visitors: `const { user } = await getAuthedClient(); if (!user) return null;` (there is no `requireUser()` helper in this project — `src/proxy.ts` performs the redirect, but pages must still guard, and proxy must never be the only check). Server actions must bail without a user. New public routes (like `/login`) must be intentional exceptions.

**3. Error handling** — Every async failure path surfaces something the user can see: a returned `ActionState { error }`, a redirect, `.catch(() => fallback)`, or an error boundary. FAIL on bare unawaited promises, throws escaping a server action into the void, or `.single()`/`.maybeSingle()` results used without checking `error`/null.

**4. Loading state** — Any client form or button triggering a server action shows pending state (`SubmitButton` / `useFormStatus` / `aria-busy`). Page data is server-rendered per request (`force-dynamic`), which satisfies loading for reads — do NOT penalize the absence of `loading.tsx` skeletons (they were deliberately removed: they break `notFound()` HTTP status codes). Only FAIL client-side fetches with no loading UI.

**5. Empty state** — Every rendered list (`.map(...)` over query results) has a zero-results branch (typically the `EmptyState` component or conditional copy). FAIL if an empty result renders a blank section.

**6. TypeScript hygiene** — No `any` anywhere, including `as any` and implicit-any callback params. Exported components and functions have typed props/params (interface or type). Type-only imports use `import type`.

**7. Config hygiene** — No hardcoded values that belong in config or env: URLs, connection strings, API keys, feature flags, magic email domains. `process.env.NEXT_PUBLIC_*` reads are the norm; anything secret must stay server-side only.
