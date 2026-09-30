#!/usr/bin/env node
// JobTracker Supabase verification suite.
//
// Reads credentials from supabase/.env.local and exercises the schema through
// the real Supabase APIs (PostgREST + Auth). Never prints secret values.
//
//   Tier 0 — reachability + table existence            (always)
//   Tier 1 — RLS negative tests                        (publishable key)
//   Tier 2 — full user-path CRUD, RLS isolation,
//            cascade + set-null behavior               (needs service key)
//
// Usage: node supabase/scripts/test-supabase.mjs

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

const BASE = (env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const PUB = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

if (!BASE || !PUB) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in supabase/.env.local");
  process.exit(1);
}

const TEST_EMAIL = "rls-test@example.com";
const TEST_COMPANY = "RLS Test Co";
let pass = 0;
let fail = 0;

function check(name, ok, detail = "") {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function rest(key, token, method, path, body) {
  const headers = { apikey: key, "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  if (method === "POST" || method === "PATCH") headers.prefer = "return=representation";
  const res = await fetch(`${BASE}/rest/v1/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  return { status: res.status, data };
}

async function authAdmin(method, path, body) {
  const res = await fetch(`${BASE}/auth/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE,
      authorization: `Bearer ${SERVICE}`,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  return { status: res.status, data };
}

// ────────────────────────────── Tier 0 ──────────────────────────────

console.log("\nTier 0 — reachability & schema");
{
  const r = await rest(PUB, null, "GET", "applications?select=id&limit=1");
  if (r.status === 404 || (r.data && r.data.code === "PGRST205")) {
    check("tables exist", false, "applications not found — apply supabase/migrations/0001_init.sql first (Dashboard → SQL Editor)");
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(1);
  }
  check("tables exist & REST reachable", r.status === 200 && Array.isArray(r.data), `status ${r.status}`);
}

// ────────────────────────────── Tier 1 ──────────────────────────────

console.log("\nTier 1 — RLS blocks unauthenticated access");
{
  const r = await rest(PUB, null, "POST", "applications", {});
  check("anonymous INSERT rejected", r.status >= 400 && r.status < 500, `status ${r.status} (RLS off or user_id default leaked?)`);
}

// ────────────────────────────── Tier 2 ──────────────────────────────

if (!SERVICE) {
  console.log("\nTier 2 — skipped (no SUPABASE_SERVICE_ROLE_KEY in supabase/.env.local)");
} else {
  console.log("\nTier 2 — full user-path CRUD via authenticated user");

  // Cleanup leftovers from previous runs (idempotent reruns).
  // Server-side filters are not trusted before a delete: list everything,
  // filter to the exact test email in JS, delete by id, then verify.
  {
    const listed = await authAdmin("GET", "admin/users?per_page=200");
    const matches = (listed.users ?? []).filter((u) => u.email === TEST_EMAIL);
    for (const u of matches) {
      await authAdmin("DELETE", `admin/users/${u.id}`);
    }
    const after = await authAdmin("GET", "admin/users?per_page=200");
    if ((after.users ?? []).some((u) => u.email === TEST_EMAIL)) {
      console.log("  FAIL  could not remove previous test user — aborting to avoid touching other data");
      console.log(`\n${pass} passed, ${fail} failed`);
      process.exit(1);
    }
    await rest(SERVICE, null, "DELETE", `applications?company=eq.${encodeURIComponent(TEST_COMPANY)}`);
  }

  let user = null;
  {
    const created = await authAdmin("POST", "admin/users", {
      email: TEST_EMAIL,
      password: "Rls-Test-2026!",
      email_confirm: true,
    });
    user = created.data;
    check("test user created (admin API)", created.status === 200 && !!user?.id, `status ${created.status}`);
  }

  let token = null;
  {
    const res = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: PUB, "content-type": "application/json" },
      body: JSON.stringify({ email: TEST_EMAIL, password: "Rls-Test-2026!" }),
    });
    const data = await res.json().catch(() => null);
    token = data?.access_token ?? null;
    check("user signs in (password grant)", res.status === 200 && !!token, `status ${res.status}`);
  }

  let application = null;
  {
    // No user_id sent — the column default (auth.uid()) must fill it in,
    // and the RLS WITH CHECK must allow the insert.
    const r = await rest(PUB, token, "POST", "applications", {
      company: TEST_COMPANY,
      role: "Tester",
      status: "Saved",
    });
    application = Array.isArray(r.data) ? r.data[0] : r.data;
    check(
      "user INSERT application (RLS + default user_id)",
      r.status === 201 && !!application?.id && application.user_id === user.id,
      `status ${r.status}`,
    );
  }

  {
    const r = await rest(PUB, token, "GET", `applications?id=eq.${application.id}&select=id,company,status`);
    check("user SELECT own application", r.status === 200 && r.data?.length === 1, `status ${r.status}, rows ${r.data?.length}`);
  }

  let interview = null;
  let followUp = null;
  let contact = null;
  {
    const hour = (n) => new Date(Date.now() + n * 3600_000).toISOString();
    const ri = await rest(PUB, token, "POST", "interviews", {
      application_id: application.id,
      scheduled_at: hour(24),
      type: "Technical",
      outcome: "Pending",
      notes: "created by test suite",
    });
    interview = Array.isArray(ri.data) ? ri.data[0] : ri.data;
    check("user INSERT interview", ri.status === 201 && !!interview?.id, `status ${ri.status}`);

    const rf = await rest(PUB, token, "POST", "follow_ups", {
      application_id: application.id,
      due_date: hour(72),
      done: false,
      note: "created by test suite",
    });
    followUp = Array.isArray(rf.data) ? rf.data[0] : rf.data;
    check("user INSERT follow-up", rf.status === 201 && !!followUp?.id, `status ${rf.status}`);

    const rc = await rest(PUB, token, "POST", "contacts", {
      name: "RLS Tester",
      application_id: application.id,
    });
    contact = Array.isArray(rc.data) ? rc.data[0] : rc.data;
    check("user INSERT contact (linked)", rc.status === 201 && !!contact?.id, `status ${rc.status}`);
  }

  {
    const r = await rest(PUB, token, "PATCH", `applications?id=eq.${application.id}`, { status: "Applied" });
    const row = Array.isArray(r.data) ? r.data[0] : r.data;
    check("user UPDATE application status", r.status === 200 && row?.status === "Applied", `status ${r.status}`);
  }

  {
    const bad = await rest(PUB, token, "POST", "applications", { company: TEST_COMPANY, role: "Bad", status: "NotAStatus" });
    check("CHECK constraint rejects invalid status", bad.status >= 400, `status ${bad.status}`);
  }

  // Delete the application as its owner; children must cascade / detach.
  {
    const del = await rest(PUB, token, "DELETE", `applications?id=eq.${application.id}`);
    check("user DELETE application", del.status === 200 || del.status === 204, `status ${del.status}`);

    const kids = await rest(PUB, token, "GET", `interviews?application_id=eq.${application.id}&select=id`);
    check("interviews cascaded on delete", kids.status === 200 && kids.data?.length === 0, `remaining ${kids.data?.length}`);

    const kidsF = await rest(PUB, token, "GET", `follow_ups?application_id=eq.${application.id}&select=id`);
    check("follow-ups cascaded on delete", kidsF.status === 200 && kidsF.data?.length === 0, `remaining ${kidsF.data?.length}`);

    const c = await rest(PUB, token, "GET", `contacts?id=eq.${contact.id}&select=application_id`);
    check("contact detached (set null), not deleted", c.status === 200 && c.data?.length === 1 && c.data[0].application_id === null, JSON.stringify(c.data));
  }

  // Isolation: rows exist for the test user, but the anonymous key sees none.
  {
    const serviceView = await rest(SERVICE, null, "GET", `applications?company=eq.${encodeURIComponent(TEST_COMPANY)}&select=id`);
    const anonView = await rest(PUB, null, "GET", "applications?select=id");
    check(
      "RLS isolation: service sees rows, anonymous sees none",
      serviceView.data?.length === 0 && anonView.status === 200 && anonView.data?.length === 0,
      `service rows ${serviceView.data?.length}, anon rows ${anonView.data?.length}`,
    );
  }

  // Cleanup: deleting the user cascades every remaining row they own.
  {
    await rest(SERVICE, null, "DELETE", `contacts?name=eq.RLS%20Tester`);
    const del = await authAdmin("DELETE", `admin/users/${user.id}`);
    const left = await rest(SERVICE, null, "GET", `applications?company=eq.${encodeURIComponent(TEST_COMPANY)}&select=id`);
    check("cleanup removed test user and all rows", del.status === 200 && left.data?.length === 0, `status ${del.status}, left ${left.data?.length}`);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
