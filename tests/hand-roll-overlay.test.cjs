"use strict";
/**
 * Hand-roll overlay — production sprites in assets/scenes (tests/fixtures/hand-roll for legacy stubs only).
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const http = require("node:http");
const fs = require("node:fs");
const { createGame, plain } = require("./helpers/game.cjs");
const fixtures = require("./fixtures/runs.cjs");

const ROOT = path.join(__dirname, "..");
const PROD_CLOSED = path.join(ROOT, "assets/scenes/hand-closed.png");
const PROD_OPEN = path.join(ROOT, "assets/scenes/hand-open.png");
const RUN_KEY = "gutterbones1977:run:v1";

let server;
let baseUrl;
let chromium;

before(async () => {
  chromium = require("playwright").chromium;
  assert.ok(fs.existsSync(PROD_CLOSED), "production hand-closed.png");
  assert.ok(fs.existsSync(PROD_OPEN), "production hand-open.png");
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

async function bootPlay(page) {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 90_000 });
  const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(fixtures.playStashOpen844()));
  await page.evaluate(
    ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
    { key: RUN_KEY, data: payload },
  );
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 90_000 });
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
  await page.waitForFunction(
    () => window.__GB_ROLL_HAND_SPRITES_READY === true,
    { timeout: 15_000 },
  );
}

test("hand overlay — production sprites enable sweep on eligible roll", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await bootPlay(page);
    await page.click('[data-tutorial="roll-btn"]');
    await page.waitForSelector('[data-layout-key="roll-hand-throw-overlay"] .animate-gutter-hand', {
      timeout: 3000,
    });
    const grip = await page.evaluate(() => {
      const closed = document.querySelector(".gutter-roll-hand-closed");
      const open = document.querySelector(".gutter-roll-hand-open");
      const overlay = document.querySelector(".gutter-roll-hand-overlay");
      if (!closed || !open || !overlay) return null;
      const cs = getComputedStyle(closed);
      const os = getComputedStyle(open);
      const pe = getComputedStyle(overlay).pointerEvents;
      return {
        closedOpacity: parseFloat(cs.opacity),
        openOpacity: parseFloat(os.opacity),
        pointerEvents: pe,
        ariaHidden: overlay.getAttribute("aria-hidden"),
      };
    });
    assert.ok(grip, "overlay mounted with production sprites");
    assert.equal(grip.pointerEvents, "none");
    assert.equal(grip.ariaHidden, "true");
    assert.ok(grip.closedOpacity >= 0.85, "closed visible at start");
    let sawVisible = false;
    for (let i = 0; i < 12; i += 1) {
      await page.waitForTimeout(40);
      const vis = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.sampleRollHandVisibility());
      if (vis?.ok) {
        sawVisible = true;
        break;
      }
    }
    assert.ok(sawVisible, "hand intersects viewport and stacks above playfield during sweep");
    let openDominant = false;
    for (const delay of [140, 170, 200, 230]) {
      await page.waitForTimeout(delay);
      const mid = await page.evaluate(() => {
        const closed = document.querySelector(".gutter-roll-hand-closed");
        const open = document.querySelector(".gutter-roll-hand-open");
        return {
          closedOpacity: closed ? parseFloat(getComputedStyle(closed).opacity) : -1,
          openOpacity: open ? parseFloat(getComputedStyle(open).opacity) : -1,
        };
      });
      if (mid.openOpacity > 0.55 && mid.openOpacity > mid.closedOpacity) {
        openDominant = true;
        break;
      }
    }
    assert.ok(openDominant, "open frame dominates after ~35% of handThrowSweep");
    await page.waitForTimeout(400);
    const gone = await page.locator('[data-layout-key="roll-hand-throw-overlay"] .animate-gutter-hand').count();
    assert.equal(gone, 0, "overlay cleans up after animation");
  } finally {
    await browser.close();
  }
});

test("hand overlay — repeat roll retriggers and roll button stays clickable", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await bootPlay(page);
    const passthrough = await page.evaluate(() => {
      const btn = document.querySelector('[data-tutorial="roll-btn"]');
      if (!btn) return false;
      const r = btn.getBoundingClientRect();
      const topEl = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return topEl === btn || btn.contains(topEl);
    });
    assert.equal(passthrough, true, "roll button receives pointer hit-test");
    await page.click('[data-tutorial="roll-btn"]');
    await page.waitForSelector('[data-layout-key="roll-hand-throw-overlay"]', { timeout: 3000 });
    await page.waitForTimeout(520);
    assert.equal(
      await page.locator('[data-layout-key="roll-hand-throw-overlay"] .animate-gutter-hand').count(),
      0,
      "first sweep cleaned up",
    );
    const canRollAgain = await page.$eval('[data-tutorial="roll-btn"]', (b) => !b.disabled);
    if (canRollAgain) {
      await page.click('[data-tutorial="roll-btn"]');
      await page.waitForSelector('[data-layout-key="roll-hand-throw-overlay"]', { timeout: 3000 });
      await page.waitForTimeout(520);
      assert.equal(await page.locator('[data-layout-key="roll-hand-throw-overlay"] .animate-gutter-hand').count(), 0);
    }
  } finally {
    await browser.close();
  }
});

test("hand overlay — reduced motion suppresses overlay", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 90_000 });
    await page.evaluate(() => {
      localStorage.setItem(
        "gutterbones1977:settings:v1",
        JSON.stringify({ reducedMotionPref: true }),
      );
    });
    const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(fixtures.playStashOpen844()));
    await page.evaluate(
      ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
      { key: RUN_KEY, data: payload },
    );
    await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 90_000 });
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
    await page.waitForFunction(() => window.__GB_ROLL_HAND_SPRITES_READY === true, { timeout: 15_000 });
    await page.click('[data-tutorial="roll-btn"]');
    await page.waitForTimeout(300);
    assert.equal(await page.locator('[data-layout-key="roll-hand-throw-overlay"]').count(), 0);
  } finally {
    await browser.close();
  }
});
