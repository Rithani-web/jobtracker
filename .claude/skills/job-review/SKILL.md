---
name: job-review
description: Reviews a specified JobTracker source file against 8 project-specific quality checks (Supabase user scoping, auth gating, error handling, loading/empty states, TypeScript, responsive layout, config hygiene) and outputs PASS/FAIL/WARN plus a fix list. Use when the user runs /job-review or asks for a JobTracker-style review of a file.
argument-hint: [file-path]
---

# JobTracker file review

Review the file given as the argument: $ARGUMENTS

If no file was given, ask which file to review before doing anything else. If a directory is given, review the code files in it (.ts, .tsx, .mjs). Read the entire file before judging anything.

This is a review only — do not modify the file. Cite every finding as `file:line`.

## The 8 checks

Output one line per check: `N. PASS|FAIL|WARN — <one-sentence evidence with file:line>`

**1. User scoping (no data leaks)** — Every Supabase query must be scoped to the signed-in user. Accept either an explicit `.eq("user_id", user.id)` or a query run through the user-session client (`getAuthedClient()` / `createClient()` from `@/lib/supabase`) where RLS enforces ownership. FAIL if: a service-role key or direct DB connection touches user data without an explicit `user_id` filter; a query trusts a client-supplied user id without `getUser()`; or a server action skips the `getAuthedClient()` user check.

**2. Auth gating** — Pages rendering user data must not render anything for anonymous visitors (the `if (!user) return null` guard or a redirect; `src/proxy.ts` covers the route, so confirm the page doesn't bypass it — e.g. a new route excluded from the matcher). Server actions must bail without a user. New public routes (like `/login`) must be intentionally listed as exceptions.

**3. Error handling** — Every async function handles failure with something the user can see: a returned `ActionState { error }`, a redirect, `.catch(() => fallback)`, or an error boundary. FAIL on: bare unawaited promises, throws that escape a server action into the void, or `.single()`/`.maybeSingle()` results used without checking `error`/null.

**4. Loading feedback** — Any client form or button that triggers a server action must show a pending state (`SubmitButton` / `useFormStatus` / `aria-busy`). Page data is server-rendered per request (`force-dynamic`), which satisfies loading for page reads — do not penalize the absence of `loading.tsx` skeletons (they were deliberately removed because they break `notFound()` status codes; see the project memory). Only FAIL on client-side fetches with no loading UI.

**5. Empty states** — Every rendered list (`.map(...)` over query results) must have a zero-results branch (typically the `EmptyState` component or conditional copy). FAIL if an empty result renders a blank section.

**6. TypeScript hygiene** — No `any` anywhere, including `as any` and implicit-any callback params. Exported components and functions must have typed props/params (interface or type). Type-only imports should use `import type`.

**7. Responsive layout** — Flag fixed pixel widths that break on small screens (e.g. `w-[420px]` with no responsive fallback), grids/toolbars missing breakpoint or `flex-wrap` handling, and tables without horizontal-scroll containment. `max-w-*`, `min-w-0`, `sm:`/`md:`/`lg:` breakpoints, and truncation utilities are the project's good patterns.

**8. Config hygiene** — Entity choice lists (statuses, interview types, outcomes) must come from `src/lib/domain.ts` constants — duplicated literal arrays or scattered magic strings for these are FAIL. Repeated route paths or label strings used 3+ times → WARN with a suggestion. Any secret/key inline in code → FAIL immediately.

## Verdicts

- **PASS** — requirement met; cite the evidence.
- **WARN** — mostly met with a minor risk or nitpick; explain the risk in one clause.
- **FAIL** — missing or violated; explain the concrete failure mode.

Don't soften: a FAIL without a failure scenario is not a FAIL.

## Output format

```
Review: <file path>

1. PASS/FAIL/WARN — <evidence>
2. ...
...
8. PASS/FAIL/WARN — <evidence>

## Fix list
1. <most severe first> — <what to change> (`file:line`)
2. ...

```

If everything passes, say so plainly and list at most optional hardening suggestions. Keep the whole output tight — findings, not essays.
