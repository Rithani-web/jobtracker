#!/usr/bin/env node
// Seeds the Supabase project with demo users and a realistic amount of
// JobTracker data (applications, interviews, follow-ups, contacts).
//
// - Idempotent: re-seeding wipes previously seeded users (cascade removes
//   their rows) and recreates everything.
// - Uses the service key server-side; RLS is bypassed for seeding only.
//
// Usage: node supabase/scripts/seed.mjs [userCount]
// Default: 8 users. Every seeded user's password is "Password123!".

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
if (!BASE || !PUB || !SERVICE) {
  console.error("Need Supabase URL, anon key, and service key in supabase/.env.local");
  process.exit(1);
}

const SEED_DOMAIN = "seed.jobtracker.test";
const PASSWORD = "Password123!";
const USER_COUNT = Math.max(1, Number(process.argv[2] ?? 8));

// Deterministic PRNG so reseeds produce comparable data.
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260922);
const int = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const chance = (p) => rand() < p;
const daysFromNow = (days, hour = 10) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, int(0, 3) * 15, 0, 0);
  return d.toISOString();
};

const FIRST_NAMES = ["Alex", "Sam", "Jordan", "Priya", "Diego", "Mei", "Noah", "Zara", "Liam", "Ana", "Omar", "Lena"];
const LAST_NAMES = ["Rivera", "Chen", "Patel", "Okafor", "Kim", "Novak", "Silva", "Haddad", "Brooks", "Tanaka"];
const COMPANIES = ["Vercel", "Stripe", "Linear", "Notion", "Figma", "Datadog", "Supabase", "Shopify", "Framer", "Retool", "Airtable", "GitHub", "Cloudflare", "MongoDB", "HashiCorp", "Snowflake", "Twilio", "Atlassian"];
const ROLES = ["Frontend Engineer", "Backend Engineer", "Full-Stack Engineer", "Senior Frontend Engineer", "Platform Engineer", "DevOps Engineer", "Product Engineer", "Software Engineer II", "Staff Engineer", "Site Reliability Engineer"];
const APP_NOTES = [
  "Salary band looks like $130–160k. Hybrid, 3 days in office.",
  "Great eng blog posts — mentioned their design system in the interview.",
  "Recruiter said the process is 3 rounds plus a take-home.",
  "Their product team is growing; team owns the checkout flow end to end.",
  "Not sure about the on-call rotation, ask in the next call.",
  "Use their app daily — would be a genuinely fun domain to work on.",
];
const INTERVIEW_NOTES = [
  "Interviewer: asks lots about past incidents and debugging stories.",
  "Prep: system design basics + their API docs.",
  "Behavioral round — have STAR stories ready.",
  "Take-home review call; they liked the test coverage.",
  "Panel with two engineers and the EM.",
];
const FOLLOWUP_NOTES = [
  "Send a thank-you email",
  "Ping the recruiter about the timeline",
  "Follow up on the take-home submission",
  "Ask about the team structure",
  "Negotiate — mention competing offer",
  "Check application status on the portal",
];
const CONTACT_NOTES = [
  "Recruiter — very responsive over email.",
  "Referred me; send them updates after each round.",
  "Hiring manager, likes concise updates.",
  "Met at a conference, happy to vouch internally.",
];

