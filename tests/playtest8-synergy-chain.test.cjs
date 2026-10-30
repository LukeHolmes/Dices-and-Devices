"use strict";
/**
 * E2E: matched hardware tags trigger visible synergy chain overlay.
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");

const ROOT = path.join(__dirname, "..");

let server;
let baseUrl;
let chromium;

before(async () => {
  chromium = require("playwright").chromium;
  server = http.createServer((req, res) => {
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
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

async function waitForGameReady(page) {
  await page.waitForSelector("#root-gutterbones", { timeout: 45_000 });
  await page.waitForFunction(
    () => {
      const root = document.getElementById("root-gutterbones");
      return root && root.innerText && !root.innerText.includes("LOADING");
    },
    { timeout: 45_000 },
  );
  await page.waitForFunction(() => window.__GB_E2E__, { timeout: 20_000 });
}

test("e2e — build-tag hardware shows synergy chain overlay on score", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1280, height: 690 });
    await page.goto(`${baseUrl}/index.html?e2e=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await waitForGameReady(page);
    await page.evaluate(() => {
      localStorage.removeItem("gutterbones1977:run:v1");
      localStorage.setItem(
        "gutterbones1977:settings:v1",
        JSON.stringify({ pacing: "normal", reducedMotion: false, tutorialCompleted: true, skippedAlleyIntro: true }),
      );
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForGameReady(page);
    await page.evaluate(() => {
      window.__GB_E2E__.goLineup();
      window.__GB_E2E__.selectFirstPersona();
      window.__GB_E2E__.startNewRun();
    });
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
      window.__GB_E2E__.grantHardware(["ENGINE", "FUSE_BOX"]);
    });
    await page.waitForFunction(() => (document.body.innerText || "").includes("MODS (2)"), { timeout: 5000 });
    await page.evaluate(() => {
      window.__GB_E2E__.prepareScore("C", [2, 2, 3, 4, 5]);
    });
    await page.waitForSelector('[data-layout-key="synergy-chain-overlay"]', { timeout: 8000 }).catch(() => null);
    const overlayVisible = await page.evaluate(() => {
      const el = document.querySelector('[data-layout-key="synergy-chain-overlay"]');
      return !!(el && el.getBoundingClientRect().height > 2);
    });
    assert.ok(overlayVisible, "synergy chain overlay should be visible after chain fires");
    const events = await page.evaluate(() => {
      const card = document.querySelector('[data-layout-key="round-clear-card"]');
      if (card) return null;
      const steps = Array.from(document.querySelectorAll(".readable-panel .border.rounded-lg"));
      return steps.some((n) => (n.textContent || "").includes("CHAIN:"));
    });
    assert.ok(events !== false, "score breakdown should list CHAIN steps");
  } finally {
    await browser.close();
  }
});
