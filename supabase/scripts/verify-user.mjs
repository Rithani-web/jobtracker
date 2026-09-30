#!/usr/bin/env node
// One-off check: a seeded user can sign in and sees only their own rows.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
const BASE = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, "");
const PUB = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const res = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: PUB, "content-type": "application/json" },
  body: JSON.stringify({ email: "user1@seed.jobtracker.test", password: "Password123!" }),
});
const session = await res.json();
if (!session.access_token) {
  console.error("Sign-in failed:", res.status, JSON.stringify(session).slice(0, 200));
  process.exit(1);
}

const apps = await fetch(`${BASE}/rest/v1/applications?select=id,company,status`, {
  headers: { apikey: PUB, authorization: `Bearer ${session.access_token}` },
}).then((r) => r.json());

const anonApps = await fetch(`${BASE}/rest/v1/applications?select=id`, {
  headers: { apikey: PUB, authorization: `Bearer ${PUB}` },
}).then((r) => r.json());

console.log(`user1 signed in as ${session.user.email}`);
console.log(`user1 sees ${apps.length} applications (expected 12), e.g. ${apps.slice(0, 3).map((a) => `${a.company} [${a.status}]`).join(", ")}`);
console.log(`anonymous sees ${anonApps.length} rows (expected 0)`);
console.log(
  apps.length === 12 && anonApps.length === 0 ? "SEEDED-USER CHECK: PASS" : "SEEDED-USER CHECK: FAIL",
);
