#!/usr/bin/env node
// Finds the working Supabase session-pooler endpoint for this project.
// The direct db.<ref>.supabase.co host is IPv6-only; the pooler is IPv4.
// Prints the pooler connection URI for SUPABASE_DB_URL on success.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolve } from "node:dns/promises";
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

const ref = (env.NEXT_PUBLIC_SUPABASE_URL || "").match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
const password = env.SUPABASE_DB_PASSWORD || /:\/\/[^:]+:([^@]+)@/.exec(env.SUPABASE_DB_URL || "")?.[1];

if (!ref || !password) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL and a DB password (in SUPABASE_DB_URL or SUPABASE_DB_PASSWORD)");
  process.exit(1);
}

const regions = [
  "aws-0-us-east-1", "aws-0-us-east-2", "aws-0-us-west-1", "aws-0-us-west-2",
  "aws-0-ca-central-1", "aws-0-sa-east-1", "aws-0-eu-west-1", "aws-0-eu-west-2",
  "aws-0-eu-west-3", "aws-0-eu-central-1", "aws-0-eu-central-2", "aws-0-eu-north-1",
  "aws-0-ap-south-1", "aws-0-ap-south-2", "aws-0-ap-southeast-1", "aws-0-ap-southeast-2",
  "aws-0-ap-northeast-1", "aws-0-ap-northeast-2",
  "aws-1-us-east-1", "aws-1-us-east-2", "aws-1-eu-central-1", "aws-1-eu-west-1",
  "aws-1-ap-southeast-1", "aws-1-ap-northeast-1",
];

// Resolve DNS first (fast fail), then try a real connection on survivors.
const candidates = [];
for (const region of regions) {
  const host = `${region}.pooler.supabase.com`;
  try {
    await resolve(host);
    candidates.push({ region, host });
  } catch {
    /* host not resolvable from this network — skip */
  }
}

async function tryConnect({ host }, passwordOverride) {
  const client = new pg.Client({
    host,
    port: 5432,
    database: "postgres",
    user: `postgres.${ref}`,
    password: passwordOverride,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 6000,
  });
  try {
    await client.connect();
    await client.query("select 1");
    return true;
  } catch {
    return false;
  } finally {
    client.end().catch(() => {});
  }
}

for (const candidate of candidates) {
  process.stdout.write(`Trying ${candidate.host} … `);
  if (await tryConnect(candidate, password)) {
    console.log("CONNECTED");
    console.log(`\nSUPABASE_DB_URL=postgresql://postgres.${ref}:${encodeURIComponent(password)}@${candidate.host}:5432/postgres`);
    process.exit(0);
  }
  console.log("no");
}

console.error("\nNo pooler endpoint accepted the connection. Copy the Session-pooler URI from Dashboard → Settings → Database → Connection string.");
process.exit(1);
