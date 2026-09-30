// Playwright QA run for JobTracker — exercises: login, create, edit, delete,
// logout against the running app. Throwaway artifact; safe to delete the
// whole qa-artifacts/ folder afterwards.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const EMAIL = "user1@seed.jobtracker.test";
const PASSWORD = "Password123!";
const COMPANY_CREATED = "QA Playwright Corp";
const COMPANY_EDITED = "QA Playwright Corp (Edited)";

mkdirSync("qa-artifacts/shots", { recursive: true });
let shotN = 0;
const results = [];
const consoleErrors = [];

async function shot(page, name) {
  await page.screenshot({
    path: `qa-artifacts/shots/${String(++shotN).padStart(2, "0")}-${name}.png`,
  });
}

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

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200));
});
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e}`));
page.on("dialog", (d) => d.accept()); // ConfirmSubmit delete confirmation

// 1. LOGIN -------------------------------------------------------------------
await step("1a. /login renders for anonymous visitor", async () => {
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/login/); // proxy must redirect
  await page.waitForSelector("#email");
  await shot(page, "login-page");
});

await step("1b. Login with demo user lands on dashboard", async () => {
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(`${BASE}/`, { timeout: 20000 });
  await page.waitForSelector("header");
  // The Fieldwork dashboard's heading is the time-based serif greeting,
  // not the word "Dashboard" (that's the metadata title / nav link now).
  // force-dynamic page runs live Supabase queries — wait, don't peek.
  await page
    .getByRole("heading", { name: /Good (morning|afternoon|evening)\./ })
    .waitFor({ state: "visible", timeout: 20000 });
  await shot(page, "dashboard-after-login");
});

// 2. CREATE ------------------------------------------------------------------
await step("2a. Applications list renders with add form", async () => {
  await page.goto(`${BASE}/applications`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#company");
  await shot(page, "applications-list");
});

await step("2b. Create application → redirected to detail page", async () => {
  await page.fill("#company", COMPANY_CREATED);
  await page.fill("#role", "QA Engineer (Automated)");
  await page.selectOption("#status", "Applied");
  await page.fill("#appliedDate", "2026-09-23");
  await page.fill(
    "#notes",
    "Created by automated Playwright QA run. Safe to delete.",
  );
  await page.getByRole("button", { name: "Create application" }).click();
  await page.waitForURL(/\/applications\/[0-9a-f-]{36}/, { timeout: 20000 });
  await page.waitForSelector("h1");
  if (!(await page.getByRole("heading", { name: COMPANY_CREATED }).isVisible()))
    throw new Error("created company not shown as detail-page heading");
  await shot(page, "created-detail");
});

// 3. EDIT --------------------------------------------------------------------
await step("3. Edit application → changes persist on page", async () => {
  const editDetails = page
    .locator("details")
    .filter({ hasText: "Edit application" });
  if (!(await editDetails.evaluate((el) => el.open)))
    await editDetails.locator("summary").click();
  await page.fill("#company", COMPANY_EDITED);
  await page.fill("#role", "Senior QA Engineer (Automated)");
  await page.selectOption("#status", "Interviewing");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.waitForFunction(
    (expected) => document.querySelector("h1")?.textContent?.includes(expected),
    COMPANY_EDITED,
    { timeout: 20000 },
  );
  if (!(await page.getByText("Senior QA Engineer (Automated)").isVisible()))
    throw new Error("edited role not shown");
  await shot(page, "edited-detail");
});

// 4. DELETE ------------------------------------------------------------------
await step("4. Delete application → gone from list", async () => {
  await page
    .getByRole("button", { name: "Delete application" })
    .click(); // window.confirm auto-accepted by dialog handler
  await page.waitForURL(`${BASE}/applications`, { timeout: 20000 });
  await page.waitForSelector("#company"); // add form present = list rendered
  const body = await page.textContent("body");
  if (body.includes(COMPANY_EDITED))
    throw new Error("deleted application still visible in list");
  await shot(page, "after-delete");
});

// 5. LOGOUT ------------------------------------------------------------------
await step("5. Logout returns to /login", async () => {
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/login/, { timeout: 20000 });
  await page.waitForSelector("#email");
  await shot(page, "logged-out");
});

await browser.close();

// Post-flight: deleted app must stay gone after logout (server-side check is
// implicit — the delete already redirected; re-login check kept out of scope).

const summary = {
  baseUrl: BASE,
  timestamp: new Date().toISOString(),
  results,
  consoleErrors,
};
writeFileSync("qa-artifacts/qa-results.json", JSON.stringify(summary, null, 2));
const failed = results.filter((r) => r.status === "FAIL").length;
console.log(
  `\n${results.length - failed}/${results.length} steps passed. Console errors: ${consoleErrors.length}`,
);
process.exit(failed > 0 ? 1 : 0);
