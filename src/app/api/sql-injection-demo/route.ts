// ⚠️⚠️⚠️  DELIBERATELY VULNERABLE — SQL INJECTION DEMO  ⚠️⚠️⚠️
//
// This endpoint exists to demonstrate SQL injection: `userInput` is
// concatenated straight into the query, so anything appended to it becomes
// SQL. Classic payloads to try in a browser:
//
//   ?company=' OR '1'='1' --          → returns EVERY application (all users)
//   ?company='; DROP TABLE interviews; --  → destroys data. Do not run lightly.
//   ?company=' UNION SELECT email, NULL, NULL, NULL, NULL, NULL, NULL, NULL FROM auth.users --
//
// Because this opens a DIRECT Postgres connection with DATABASE_URL, it runs
// as the database owner: RLS is completely bypassed, so "every application"
// includes other users' rows.
//
// RULES FOR THIS FILE:
//   - Local learning / demo only. NEVER deploy it (prod, preview, anywhere).
//   - Never rename it to sound like a real endpoint.
//   - The safe, parameterized equivalent lives at /api/applications.
//
// Requires DATABASE_URL in the root .env.local (copied from supabase/.env.local).

import pg from "pg";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const userInput = new URL(request.url).searchParams.get("company") ?? "";

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return Response.json(
      { error: "DATABASE_URL is not set — copy it into the root .env.local" },
      { status: 500 },
    );
  }

  // ⚠️ THE BUG: userInput is concatenated into SQL. Never do this with real
  // user input — see /api/applications for the parameterized version.
  const query = `
SELECT * FROM applications
WHERE company = '${userInput}'
`;

  const client = new pg.Client({
    connectionString: dbUrl,
    // Same as supabase/scripts/push-schema.mjs: the connection is TLS-encrypted;
    // Supabase serves a certificate that isn't publicly trusted, so CA
    // verification is skipped. Dev/demo only — never deployed.
    ssl: { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    const result = await client.query(query);
    // The built query is echoed back so you can watch injection happen.
    return Response.json({
      builtQuery: query,
      rowCount: result.rowCount,
      rows: result.rows,
    });
  } catch (error) {
    // DB errors are surfaced verbatim on purpose — reading driver errors is
    // half of learning to exploit (and fix) injection.
    return Response.json(
      {
        builtQuery: query,
        error: error instanceof Error ? error.message : "Query failed",
      },
      { status: 400 },
    );
  } finally {
    await client.end();
  }
}
