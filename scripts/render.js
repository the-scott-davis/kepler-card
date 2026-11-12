// Renders README screenshots into docs/ from the preview page. Run: npm run render
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = resolve(join(dirname(fileURLToPath(import.meta.url)), ".."));
const port = 4179;
const base = "http://127.0.0.1:" + port;
const SHOTS = [
  { sample: "home", file: "full.png", theme: false },
  { sample: "home", file: "themed.png", theme: true },
  { sample: "basic", file: "basic.png", theme: false },
  { sample: "deep", file: "deep.png", theme: false },
];

async function waitFor(url) {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch (e) { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("preview server did not start");
}

const server = spawn(process.execPath, [join(root, "scripts/preview.js")], { env: { ...process.env, PORT: String(port) }, stdio: "ignore" });
let browser;
try {
  await waitFor(base + "/preview/index.html");
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 }, deviceScaleFactor: 2 });
  await page.goto(base + "/preview/index.html");
  await page.waitForSelector("kepler-card");
  await page.fill("#title", "Kepler");
  for (const s of SHOTS) {
    await page.selectOption("#sample", s.sample);
    await page.setChecked("#theme", s.theme);
    await page.waitForTimeout(2500); // let the reveal animation finish
    await page.locator("kepler-card").screenshot({ path: join(root, "docs", s.file) });
    console.log("wrote docs/" + s.file);
  }
} finally {
  if (browser) await browser.close();
  server.kill();
}
