#!/usr/bin/env node
/** Release-apex frames with production hand sprites at blocking viewports. */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const fixtures = require("../tests/fixtures/runs.cjs");
const { createGame, plain } = require("../tests/helpers/game.cjs");

const ROOT = path.resolve(import.meta.dirname, "..");
const VPs = [
  { tag: "768x1024", width: 768, height: 1024 },
  { tag: "1024x768", width: 1024, height: 768 },
  { tag: "1366x768", width: 1366, height: 768 },
  { tag: "1920x1080", width: 1920, height: 1080 },
];

const PORT = 8816;
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], {
  cwd: ROOT,
  stdio: "ignore",
});
await new Promise((r) => setTimeout(r, 500));
const base = `http://127.0.0.1:${PORT}`;

async function bootPlay(page, vp) {
  await page.setViewportSize(vp);
  await page.goto(`${base}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 90_000 });
  const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(fixtures.playStashOpen844()));
  await page.evaluate(
    ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
    { key: "gutterbones1977:run:v1", data: payload },
  );
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 90_000 });
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
  await page.waitForFunction(() => window.__GB_ROLL_HAND_SPRITES_READY === true, { timeout: 20_000 });
}

const browser = await chromium.launch({ headless: true });
for (const vp of VPs) {
  const page = await browser.newPage();
  await bootPlay(page, { width: vp.width, height: vp.height });
  await page.waitForTimeout(350);
  await page.click('[data-tutorial="roll-btn"]');
  await page.waitForSelector('[data-layout-key="roll-hand-throw-overlay"]', { timeout: 5000 });
  await page.waitForTimeout(175);
  const out = `/opt/cursor/artifacts/ui-redesign-hand-roll-apex-${vp.tag}.png`;
  await page.screenshot({ path: out, fullPage: false });
  console.log("saved", out);
  await page.close();
}

const ctx = await browser.newContext({
  viewport: { width: 768, height: 1024 },
  recordVideo: { dir: "/opt/cursor/artifacts", size: { width: 768, height: 1024 } },
});
const vpage = await ctx.newPage();
await bootPlay(vpage, { width: 768, height: 1024 });
await vpage.waitForTimeout(300);
await vpage.click('[data-tutorial="roll-btn"]');
await vpage.waitForTimeout(600);
await vpage.click('[data-tutorial="roll-btn"]').catch(() => {});
await vpage.waitForTimeout(700);
const vid = vpage.video();
await vpage.close();
const demoOut = "/opt/cursor/artifacts/ui-redesign-hand-roll-production-demo.webm";
if (vid) await vid.saveAs(demoOut);
await ctx.close();
await browser.close();
server.kill();
console.log("demo", demoOut);
