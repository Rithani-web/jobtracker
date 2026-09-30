// Throwaway smoke test for the /labels endpoint (backend/ Express API).
// Run: node qa-artifacts/backend-labels-smoke.mjs   (server must be up on SMOKE_BASE)
// Registers two throwaway probe users, exercises the full labels contract,
// then deletes the probe users (cascade removes their labels). Never prints
// tokens or connection strings.
import { createRequire } from "node:module";

// backend deps (dotenv for cleanup creds, pg for the probe-user delete) resolve
// from backend/node_modules — qa-artifacts/ sits outside that tree.
const require2 = createRequire("C:/Users/System3/Downloads/proj1/backend/package.json");
const { config } = require2("dotenv");
const pg = require2("pg");
config({ path: "C:/Users/System3/Downloads/proj1/backend/.env" }); // cleanup connection string only

const BASE = process.env.SMOKE_BASE || "http://localhost:4310";
const STAMP = Date.now();
const EMAIL_A = `labels-probe-${STAMP}-a@probe.backend.test`;
const EMAIL_B = `labels-probe-${STAMP}-b@probe.backend.test`;

let pass = 0;
let fail = 0;
function check(name, ok, detail = "") {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function register(email) {
  const r = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Probe-Passw0rd!", name: "Labels Probe" }),
  });
  if (r.status !== 201) throw new Error(`register failed: ${r.status}`);
  return (await r.json()).token;
}

function auth(token) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

const tokenA = await register(EMAIL_A);
const tokenB = await register(EMAIL_B);

// --- contract checks -------------------------------------------------------
try {
  let r = await fetch(`${BASE}/health`);
  check("GET /health -> 200", r.status === 200);

  r = await fetch(`${BASE}/labels`);
  check("GET /labels, no token -> 401", r.status === 401);

  r = await fetch(`${BASE}/labels`, { headers: auth(tokenA) });
  const empty = await r.json();
  check("GET /labels -> 200 []", r.status === 200 && Array.isArray(empty) && empty.length === 0);

  r = await fetch(`${BASE}/labels`, {
    method: "POST",
    headers: auth(tokenA),
    body: JSON.stringify({ name: "probe-label", color: "#33ccff" }),
  });
  const created = await r.json();
  check(
    "POST /labels -> 201 + row",
    r.status === 201 && created?.name === "probe-label" && created?.color === "#33ccff",
  );
  const labelId = created.id;

  r = await fetch(`${BASE}/labels`, {
    method: "POST",
    headers: auth(tokenA),
    body: JSON.stringify({ name: "probe-label" }),
  });
  check("POST duplicate name -> 409", r.status === 409);

  r = await fetch(`${BASE}/labels`, {
    method: "POST",
    headers: auth(tokenA),
    body: JSON.stringify({ name: "bad-color", color: "nothex" }),
  });
  check("POST bad color -> 400", r.status === 400);

  r = await fetch(`${BASE}/labels/not-a-uuid`, { headers: auth(tokenA) });
  check("GET /labels/:id bad uuid -> 400", r.status === 400);

  r = await fetch(`${BASE}/labels/${labelId}`, { headers: auth(tokenA) });
  const got = await r.json();
  check("GET /labels/:id -> 200", r.status === 200 && got?.id === labelId);

  r = await fetch(`${BASE}/labels/${labelId}`, {
    method: "PATCH",
    headers: auth(tokenA),
    body: JSON.stringify({ name: "probe-label-renamed", color: null }),
  });
  const patched = await r.json();
  check(
    "PATCH /labels/:id -> 200 renamed + color cleared",
    r.status === 200 && patched?.name === "probe-label-renamed" && patched?.color === null,
  );

  // tenancy: user B must not see A's label
  r = await fetch(`${BASE}/labels/${labelId}`, { headers: auth(tokenB) });
  check("GET foreign label as user B -> 404", r.status === 404);

  r = await fetch(`${BASE}/labels/${labelId}`, { method: "DELETE", headers: auth(tokenA) });
  check("DELETE /labels/:id -> 204", r.status === 204);

  r = await fetch(`${BASE}/labels/${labelId}`, { headers: auth(tokenA) });
  check("GET deleted label -> 404", r.status === 404);
} finally {
  // Cleanup: remove probe users; ON DELETE CASCADE removes their labels.
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const res = await client.query("DELETE FROM users WHERE email LIKE $1", [
      "labels-probe-%@probe.backend.test",
    ]);
    console.log(`cleanup: removed ${res.rowCount} probe user(s)`);
  } finally {
    await client.end();
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
