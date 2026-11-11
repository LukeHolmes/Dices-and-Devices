#!/usr/bin/env node
/** Fixture-sprite apex frame (~release); not production art. */
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const fixtures = require("../tests/fixtures/runs.cjs");
const { createGame, plain } = require("../tests/helpers/game.cjs");

const ROOT = path.resolve(import.meta.dirname, "..");
const FIXTURE_CLOSED = path.join(ROOT, "tests/fixtures/hand-roll/hand-closed.png");
const FIXTURE_OPEN = path.join(ROOT, "tests/fixtures/hand-roll/hand-open.png");
const outPng = "/opt/cursor/artifacts/ui-redesign-hand-roll-apex-fixture.png";
const outWebm = "/opt/cursor/artifacts/ui-redesign-hand-roll-fixture-demo.webm";

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/assets/scenes/hand-closed.png") {
    res.setHeader("Content-Type", "image/png");
    fs.createReadStream(FIXTURE_CLOSED).pipe(res);
    return;
  }
  if (urlPath === "/assets/scenes/hand-open.png") {
    res.setHeader("Content-Type", "image/png");
    fs.createReadStream(FIXTURE_OPEN).pipe(res);
    return;
  }
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
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 768, height: 1024 },
  recordVideo: { dir: path.dirname(outWebm), size: { width: 768, height: 1024 } },
});
const page = await context.newPage();
await page.goto(`${base}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 90_000 });
const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(fixtures.playStashOpen844()));
await page.evaluate(
  ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
  { key: "gutterbones1977:run:v1", data: payload },
);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 90_000 });
await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
await page.waitForFunction(() => window.__GB_ROLL_HAND_SPRITES_READY === true, { timeout: 15_000 });
await page.waitForTimeout(400);
const rollPromise = page.click('[data-tutorial="roll-btn"]');
await rollPromise;
await page.waitForSelector('[data-layout-key="roll-hand-throw-overlay"]', { timeout: 5000 });
await page.waitForTimeout(175);
await page.screenshot({ path: outPng, fullPage: false });
await page.waitForTimeout(500);
const vid = page.video();
await page.close();
if (vid) await vid.saveAs(outWebm);
await context.close();
await browser.close();
server.close();
console.log("saved", outPng, outWebm);
