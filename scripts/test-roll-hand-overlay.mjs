#!/usr/bin/env node
/**
 * Roll-hand overlay: missing assets (graceful), eligible roll, disabled roll, reduced-motion.
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import path from "node:path";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const fixtures = require("../tests/fixtures/runs.cjs");
const { createGame, plain } = require("../tests/helpers/game.cjs");
const vps = [
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
];

const ROOT = path.resolve(import.meta.dirname, "..");
const outDir = "/opt/cursor/artifacts/ui-redesign/hand-roll";
const PORT = 8812;
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 600));
const base = `http://127.0.0.1:${PORT}`;

async function bootPlay(page, vp) {
  await page.setViewportSize(vp);
  await page.goto(`${base}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
  const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(fixtures.playStashOpen844()));
  await page.evaluate(
    ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
    { key: "gutterbones1977:run:v1", data: payload },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
  await page.waitForSelector('[data-tutorial="roll-btn"]', { timeout: 12_000 });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await bootPlay(page, vps[0]);

const spritesReady = await page.evaluate(() => window.__GB_ROLL_HAND_SPRITES_READY);
console.log("spritesReady", spritesReady);
assert.equal(spritesReady, false, "expected missing hand sprites");

await page.click('[data-tutorial="roll-btn"]');
await page.waitForTimeout(220);
let overlayCount = await page.locator('[data-layout-key="roll-hand-throw-overlay"]').count();
assert.equal(overlayCount, 0, "overlay absent when sprites missing");

await page.click('[data-tutorial="roll-btn"]').catch(() => {});
await page.waitForTimeout(200);
overlayCount = await page.locator('[data-layout-key="roll-hand-throw-overlay"]').count();
assert.equal(overlayCount, 0);

await page.evaluate(() => {
  localStorage.setItem(
    "gutterbones1977:settings:v1",
    JSON.stringify({ reducedMotionPref: true }),
  );
});
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
await page.waitForSelector('[data-tutorial="roll-btn"]');
const reduceOn = await page.evaluate(() => document.getElementById("root-gutterbones")?.classList.contains("gb-motion-reduce"));
assert.equal(reduceOn, true, "reduced motion class applied");
await page.click('[data-tutorial="roll-btn"]');
await page.waitForTimeout(200);
overlayCount = await page.locator('[data-layout-key="roll-hand-throw-overlay"]').count();
assert.equal(overlayCount, 0, "no overlay under reduced motion");

for (const vp of vps) {
  await bootPlay(page, vp);
  const oob = await page.evaluate(() => {
    const btn = document.querySelector('[data-tutorial="roll-btn"]');
    if (!btn) return true;
    const r = btn.getBoundingClientRect();
    return r.bottom > window.innerHeight + 1 || r.top < -1;
  });
  assert.equal(oob, false, `roll btn in viewport ${vp.width}x${vp.height}`);
}

await page.screenshot({ path: path.join(outDir, "roll-hand-absent-768x1024.png"), fullPage: false });
console.log("roll-hand overlay tests OK");
await page.close();
await browser.close();
server.kill();
