---
name: api-conventions
description: JobTracker's backend/ Express API conventions — Router layout, zod validation, exact error shapes, ownership-scoped pg queries, JWT auth. Use when adding or changing backend endpoints (backend/src/routes/**), the db helper, auth middleware, or services. Not for Next.js route handlers in src/app/api — those follow the app's server-action conventions instead.
---

Express 5 + TypeScript + `pg` + JWT API in `backend/`. Read these before writing a route — they are the normative examples:

- `backend/src/server.ts` — app assembly, middleware order, mounts
- `backend/src/routes/tasks.ts` — richest route file: full CRUD + zod + dynamic SET
- `backend/src/routes/comments.ts` — nested-resource pattern (`mergeParams`)
- `backend/src/routes/auth.ts` — register/login, bcrypt, JWT signing, 409 handling
- `backend/src/db/index.ts` — `query<R>()` / `getClient()` helpers
- `backend/src/middleware/auth.ts` — `requireAuth` + `req.user` typing

## Layout

- One `Router` per resource in `backend/src/routes/`, mounted in `server.ts` (`app.use("/tasks", tasksRouter)`). Nested resources: `Router({ mergeParams: true })`.
- `server.ts` order is fixed: `import "dotenv/config"` → `cors()` → `express.json()` → `/health` → routers. Port: `Number(process.env.PORT) || 4000`.
- External APIs live in `services/`; instantiate the client **per call** so a missing key can't break module load (the route returns 503 first — see `POST /:id/enhance`).

## Route anatomy

```ts
router.use(requireAuth);                       // first line of every protected router

type TaskRow = { ... };                        // `type`, never interface (pg QueryResultRow);
                                               // columns snake_case, enums as string unions
const createSchema = z.object({ ... });        // schemas at module top, field schemas composed

router.post("/", async (req, res) => {
  const user = authUser(req);                  // narrows req.user without `!`
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", issues: parsed.error.issues }); return; }
  const result = await query<TaskRow>("INSERT ... VALUES ($1, ... ) RETURNING *", [user.id, ...]);
  res.status(201).json(result.rows[0]);
});
```

- Helpers `authUser(req)`, `validateIdParam(value, res)`, `resolveOwnedTaskId(req, res)` exist per-file; they **return the value or `null` after already answering**, and call sites do `if (x === null) return;`. Reuse the pattern; don't invent a new one.
- Unused params get a `_` prefix: `(_req, res)`.

## Validation (zod 4)

- Always `safeParse`, never `parse` — handlers respond, they don't throw.
- Path params: `z.uuid().safeParse(value)` → 400 on failure, before any DB call.
- Update schemas: `.partial()` over an object with **no `.default()`s** — defaults inside a partial'd schema re-apply on every parse and silently overwrite current values (see the comment in `tasks.ts`). Zod 4 omits absent keys from parse output.
- Emails: `z.email()`, not `z.string().email()`.

## Error & status contract

| Case | Response |
|---|---|
| Body/param validation | `400 { error: "Validation failed", issues: parsed.error.issues }` |
| Missing/foreign resource | `404 { error: "<Entity> not found" }` — **never 403**; ownership scoping means foreign and missing are indistinguishable |
| Bad/missing token | `401 { error: "Invalid or expired token" }` (from `requireAuth`) |
| Unknown login | `401 { error: "Invalid email or password" }` — identical for unknown email and wrong password |
| Duplicate (pg `23505`) | `409` with a user-facing message (`isUniqueViolation` helper in `auth.ts`) |
| Missing server config | `500 { error: "Server configuration error: ... is not set" }` — server's fault, fail loudly |
| External service unconfigured | `503` before any work |

Handlers return early on every error path — no central error middleware; unexpected async rejections fall through to Express 5's default handler. Success codes: `201` + created row, `204` + `.end()` for delete, `200` otherwise.

## Tenancy & SQL

- Every row-scoped query filters ownership in the same statement: `WHERE id = $1 AND user_id = $2` — one query doubles as existence + tenancy check, zero rows → 404.
- SQL only via `query<R>(text, params)` from `backend/src/db/index.ts`; values as `$1, $2, ...` — **never** interpolate values into `text`.
- Dynamic SET (PATCH): column names come only from zod-validated keys (fixed set), values parameterized — the pattern in `tasks.ts` `router.patch`. Never build SQL fragments from raw request data.
- `getClient()` only for transactions.

## Auth

- Tokens: `jwt.sign({ sub: user.id, email }, secret, { expiresIn: "12h" })`; verify via `jwt.verify` then shape-check `payload.sub`/`payload.email` as strings (see `middleware/auth.ts`).
- `req.user` typing comes from the `declare global` augmentation in `middleware/auth.ts` — extend that, don't re-declare.
- Secrets (`DATABASE_URL`, `JWT_SECRET`, `CLAUDE_API_KEY`) come from `backend/.env` only; never log them, never commit them, never default them to a weak fallback.
