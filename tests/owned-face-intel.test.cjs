"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const { createGame, plain } = require("./helpers/game.cjs");
const fixtures = require("./fixtures/runs.cjs");

const ROOT = path.join(__dirname, "..");
const RUN_KEY = "gutterbones1977:run:v1";
const SETTINGS_KEY = "gutterbones1977:settings:v1";

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

test("owned Blood 6 — die ? affordance and intel panel", async () => {
  const payload = plain(
    createGame(fixtures.snapshot()).api.normalizeSavedRun(plain(fixtures.playBlood6Carved())),
  );
  assert.equal(payload?.dice?.[0]?.faceId, "BLOOD_6");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 768, height: 1024 } });
  try {
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 90_000 });
    await page.waitForFunction(
      () => typeof window.GutterbonesIntel !== "undefined" && window.GutterbonesIntel.hasUpgradeIntel("BLOOD_6"),
      { timeout: 90_000 },
    );
    await page.evaluate(
      ({ key, data, settingsKey }) => {
        localStorage.setItem(key, JSON.stringify(data));
        localStorage.setItem(
          settingsKey,
          JSON.stringify({ tutorialCompleted: true, skippedAlleyIntro: true, reducedMotionPref: true }),
        );
      },
      { key: RUN_KEY, data: payload, settingsKey: SETTINGS_KEY },
    );
    await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 90_000 });
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
    await page.waitForFunction(
      () => document.getElementById("root-gutterbones")?.getAttribute("data-phase") === "PLAY",
      { timeout: 60_000 },
    );
  const btn = page.locator('[data-layout-key="bone-face-intel-1"]');
    await btn.waitFor({ timeout: 15_000 });
    const aria = await btn.getAttribute("aria-label");
    assert.match(aria || "", /Blood 6/i);
    const opened = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openUpgradeIntel("BLOOD_6"));
    assert.equal(opened, true);
    await page.waitForSelector('[data-layout-key="upgrade-intel-panel"]', { timeout: 8000 });
    const title = await page.locator("#upgrade-intel-title").innerText();
    assert.match(title, /Blood 6/i);
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () => !document.querySelector('[data-layout-key="upgrade-intel-panel"]'),
      { timeout: 8000 },
    );
    await btn.evaluate((el) => el.click());
    await page.waitForSelector('[data-layout-key="upgrade-intel-panel"]', { timeout: 8000 });
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () => !document.querySelector('[data-layout-key="upgrade-intel-panel"]'),
      { timeout: 8000 },
    );
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("data-layout-key"));
    assert.equal(focused, "bone-face-intel-1", `focus after bone intel: ${focused}`);
  } finally {
    await browser.close();
  }
});
