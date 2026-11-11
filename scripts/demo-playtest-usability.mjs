#!/usr/bin/env node
import path from "node:path";
import fs from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const { createGame, plain } = require("../tests/helpers/game.cjs");
const fixtures = require("../tests/fixtures/runs.cjs");

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = "/opt/cursor/artifacts/playtest-usability-normal-speed.webm";
const RUN_KEY = "gutterbones1977:run:v1";

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const rel = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.join(ROOT, rel.replace(/^\//, ""));
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }
  const ext = path.extname(filePath);
  const types = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".cjs": "text/javascript" };
  res.setHeader("Content-Type", types[ext] || "application/octet-stream");
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 768, height: 1024 },
  recordVideo: { dir: path.dirname(OUT), size: { width: 768, height: 1024 } },
});
const page = await context.newPage();
await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded", timeout: 120_000 });
await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 120_000 });
await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openUpgradeIntel("BLOOD_6"));
await page.waitForSelector('[data-layout-key="upgrade-intel-panel"]');
await page.waitForTimeout(2800);
await page.keyboard.press("Escape");
await page.waitForTimeout(500);
const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(fixtures.playStashOpen844()));
await page.evaluate(
  ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
  { key: RUN_KEY, data: payload },
);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 120_000 });
await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
await page.waitForFunction(() => window.__GB_ROLL_HAND_SPRITES_READY === true, { timeout: 20_000 });
await page.click('[data-tutorial="roll-btn"]');
await page.waitForSelector('[data-layout-key="roll-hand-throw-overlay"]', { timeout: 5000 });
const handMs = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.getRollHandFxMs());
await page.waitForTimeout(handMs + 350);
await page.waitForTimeout(800);
const video = page.video();
await context.close();
await browser.close();
server.close();
if (video) {
  const src = await video.path();
  fs.copyFileSync(src, OUT);
  console.log(`Wrote ${OUT} (handMs=${handMs})`);
}
