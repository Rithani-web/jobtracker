#!/usr/bin/env node
// Ground-truth inspection via direct Postgres (session pooler).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(join(here, "..", ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Za-z_]+\s*=/.test(l))
    .map((l) => {
      const eq = l.indexOf("=");
      return [l.slice(0, eq).trim(), l.slice(eq + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const client = new pg.Client({
  connectionString: env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const users = await client.query(
  `select id, email, email_confirmed_at, created_at from auth.users order by created_at`,
);
console.log(`auth.users (${users.rows.length}):`);
for (const u of users.rows) {
  console.log(`  ${u.email} | confirmed=${u.email_confirmed_at ? "yes" : "no"} | ${u.created_at}`);
}

const counts = await client.query(
  `select
     (select count(*) from public.applications) apps,
     (select count(*) from public.interviews) ivs,
     (select count(*) from public.follow_ups) fus,
     (select count(*) from public.contacts) contacts`,
);
console.log("public rows:", JSON.stringify(counts.rows[0]));

const audit = await client.query(
  `select payload->>'action' as action,
          payload->>'actor_id' as actor,
          payload->>'ip_address' as ip,
          payload->>'created_at' as at,
          coalesce(payload->'traits'->>'email', payload->>'legacy_email', '') as email
   from auth.audit_log_entries
   order by created_at desc
   limit 25`,
);
console.log("\nrecent audit entries:");
for (const a of audit.rows) {
  console.log(`  ${a.at} ${a.action} ${a.email} ip=${a.ip}`);
}

await client.end();
