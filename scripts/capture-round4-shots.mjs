#!/usr/bin/env node
/**
 * Capture Round 4 layout screenshots for PR evidence.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = "/opt/cursor/artifacts";
const require = createRequire(import.meta.url);
const { createGame, plain } = require("../tests/helpers/game.cjs");
const fixtures = require("../tests/fixtures/runs.cjs");

const RUN_KEY = "gutterbones1977:run:v1";

function startServer() {
  return new Promise((resolve) => {
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
    server.listen(0, "127.0.0.1", () => resolve({ server, baseUrl: `http://127.0.0.1:${server.address().port}` }));
  });
}

async function waitAudit(page) {
  await page.waitForSelector("#root-gutterbones", { timeout: 90_000 });
  await page.waitForFunction(
    () => {
      const root = document.getElementById("root-gutterbones");
      return root && root.innerText && !root.innerText.includes("LOADING");
    },
    { timeout: 90_000 },
  );
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 90_000 });
}

async function seedRun(page, builderName) {
  const builders = {
    normal: () => fixtures.run(),
    shopBusy: fixtures.shopBusy,
  };
  const g = createGame(fixtures.snapshot());
  const payload = plain(g.api.normalizeSavedRun(builders[builderName]()));
  await page.evaluate(
    ({ runKey, data }) => localStorage.setItem(runKey, JSON.stringify(data)),
    { runKey: RUN_KEY, data: payload },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitAudit(page);
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
  await page.waitForFunction(
    () => ["PLAY", "SHOP", "GAMBLE", "CARVING"].includes(window.__GB_LAYOUT_AUDIT__.getPhase()),
    { timeout: 30_000 },
  );
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const { server, baseUrl } = await startServer();
  const browser = await chromium.launch({ headless: true });

  try {
    {
      const page = await browser.newPage();
      await page.setViewportSize({ width: 1366, height: 768 });
      await page.goto(`${baseUrl}/index.html?layoutAudit=1&pacing=fast`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      await waitAudit(page);
      await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openRoundClear());
      await page.waitForSelector('[data-layout-key="round-clear-continue"]', { timeout: 15_000 });
      await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__.getState().roundClearCanContinue, { timeout: 15_000 });
      await page.screenshot({ path: path.join(OUT, "round-clear-1366x768.png"), fullPage: false });
      await page.close();
    }

    {
      const page = await browser.newPage();
      await page.setViewportSize({ width: 844, height: 390 });
      await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      await waitAudit(page);
      await seedRun(page, "normal");
      const dockVisible = await page.locator(".gb-play-dock").isVisible().catch(() => false);
      if (dockVisible) {
        await page.locator(".gb-play-dock button", { hasText: "PAYOUTS" }).click();
      }
      await page.waitForSelector('[data-tutorial="payout-sheet"]', { state: "visible", timeout: 15_000 });
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT, "payout-844x390.png"), fullPage: false });
      await page.close();
    }

    {
      const page = await browser.newPage();
      await page.setViewportSize({ width: 1366, height: 768 });
      await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      await waitAudit(page);
      await seedRun(page, "normal");
      await page.waitForSelector('[data-tutorial="payout-sheet"]', { state: "visible", timeout: 10_000 });
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT, "payout-1366x768.png"), fullPage: false });
      await page.close();
    }

    {
      const page = await browser.newPage();
      await page.setViewportSize({ width: 360, height: 640 });
      await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      await waitAudit(page);
      await seedRun(page, "shopBusy");
      await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__.getPhase() === "SHOP", { timeout: 20_000 });
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(OUT, "shop-360x640.png"), fullPage: false });
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log("Screenshots written to", OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
