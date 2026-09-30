import { chromium } from "playwright";

const BASE = "http://localhost:5173";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(BASE, { waitUntil: "networkidle" });

const probe = async (label) => {
  const data = await page.evaluate(() => {
    const pick = (sel, prop) => {
      const el = document.querySelector(sel);
      return el ? getComputedStyle(el)[prop] : "MISSING";
    };
    return {
      htmlClasses: document.documentElement.className,
      h1Color: pick("h1", "color"),
      h1ClassList: document.querySelector("h1")?.className ?? "MISSING",
      toggleBg: pick('button[aria-label="Toggle dark mode"]', "backgroundColor"),
      toggleColor: pick('button[aria-label="Toggle dark mode"]', "color"),
      allChipColor: pick('button[aria-pressed="true"]', "color"),
      bodyBg: getComputedStyle(document.body).backgroundColor,
      bodyColor: getComputedStyle(document.body).color,
      cardBg: pick("article", "backgroundColor"),
    };
  });
  console.log(`--- ${label} ---`);
  for (const [k, v] of Object.entries(data)) console.log(`${k}: ${v}`);
};

await probe("initial (light expected)");
await page.getByRole("button", { name: "Toggle dark mode" }).click();
await page.waitForTimeout(200);
await probe("after toggle (dark expected)");

await browser.close();
