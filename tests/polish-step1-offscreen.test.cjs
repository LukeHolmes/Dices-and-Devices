"use strict";
/**
 * Polish step 1: carving exit, rap sheet footer, loss DISMISS / mechanic popover in viewport.
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const http = require("node:http");
const fs = require("node:fs");
const { createGame, plain } = require("./helpers/game.cjs");
const fixtures = require("./fixtures/runs.cjs");

const ROOT = path.join(__dirname, "..");
const RUN_KEY = "gutterbones1977:run:v1";

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

const POLISH_KEYS = [
  "carving-exit",
  "rap-play-again",
  "rap-sheet-history-more",
  "loss-explanation-dismiss",
  "mechanic-popover-hud",
];

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

for (const vp of VIEWPORTS) {
  test(`polish step1 — carving exit in viewport @ ${vp.name}`, async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
      await resumeFixture(page, fixtures.carving);
      await page.waitForTimeout(400);
      const m = await page.evaluate(() =>
        window.__GB_LAYOUT_AUDIT__.measureLayoutKeysInViewport(["carving-exit"]),
      );
      assert.ok(m.ok, JSON.stringify(m));
      assert.ok(m.bad.every((b) => b.top >= 0), JSON.stringify(m));
    } finally {
      await browser.close();
    }
  });

  test(`polish step1 — rap sheet footer controls @ ${vp.name}`, async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
      await resumeFixture(page, fixtures.rapSheetHistory8);
      await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.finishRapReveal());
      await page.waitForTimeout(450);
      const m = await page.evaluate(() =>
        window.__GB_LAYOUT_AUDIT__.measureLayoutKeysInViewport([
          "rap-play-again",
          "rap-sheet-history-more",
        ]),
      );
      assert.ok(m.ok, JSON.stringify(m));
    } finally {
      await browser.close();
    }
  });

  test(`polish step1 — loss DISMISS in viewport @ ${vp.name}`, async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
      await resumeFixture(page, fixtures.run);
      await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openLossExplanationDemo());
      await page.waitForTimeout(350);
      const m = await page.evaluate(() =>
        window.__GB_LAYOUT_AUDIT__.measureLayoutKeysInViewport(["loss-explanation-dismiss"]),
      );
      assert.ok(m.ok, JSON.stringify(m));
      assert.ok(
        (m.bad[0]?.left ?? 0) >= 0,
        `loss dismiss left edge: ${JSON.stringify(m)}`,
      );
    } finally {
      await browser.close();
    }
  });
}

test("source — polish step1 layout hooks present", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(html, /data-layout-key="rap-sheet-footer"/);
  assert.match(html, /data-layout-key="loss-explanation-dismiss"/);
  assert.match(html, /measureLayoutKeysInViewport/);
  for (const key of POLISH_KEYS) {
    assert.match(html, new RegExp(`data-layout-key="${key}"`));
  }
});
