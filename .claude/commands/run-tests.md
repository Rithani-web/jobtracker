---
description: Run type-check, lint, and tests (when configured) for a package
argument-hint: "[backend|frontend|.] [test file]"
allowed-tools: Bash(npm run *), Bash(npx vitest *), Bash(node --test *), Read, Glob, Grep
---

Run the verification suite for the package named in $ARGUMENTS (default: all packages if empty).

Packages: `backend/`, `frontend/`, and the root Next.js app (root scripts: `lint`, `build`).

Steps:

1. **Detect a test runner** in the target package: look for `vitest`/`jest` in its package.json devDependencies or a test script. **This repo currently has no test runner installed in any package** — if that is still true, say so explicitly instead of pretending to run tests.
2. If a test runner IS configured and a test file was given, run just that file; otherwise run the package's test script.
3. Run the static gates that DO exist, in order, from the package directory:
   - `backend/`: `npm run type-check` then `npm run lint`
   - `frontend/`: `npm run typecheck` then `npm run lint` (lint requires ESLint deps — if absent, report that and skip)
   - root: `npm run lint`
4. Report a compact table: gate → command → PASS/FAIL → failure details (if any). Failures are not to be auto-fixed unless asked.
