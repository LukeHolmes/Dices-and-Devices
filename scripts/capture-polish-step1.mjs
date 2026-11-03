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
const outDir = process.argv[2] || path.join("/opt/cursor/artifacts/polish-step1/after");

const VIEWPORTS = [
  { name: "360x640", width: 360, height: 640 },
  { name: "390x844", width: 390, height: 844 },
  { name: "412x915", width: 412, height: 915 },
  { name: "844x390", width: 844, height: 390 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1920x1080", width: 1920, height: 1080 },
];

fs.mkdirSync(outDir, { recursive: true });

const PORT = 8799;
const server = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 700));
const base = `http://127.0.0.1:${PORT}`;

const browser = await chromium.launch({ headless: true });
for (const vp of VIEWPORTS) {
  for (const [id, builder, afterResume] of [
    ["carving", fixtures.carving, null],
    ["rap_sheet", fixtures.rapSheetHistory8, async (page) => {
      await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.finishRapReveal());
      await page.waitForTimeout(400);
    }],
  ]) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: vp.width, height: vp.height });
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
    await page.waitForTimeout(500);
    if (afterResume) await afterResume(page);
    await page.screenshot({ path: path.join(outDir, `${id}-${vp.name}.png`) });
    await page.close();
  }
}
await browser.close();
server.kill();
