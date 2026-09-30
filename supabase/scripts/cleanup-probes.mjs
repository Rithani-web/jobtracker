#!/usr/bin/env node
// One-off: removes the @probe.jobtracker.test diagnostic users by exact id.
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
const H = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  "content-type": "application/json",
};

const list = await fetch(`${BASE}/auth/v1/admin/users?per_page=200`, { headers: H }).then((r) => r.json());
const probes = (list.users ?? []).filter((u) => (u.email ?? "").endsWith("@probe.jobtracker.test"));
for (const u of probes) {
  const res = await fetch(`${BASE}/auth/v1/admin/users/${u.id}`, { method: "DELETE", headers: H });
  console.log(`delete ${u.email} → ${res.status}`);
}
const after = await fetch(`${BASE}/auth/v1/admin/users?per_page=200`, { headers: H }).then((r) => r.json());
console.log("remaining users:", (after.users ?? []).map((u) => u.email).join(", "));
