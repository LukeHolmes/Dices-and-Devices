import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const { createGame, plain } = require("../tests/helpers/game.cjs");
const fixtures = require("../tests/fixtures/runs.cjs");

const ROOT = path.dirname(fileURLToPath(new URL("../", import.meta.url)));
const OUT = "/opt/cursor/artifacts";
const RUN_KEY = "gutterbones1977:run:v1";
const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(fixtures.shopBusy()));

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

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });

async function shot(name, width, height, fn) {
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);
  page.on("pageerror", (e) => console.error(`[${name}]`, e.message));
  await page.setViewportSize({ width, height });
  await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 90000 });
  await fn(page);
  await page.screenshot({ path: path.join(OUT, name), fullPage: false });
  await page.close();
}

await shot("shop-844x390.png", 844, 390, async (page) => {
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), {
    key: RUN_KEY,
    data: payload,
  });
  await page.reload({ waitUntil: "networkidle", timeout: 90000 });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 90000 });
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
  await page.waitForSelector('[data-layout-key="shop-routes-panel"]', { timeout: 12000 });
  await page.waitForTimeout(800);
});

await shot("shop-360x640.png", 360, 640, async (page) => {
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), {
    key: RUN_KEY,
    data: payload,
  });
  await page.reload({ waitUntil: "networkidle", timeout: 90000 });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 90000 });
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
  await page.waitForSelector('[data-layout-key="shop-routes-panel"]', { timeout: 12000 });
  await page.waitForTimeout(800);
});

await shot("payout-1024x768.png", 1024, 768, async (page) => {
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.seedPlayIntelState({ round: 1, hands: 4, hasRolled: true }));
  await page.waitForSelector('[data-tutorial="payout-sheet"]', { timeout: 12000 });
  await page.waitForTimeout(600);
});

await browser.close();
await new Promise((r) => server.close(r));
