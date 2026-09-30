#!/usr/bin/env node
// Applies supabase/migrations/*.sql (sorted) to the Supabase Postgres database.
//
// Requires SUPABASE_DB_URL in supabase/.env.local — the full connection URI
// from Dashboard → Settings → Database → Connection string → URI.
// (The `pg` driver must be present: npm install --no-save pg)
//
// Usage: node supabase/scripts/push-schema.mjs

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(join(here, "..", ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((line) => /^[A-Za-z_]+\s*=/.test(line))
    .map((line) => {
      const eq = line.indexOf("=");
      return [
        line.slice(0, eq).trim(),
        line.slice(eq + 1).trim().replace(/^["']|["']$/g, ""),
      ];
    }),
);

const dbUrl = env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error("Missing SUPABASE_DB_URL in supabase/.env.local");
  console.error("Copy it from Dashboard → Settings → Database → Connection string → URI");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: dbUrl,
  // Supabase serves a certificate that isn't publicly trusted; the connection
  // is still TLS-encrypted, we just skip CA verification.
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  const files = readdirSync(join(here, "..", "migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.error("No .sql files found in supabase/migrations/");
    process.exit(1);
  }

  for (const file of files) {
    const sql = readFileSync(join(here, "..", "migrations", file), "utf8");
    try {
      await client.query(sql);
      console.log(`Applied  ${file}`);
    } catch (err) {
      console.error(`FAILED   ${file}: ${err.message}`);
      process.exit(1);
    }
  }

  const { rows } = await client.query(
    `select table_name from information_schema.tables
     where table_schema = 'public'
       and table_name in ('applications', 'interviews', 'contacts', 'follow_ups')
     order by table_name`,
  );
  console.log(`Verified tables: ${rows.map((r) => r.table_name).join(", ")}`);
} finally {
  await client.end();
}
