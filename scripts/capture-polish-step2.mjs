#!/usr/bin/env node
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
const outDir = process.argv[2] || path.join("/opt/cursor/artifacts/polish-step2/after");

const VP = { name: "844x390", width: 844, height: 390 };

fs.mkdirSync(outDir, { recursive: true });

const PORT = 8799;
const server = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 700));
const base = `http://127.0.0.1:${PORT}`;

async function resume(page, builder) {
  const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(builder()));
  await page.evaluate(
    ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
    { key: RUN_KEY, data: payload },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: VP.width, height: VP.height });
await page.goto(`${base}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });

await resume(page, fixtures.playRaidRound9);
await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openBossIntroFor("THE_RAID"));
await page.waitForSelector('[data-layout-key="boss-intro-continue"]', { timeout: 8000 });
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(outDir, `raid-intro-${VP.name}.png`) });

await page.goto(`${base}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
await resume(page, fixtures.playHeavyHardware);
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(outDir, `payout-list-${VP.name}.png`) });

await page.goto(`${base}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
await resume(page, fixtures.shopLandscape161);
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(outDir, `shop-${VP.name}.png`) });

await browser.close();
server.kill();
