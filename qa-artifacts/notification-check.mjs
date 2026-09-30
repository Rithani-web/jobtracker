// Playwright QA for the Notification Center — exercises: reminder sync,
// badge + panel UI, mark-read/mark-all/dismiss via the API, and the sync
// prune when a follow-up is completed. Throwaway artifact; safe to delete
// the whole qa-artifacts/ folder afterwards.
//
// Usage: BASE_URL=http://localhost:3000 node qa-artifacts/notification-check.mjs
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import pg from "pg";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = "user1@seed.jobtracker.test";
const PASSWORD = "Password123!";
const COMPANY = "QA Notification Corp";

// Direct-pg access for arranging/pruning the source data the sync derives
// from (service-style connection, same spirit as supabase/scripts/seed.mjs).
const env = Object.fromEntries(
  readFileSync("supabase/.env.local", "utf8")
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
const db = new pg.Client({
  connectionString: env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
await db.connect();

async function shot(page, name) {
  await page.screenshot({ path: `qa-artifacts/shots/${name}.png` });
}

const results = [];
async function step(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    results.push({ name, status: "PASS", ms: Date.now() - t0 });
    console.log(`PASS  ${name} (${Date.now() - t0}ms)`);
  } catch (error) {
    const message = String(error).split("\n")[0].slice(0, 300);
    results.push({ name, status: "FAIL", error: message, ms: Date.now() - t0 });
    console.log(`FAIL  ${name} (${Date.now() - t0}ms): ${message}`);
  }
}

// --- arrange: one application with an overdue follow-up + an upcoming interview
const { rows: userRows } = await db.query(
  "select id from auth.users where email = $1",
  [EMAIL],
);
const userId = userRows[0].id;
await db.query("delete from applications where company = $1 and user_id = $2", [
  COMPANY,
  userId,
]);
const { rows: appRows } = await db.query(
  `insert into applications (user_id, company, role, status)
   values ($1, $2, 'Notification QA', 'Applied') returning id`,
  [userId, COMPANY],
);
const appId = appRows[0].id;
await db.query(
  `insert into follow_ups (user_id, application_id, due_date, done, note)
   values ($1, $2, now() - interval '2 days', false, 'overdue on purpose')`,
  [userId, appId],
);
await db.query(
  `insert into interviews (user_id, application_id, scheduled_at, type, outcome)
   values ($1, $2, now() + interval '2 hours', 'Technical', 'Pending')`,
  [userId, appId],
);

// --- act
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e}`));
page.on("dialog", (d) => d.accept());

const apiGet = () =>
  page.evaluate(() =>
    fetch("/api/notifications", { cache: "no-store" }).then((r) => r.json()),
  );

await step("login via UI lands on dashboard", async () => {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(`${BASE}/`, { timeout: 20000 });
  await page.waitForSelector('button[aria-label="Notifications"]');
});

await step("badge shows 2 unread after sync", async () => {
  await page.waitForFunction(
    () =>
      document.querySelector('button[aria-label="Notifications"]')?.textContent
        ?.trim() === "2",
    { timeout: 15000 },
  );
});

await step("panel lists both reminders with chips", async () => {
  await page.click('button[aria-label="Notifications"]');
  const panel = page.locator('[role="dialog"][aria-label="Notifications"]');
  await panel.waitFor({ state: "visible" });
  await panel.getByText("Follow-up overdue").waitFor({ timeout: 10000 });
  await panel.getByText("Technical interview").waitFor();
  await panel.getByText("Overdue", { exact: true }).waitFor();
  await panel.getByText("Interview", { exact: true }).waitFor();
  await shot(page, "notification-panel");
});

await step("clicking the interview item marks read + navigates", async () => {
  const panel = page.locator('[role="dialog"][aria-label="Notifications"]');
  await panel.getByText("Technical interview").click();
  await page.waitForURL(new RegExp(`/applications/${appId}`), {
    timeout: 15000,
  });
  await page.waitForFunction(
    () =>
      document.querySelector('button[aria-label="Notifications"]')?.textContent
        ?.trim() === "1",
    { timeout: 15000 },
  );
});

await step("mark all read clears the badge", async () => {
  await page.click('button[aria-label="Notifications"]');
  const panel = page.locator('[role="dialog"][aria-label="Notifications"]');
  await panel.getByRole("button", { name: "Mark all read" }).click();
  await page.waitForFunction(
    () =>
      !document
        .querySelector('button[aria-label="Notifications"]')
        ?.textContent?.trim(),
    { timeout: 15000 },
  );
  await shot(page, "notification-all-read");
});

await step("dismiss removes the row from the panel", async () => {
  const panel = page.locator('[role="dialog"][aria-label="Notifications"]');
  const before = await panel.locator("li").count();
  await panel.locator('button[aria-label="Dismiss notification"]').first().click();
  await page.waitForFunction(
    (n) =>
      document.querySelectorAll(
        '[role="dialog"][aria-label="Notifications"] li',
      ).length === n - 1,
    before,
    { timeout: 15000 },
  );
});

await step("PATCH {all:true} via API reports unreadCount 0", async () => {
  const body = await page.evaluate(() =>
    fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    }).then((r) => r.json()),
  );
  if (body.ok !== true || body.unreadCount !== 0)
    throw new Error(`unexpected response: ${JSON.stringify(body)}`);
});

await step("prune: completing the follow-up removes its notification", async () => {
  await db.query(
    "update follow_ups set done = true where application_id = $1",
    [appId],
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(async () => true); // yield a tick
  const data = await apiGet(); // GET runs sync, which prunes the stale row
  const kinds = data.notifications.map((n) => n.kind);
  if (kinds.includes("follow_up_overdue"))
    throw new Error("overdue notification survived a done follow-up");
  if (!kinds.includes("interview_upcoming"))
    throw new Error("upcoming interview notification should remain");
  await shot(page, "notification-pruned");
});

// --- cleanup: cascade removes follow_up, interview, and notifications
await db.query("delete from applications where id = $1", [appId]);
const after = await apiGet();
await db.end();
await browser.close();

const summary = {
  baseUrl: BASE,
  timestamp: new Date().toISOString(),
  notificationsLeftAfterCleanup: after.notifications.length,
  results,
  consoleErrors,
};
writeFileSync(
  "qa-artifacts/notification-results.json",
  JSON.stringify(summary, null, 2),
);
const failed = results.filter((r) => r.status === "FAIL").length;
console.log(
  `\n${results.length - failed}/${results.length} steps passed. Console errors: ${consoleErrors.length}`,
);
process.exit(failed > 0 ? 1 : 0);
