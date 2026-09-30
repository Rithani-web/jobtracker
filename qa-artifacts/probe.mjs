// One-off probe: what actually happens on / after login?
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

mkdirSync("qa-artifacts/shots", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("response", (r) => {
  const u = r.url();
  if (u.startsWith("http://localhost:3100") && !u.includes("_next"))
    console.log(`RESP ${r.status()} ${u.slice(0, 100)}`);
});
page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 300)));

await page.goto("http://localhost:3100/login", { waitUntil: "domcontentloaded" });
await page.fill("#email", "user1@seed.jobtracker.test");
await page.fill("#password", "Password123!");
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL("http://localhost:3100/", { timeout: 20000 });
console.log("on / at", new Date().toISOString());

const t0 = Date.now();
try {
  await page
    .getByRole("heading", { name: "Dashboard" })
    .waitFor({ timeout: 30000 });
  console.log(`HEADING APPEARED after ${Date.now() - t0}ms`);
} catch {
  console.log(`HEADING NEVER APPEARED (${Date.now() - t0}ms)`);
}
const html = await page.content();
console.log("TITLE:", await page.title());
console.log(
  "BODY SNIPPET:",
  html.replace(/<script[\s\S]*?<\/script>/g, "").slice(0, 600).replace(/\s+/g, " "),
);
await page.screenshot({
  path: "qa-artifacts/shots/probe-dashboard.png",
  fullPage: false,
});
await browser.close();
