# JobTracker — Playwright QA Report

**Date:** 2026-09-23 · **Runner:** Playwright (Chromium, headless) · **Target:** production build, `localhost:3100`
**Account:** `user1@seed.jobtracker.test` · **Overall: 7 / 7 steps PASS · 0 console errors**

## Results

| # | Step | Verdict | Time |
|---|------|---------|------|
| 1a | Anonymous visit to `/` redirects to `/login`; form renders | PASS | 173ms |
| 1b | Login with demo user → dashboard renders (serif greeting h1, pipeline, metrics) | PASS | 2006ms |
| 2a | `/applications` renders list + add-application form | PASS | 809ms |
| 2b | Create application → redirect to `/applications/{id}`, data shown | PASS | 1413ms |
| 3 | Edit application (company, role, status) → changes persist on page | PASS | 1181ms |
| 4 | Delete application (confirm dialog) → gone from list | PASS | 1419ms |
| 5 | Sign out → returned to `/login` | PASS | 569ms |

## Coverage notes

- Auth: proxy redirect (anon → `/login`), sign-in, sign-out, and session persistence across page navigations all exercised.
- CRUD: full create/read/update/delete round-trip on `applications` against the live Supabase backend; the QA row was deleted in step 4 (no residue).
- Verification included DOM assertions (URLs, headings, field values, list absence after delete) **and** visual inspection of screenshots.
- Not covered (candidates for next run): contacts & follow-ups CRUD, interview scheduling, archive/unarchive, mobile viewport, error paths (wrong password, empty required fields), the new `/api/*` endpoints.

## Findings

1. **No functional defects.** All five user flows behave correctly end-to-end; zero browser console errors across the whole run.
2. **Test-side findings (not app bugs), documented for the record:**
   - First-run failure: assertion matched two elements ("Dashboard" nav link + heading) — Playwright strict mode correctly refused to guess.
   - Second-run failure: assertion peeked at the page mid-render instead of waiting (`isVisible` vs `waitFor`).
   - Third-run failure was **legitimate test debt**: the assertion still expected the old `<h1>Dashboard</h1>`, which the Fieldwork redesign replaced with the time-based greeting. Tests must track intentional UI changes.
3. **Observation (not a defect):** the `force-dynamic` dashboard takes ~1–2s to render after login because it runs nine live Supabase queries with no cached shell — imperceptible in normal use, worth remembering if a loading skeleton is ever wanted (note: `loading.tsx` was deliberately removed in this project; see project memory).

## Artifacts

- `qa-artifacts/qa-test.mjs` — the suite (re-runnable: `node qa-artifacts/qa-test.mjs`, requires the server on `:3100`)
- `qa-artifacts/qa-results.json` — machine-readable results
- `qa-artifacts/shots/*.png` — 7 screenshots, one per step
