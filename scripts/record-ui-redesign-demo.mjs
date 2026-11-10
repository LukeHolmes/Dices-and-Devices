#!/usr/bin/env node
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const fixtures = require("../tests/fixtures/runs.cjs");
const { createGame, plain } = require("../tests/helpers/game.cjs");

const ROOT = path.resolve(import.meta.dirname, "..");
const out = "/opt/cursor/artifacts/ui-redesign/ui-redesign-demo.webm";
const PORT = 8810;
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 600));

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 768, height: 1024 },
  recordVideo: { dir: path.dirname(out), size: { width: 768, height: 1024 } },
});
const page = await context.newPage();
await page.goto(`http://127.0.0.1:${PORT}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(fixtures.playStashOpen844()));
await page.evaluate(
  ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
  { key: "gutterbones1977:run:v1", data: payload },
);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
await page.waitForTimeout(1000);
await page.click('[data-layout-key="play-history-log"]');
await page.waitForTimeout(900);
await page.click('[data-layout-key="play-history-close"]');
await page.waitForTimeout(500);
const row = await page.$("button[data-payout-row]:not([disabled])");
if (row) {
  await row.hover();
  await page.waitForTimeout(1000);
}
const vid = page.video();
await page.close();
if (vid) await vid.saveAs(out);
await context.close();
await browser.close();
server.kill();
console.log("saved", out);
