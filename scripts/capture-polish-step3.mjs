#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createGame, plain } = require("../tests/helpers/game.cjs");
const fixtures = require("../tests/fixtures/runs.cjs");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = "/opt/cursor/artifacts/polish-step3";
const RUN_KEY = "gutterbones1977:run:v1";

fs.mkdirSync(OUT, { recursive: true });

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
  const types = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png" };
  res.setHeader("Content-Type", types[ext] || "application/octet-stream");
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;

async function resumeFixture(page, builder) {
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
await page.setViewportSize({ width: 844, height: 390 });

await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
await resumeFixture(page, fixtures.playStashOpen844);
await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openPlayStashPanel());
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT, "stash-844x390-after.png"), fullPage: false });

await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
await resumeFixture(page, fixtures.playHeavyHardware);
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(OUT, "play-text-readability-844x390.png"), fullPage: false });

await browser.close();
server.close();

console.log(`Saved screenshots under ${OUT}`);