async function rest(method, path, body) {
  const res = await fetch(`${BASE}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE,
      authorization: `Bearer ${SERVICE}`,
      "content-type": "application/json",
      prefer: "return=representation",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  if (res.status >= 400) {
    throw new Error(`REST ${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return data;
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
  if (res.status >= 400) {
    throw new Error(`AUTH ${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return data;
}

/** Lists ALL auth users (server-side filters are not trusted here). */
async function listAllUsers() {
  const all = [];
  for (let page = 1; page <= 50; page++) {
    const res = await authAdmin("GET", `admin/users?page=${page}&per_page=200`);
    const users = res.users ?? [];
    all.push(...users);
    if (users.length < 200) return all;
  }
  return all;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Wipe previous seed users (cascades their data) ──
// Filter in JS by exact email; never trust a server-side filter before a delete.
console.log("Removing previously seeded users (if any)…");
{
  const seeded = (await listAllUsers()).filter((u) =>
    (u.email ?? "").endsWith(`@${SEED_DOMAIN}`),
  );
  for (const u of seeded) {
    await authAdmin("DELETE", `admin/users/${u.id}`);
  }
  const leftover = (await listAllUsers()).filter((u) =>
    (u.email ?? "").endsWith(`@${SEED_DOMAIN}`),
  );
  if (leftover.length > 0) {
    throw new Error(`Failed to remove ${leftover.length} previous seed users`);
  }
  console.log(`  removed ${seeded.length}`);
}

// ── Create users and their data ──
const weightedStatus = () => {
  const r = rand();
  if (r < 0.2) return "Saved";
  if (r < 0.5) return "Applied";
  if (r < 0.7) return "Interviewing";
  if (r < 0.78) return "Offer";
  if (r < 0.93) return "Rejected";
  return "Withdrawn";
};

let totals = { users: 0, applications: 0, interviews: 0, follow_ups: 0, contacts: 0 };

for (let i = 1; i <= USER_COUNT; i++) {
  const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
  const email = `user${i}@${SEED_DOMAIN}`;

  const user = await authAdmin("POST", "admin/users", {
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  totals.users++;
  await sleep(150);

  const appCount = int(6, 12);
  for (let a = 0; a < appCount; a++) {
    const status = weightedStatus();
    const createdDaysAgo = int(5, 90);
    const createdAt = daysFromNow(-createdDaysAgo, int(9, 18));
    const updatedAt = daysFromNow(-int(0, Math.max(1, createdDaysAgo - 1)), int(9, 20));
    const appliedStatus = status !== "Saved";
    const appliedDate = appliedStatus ? daysFromNow(-int(2, createdDaysAgo)) : null;

    const [application] = await rest("POST", "applications", {
      user_id: user.id,
      company: pick(COMPANIES),
      role: pick(ROLES),
      status,
      applied_date: appliedDate,
      notes: chance(0.5) ? pick(APP_NOTES) : null,
      created_at: createdAt,
      updated_at: updatedAt,
    });
    totals.applications++;

    // Interviews for post-application stages.
    const interviewCount =
      status === "Interviewing" ? int(1, 3)
      : status === "Offer" ? int(2, 4)
      : status === "Rejected" && chance(0.6) ? int(1, 2)
      : status === "Withdrawn" && chance(0.3) ? 1
      : 0;
    for (let n = 0; n < interviewCount; n++) {
      const future = status === "Interviewing" && n === interviewCount - 1 && chance(0.6);
      const scheduledAt = future ? daysFromNow(int(1, 14), int(9, 16)) : daysFromNow(-int(1, createdDaysAgo), int(9, 16));
      const outcome = future ? "Pending"
        : status === "Offer" ? "Passed"
        : status === "Rejected" && n === interviewCount - 1 ? "Rejected"
        : chance(0.7) ? "Passed" : "Rejected";
      await rest("POST", "interviews", {
        user_id: user.id,
        application_id: application.id,
        scheduled_at: scheduledAt,
        type: pick(["PhoneScreen", "Technical", "Behavioral", "Onsite", "Final", "Other"]),
        outcome,
        notes: chance(0.7) ? pick(INTERVIEW_NOTES) : null,
      });
      totals.interviews++;
    }

    // Follow-ups, incl. overdue ones for realism.
    const fuCount = int(1, 3);
    for (let f = 0; f < fuCount; f++) {
      const done = chance(0.35);
      const overdue = !done && chance(0.25);
      const due = done ? daysFromNow(-int(2, 20)) : overdue ? daysFromNow(-int(1, 7)) : daysFromNow(int(1, 10));
      await rest("POST", "follow_ups", {
        user_id: user.id,
        application_id: application.id,
        due_date: due,
        done,
        note: chance(0.8) ? pick(FOLLOWUP_NOTES) : null,
      });
      totals.follow_ups++;
    }
  }

  // Contacts: mostly linked to one of this user's applications.
  const ownApps = await rest("GET", `applications?user_id=eq.${user.id}&select=id`);
  const contactCount = int(2, 5);
  for (let c = 0; c < contactCount; c++) {
    const linked = chance(0.75) && ownApps.length > 0;
    await rest("POST", "contacts", {
      user_id: user.id,
      name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
      company: chance(0.7) ? pick(COMPANIES) : null,
      email: chance(0.8) ? `${pick(["jordan", "sam", "priya", "lee", "maria"])}${int(1, 99)}@example.com` : null,
      phone: chance(0.4) ? `+1 555 0${int(10, 99)} ${int(1000, 9999)}` : null,
      notes: chance(0.6) ? pick(CONTACT_NOTES) : null,
      application_id: linked ? pick(ownApps).id : null,
    });
    totals.contacts++;
  }

  console.log(`  ${email} (${name}): ${appCount} applications`);
}

console.log(
  `\nSeeded ${JSON.stringify(totals)}\nLogin with any address @${SEED_DOMAIN} (e.g. user1@${SEED_DOMAIN}) · password: ${PASSWORD}`,
);
