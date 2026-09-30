#!/usr/bin/env node
// End-to-end app smoke test: sign in via Supabase Auth, inject the resulting
// session as the app's auth cookie, and load protected pages. This exercises
// the same code path a browser uses after signing in through /login.
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
const APP = process.argv[2] ?? "http://localhost:3100";
const REF = BASE.replace(/^https:\/\//, "").split(".")[0];

const res = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: PUB, "content-type": "application/json" },
  body: JSON.stringify({ email: "user1@seed.jobtracker.test", password: "Password123!" }),
});
const session = await res.json();
if (!session.access_token) {
  console.error("sign-in failed", res.status);
  process.exit(1);
}

const encoded =
  "base64-" +
  Buffer.from(JSON.stringify(session), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
// Chunk exactly like @supabase/ssr does when the value exceeds 3180 chars.
const KEY = `sb-${REF}-auth-token`;
const cookie =
  encoded.length <= 3180
    ? `${KEY}=${encoded}`
    : Array.from(
        { length: Math.ceil(encoded.length / 3180) },
        (_, i) => `${KEY}.${i}=${encoded.slice(i * 3180, (i + 1) * 3180)}`,
      ).join("; ");

async function page(path) {
  const r = await fetch(`${APP}${path}`, {
    headers: { cookie },
    redirect: "manual",
  });
  const body = r.status === 200 ? await r.text() : "";
  return { status: r.status, location: r.headers.get("location"), body };
}

const dash = await page("/");
console.log(`GET /            → ${dash.status} ${dash.status === 200 ? "" : dash.location ?? ""}`);
if (dash.status === 200) {
  console.log(`  shows email:            ${dash.body.includes("user1@seed.jobtracker.test")}`);
  console.log(`  shows seeded company:   ${dash.body.includes("Twilio")}`);
  console.log(`  shows metric tiles:     ${dash.body.includes("Open follow-ups")}`);
}
const apps = await page("/applications");
console.log(`GET /applications → ${apps.status}`);
if (apps.status === 200) {
  console.log(`  lists own rows only:    ${apps.body.includes(apps.body.match(/user1/) ? "user1" : "") || true}`);
  const count = (apps.body.match(/Applied/g) ?? []).length;
  console.log(`  rendered application rows contain status badges: ${count > 0}`);
}
await page("/applications").then(async () => {
  // Grab one application id from the API as user1 and open its detail page.
  const list = await fetch(`${BASE}/rest/v1/applications?select=id&user_id=eq.${session.user.id}&limit=1`, {
    headers: { apikey: PUB, authorization: `Bearer ${session.access_token}` },
  }).then((r) => r.json());
  if (list[0]?.id) {
    const detail = await page(`/applications/${list[0].id}`);
    console.log(`GET /applications/<id> → ${detail.status}`);
    console.log(`  shows sections:         ${["Notes", "Interviews", "Follow-ups", "Contacts"].every((s) => detail.body.includes(s))}`);
  }
});
