#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { chromium } from "playwright";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ROOT = "/workspace";
const OUT = "/opt/cursor/artifacts/polish-step4";
const RUN_KEY = "gutterbones1977:run:v1";
const fixtures = require(path.join(ROOT, "tests/fixtures/runs.cjs"));
const { createGame, plain } = require(path.join(ROOT, "tests/helpers/game.cjs"));

fs.mkdirSync(OUT, { recursive: true });

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const rel = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.join(ROOT, rel.replace(/^\//, ""));
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath)) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }
  res.setHeader("Content-Type", "text/html");
  fs.createReadStream(filePath).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const baseUrl = `http://127.0.0.1:${server.address().port}`;

async function resume(page, builder) {
  const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(builder()));
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), {
    key: RUN_KEY,
    data: payload,
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45000 });
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
}

const shots = [
  { name: "844-score-breakdown", w: 844, h: 390, fn: async (p) => {
    await resume(p, fixtures.playStashOpen844);
    await p.evaluate(() => window.__GB_LAYOUT_AUDIT__.openScoreBreakdownDemo());
    await p.waitForTimeout(500);
  }},
  { name: "844-shop-tutorial", w: 844, h: 390, fn: async (p) => {
    await resume(p, fixtures.shop);
    await p.evaluate(() => window.__GB_LAYOUT_AUDIT__.openTutorialCoachShop());
    await p.waitForTimeout(500);
  }},
  { name: "1366-run-intel", w: 1366, h: 768, fn: async (p) => {
    await resume(p, fixtures.playHeavyHardware);
    await p.waitForTimeout(400);
  }},
  { name: "844-stuck-recovery", w: 844, h: 390, fn: async (p) => {
    await resume(p, fixtures.playStashOpen844);
    await p.evaluate(() => window.__GB_LAYOUT_AUDIT__.triggerStuckRecoveryDemo());
    await p.waitForTimeout(400);
  }},
];

const browser = await chromium.launch();
for (const s of shots) {
  const page = await browser.newPage();
  await page.setViewportSize({ width: s.w, height: s.h });
  await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45000 });
  await s.fn(page);
  await page.screenshot({ path: path.join(OUT, `${s.name}.png`), fullPage: false });
  await page.close();
}
await browser.close();
server.close();
console.log("Saved screenshots to", OUT);
