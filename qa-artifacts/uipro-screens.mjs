import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = "http://localhost:5173";
const outDir = path.resolve("qa-artifacts/uipro");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

// 1. Task list at /tasks (light)
await page.goto(`${BASE}/tasks`, { waitUntil: "networkidle" });
await page.screenshot({ path: `${outDir}/1-tasks-light.png` });

// 2. Dark mode
await page.getByRole("button", { name: "Toggle dark mode" }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${outDir}/2-tasks-dark.png` });

// 3. Details dialog via card button (light)
await page.getByRole("button", { name: "Toggle dark mode" }).click();
await page.getByRole("button", { name: "View details" }).first().click();
await page.waitForTimeout(300);
const dialogUrl = page.url();
console.log("dialog url:", dialogUrl);
await page.screenshot({ path: `${outDir}/3-details-dialog.png` });
await page.keyboard.press("Escape");
await page.waitForTimeout(200);
console.log("after esc url:", page.url());

// 4. Deep link straight to a task — dialog must open on load
await page.goto(`${BASE}/tasks/tsk-102`, { waitUntil: "networkidle" });
await page.waitForTimeout(300);
console.log("deep link dialog visible:", await page.getByRole("dialog").isVisible());
await page.screenshot({ path: `${outDir}/4-deep-link-dialog.png` });

// 5. Empty state (In review has zero tasks)
await page.goto(`${BASE}/tasks`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "In review" }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${outDir}/5-empty-state.png` });

// 6. Unknown task id → redirects to /tasks
await page.goto(`${BASE}/tasks/tsk-does-not-exist`, { waitUntil: "networkidle" });
await page.waitForTimeout(300);
console.log("unknown id url:", page.url());

// 7. 404 page
await page.goto(`${BASE}/nope`, { waitUntil: "networkidle" });
await page.waitForTimeout(300);
console.log("404 url:", page.url());
await page.screenshot({ path: `${outDir}/6-not-found.png` });

// 8. Mobile 375px
await page.goto(`${BASE}/tasks`, { waitUntil: "networkidle" });
await page.setViewportSize({ width: 375, height: 800 });
await page.waitForTimeout(300);
await page.screenshot({ path: `${outDir}/7-mobile-375.png` });

await browser.close();
console.log("Screenshots written to qa-artifacts/uipro/");
