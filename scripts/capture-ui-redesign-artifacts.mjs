#!/usr/bin/env node
/**
 * Capture UI redesign before/after-style screenshots for draft PR evidence.
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const fixtures = require("../tests/fixtures/runs.cjs");
const { createGame, plain } = require("../tests/helpers/game.cjs");

const ROOT = path.resolve(import.meta.dirname, "..");
const RUN_KEY = "gutterbones1977:run:v1";
const outDir = process.argv[2] || "/opt/cursor/artifacts/ui-redesign";

fs.mkdirSync(outDir, { recursive: true });

const PORT = 8808;
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], {
  cwd: ROOT,
  stdio: "ignore",
});
await new Promise((r) => setTimeout(r, 600));
const base = `http://127.0.0.1:${PORT}`;

async function loadPlay(page, builder, vp) {
  await page.setViewportSize(vp);
  await page.goto(`${base}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
  const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(builder()));
  await page.evaluate(
    ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
    { key: RUN_KEY, data: payload },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
  await page.waitForTimeout(600);
}

const browser = await chromium.launch({ headless: true });
const vpTablet = { width: 768, height: 1024 };
const vpDesk = { width: 1920, height: 1080 };

const page = await browser.newPage();
await loadPlay(page, fixtures.playStashOpen844, vpTablet);
await page.screenshot({ path: path.join(outDir, "play-tablet-768x1024-street-ledger.png"), fullPage: false });

await page.click('[data-tutorial="roll-btn"]').catch(() => {});
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(outDir, "play-tablet-after-roll.png"), fullPage: false });

const payoutRow = await page.$('button[data-payout-row]:not([disabled])');
if (payoutRow) {
  await payoutRow.hover();
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(outDir, "play-payout-receipt-hover.png"), fullPage: false });
}

await page.click('[data-layout-key="play-history-log"]').catch(() => {});
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(outDir, "play-history-drawer.png"), fullPage: false });
await page.click('[data-layout-key="play-history-close"]').catch(() => {});

await loadPlay(page, fixtures.shopBusy, vpDesk);
await page.waitForSelector('[data-layout-key="shop-layout"]', { timeout: 12_000 });
await page.screenshot({ path: path.join(outDir, "shop-counting-cash-1920.png"), fullPage: false });

try {
  const carvePayload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(fixtures.carving()));
  await page.evaluate(
    ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
    { key: RUN_KEY, data: carvePayload },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
  await page.waitForTimeout(800);
  if (await page.$('[data-layout-key="carving-layout"]')) {
    await page.screenshot({ path: path.join(outDir, "carving-mod-bench.png"), fullPage: false });
  }
} catch (err) {
  console.warn("carving capture skipped:", err.message);
}

await page.close();
await browser.close();
server.kill();
console.log("Saved UI redesign shots to", outDir);
