import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = "http://localhost:5173";
const outDir = path.resolve("qa-artifacts/uipro");
mkdirSync(outDir, { recursive: true });

const email = `qa-${Date.now()}@teamsync.test`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

// 1. Auth gate: /tasks must redirect to /login when signed out
await page.goto(`${BASE}/tasks`);
await page.waitForURL("**/login");
console.log("1. gate redirect:", page.url());
await page.screenshot({ path: `${outDir}/8-login-gate.png` });

// 2. Register a fresh user through the UI
await page.getByRole("button", { name: "Create one" }).click();
await page.getByLabel("Name").fill("QA Bot");
await page.getByLabel("Email").fill(email);
await page.getByLabel("Password").fill("Password123!");
await page.getByRole("button", { name: "Create account" }).click();
await page.waitForURL("**/tasks");
console.log("2. registered + landed:", page.url());

// 3. Fresh user sees the empty state
await page.getByText("No tasks yet").waitFor({ timeout: 15000 });
console.log("3. empty state visible");
await page.screenshot({ path: `${outDir}/9-empty-live.png` });

// 4. Create a task through the dialog
await page.getByRole("button", { name: "New task" }).first().click();
await page.getByLabel("Title").fill("QA wired task");
await page.getByLabel("Description").fill("Created through the live UI against the Render API.");
await page.getByLabel("Priority").selectOption("high");
await page.getByRole("button", { name: "Create task" }).click();
await page.getByText("QA wired task").first().waitFor({ timeout: 15000 });
console.log("4. task created and visible in list");
await page.screenshot({ path: `${outDir}/10-task-created.png` });

// 5. Details dialog via card click (deep-linkable route)
await page.getByRole("button", { name: "View details" }).first().click();
await page.getByRole("dialog").waitFor({ timeout: 10000 });
console.log("5. details url:", page.url());
await page.screenshot({ path: `${outDir}/11-details-live.png` });
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
console.log("   after esc:", page.url());

// 6. Dark mode
await page.getByRole("button", { name: "Toggle dark mode" }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${outDir}/12-dark-live.png` });

// 7. Sign out returns to /login
await page.getByRole("button", { name: "Sign out" }).click();
await page.waitForURL("**/login");
console.log("7. signed out:", page.url());

await browser.close();
console.log("QA PASS - registered:", email);
