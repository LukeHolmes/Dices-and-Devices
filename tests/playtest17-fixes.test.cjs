"use strict";
/**
 * Playtest 17: rap sheet forfeit, intel/shop save, round-clear input, payout timing, meta runs count.
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const { createGame, plain } = require("./helpers/game.cjs");
const fixtures = require("./fixtures/runs.cjs");

const ROOT = path.join(__dirname, "..");
const RUN_KEY = "gutterbones1977:run:v1";
const META_KEY = "gutterbones1977:meta:v1";

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

test("source — playtest 17 hooks present", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(html, /rapSheetSkipRevealGateRef/);
  assert.match(html, /selectedShopPathId/);
  assert.match(html, /run-intel-compact-loadout/);
  assert.match(html, /dismissScoreOverlays\(true\)/);
  assert.match(html, /postRollReveal=\{false\}/);
  assert.match(html, /rap-busted-backdrop--flat/);
});

test("rules — serialize and normalize shop route selection", () => {
  const g = createGame(fixtures.snapshot({ phase: "SHOP", selectedShopPathId: "LOCAL" }));
  const raw = plain(g.api.serializeRun("SHOP"));
  assert.equal(raw.selectedShopPathId, "LOCAL");
  const normalized = g.api.normalizeSavedRun({ ...raw, selectedShopPathId: "PAWN" });
  assert.equal(normalized.selectedShopPathId, "PAWN");
});

test("rules — merge meta clamps totalRuns on load", () => {
  const g = createGame(fixtures.snapshot());
  g.api.updateMeta(() => ({
    totalRuns: -1,
    completedRuns: -3,
    launderedCash: -5,
    bestHeat: -1,
  }));
  const meta = g.state("meta");
  assert.equal(meta.totalRuns, 0);
  assert.equal(meta.completedRuns, 0);
  assert.equal(meta.launderedCash, 0);
  assert.equal(meta.bestHeat, 0);
});

const VIEWPORTS = [
  { name: "1280x690", width: 1280, height: 690 },
  { name: "390x844", width: 390, height: 844 },
  { name: "844x390", width: 844, height: 390 },
];

for (const vp of VIEWPORTS) {
  test(`e2e — forfeit rap sheet PLAY AGAIN clickable @ ${vp.name}`, async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
      await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openForfeitRapSheetDemo());
      await page.waitForSelector('[data-layout-key="rap-sheet"]', { timeout: 12_000 });
      await page.waitForTimeout(600);
      const playBtn = page.locator('[data-layout-key="rap-sheet"] button', { hasText: "PLAY AGAIN" });
      await playBtn.waitFor({ state: "visible", timeout: 8000 });
      const metrics = await page.evaluate(() => {
        const gate = document.querySelector('[data-layout-key="rap-reveal-gate"]');
        const sheet = document.querySelector('[data-layout-key="rap-sheet-wrap"]') || document.querySelector('[data-layout-key="rap-sheet"]');
        const btn = document.querySelector('[data-layout-key="rap-play-again"]');
        const body = sheet?.querySelector(".gb-modal-body");
        const btnRect = btn?.getBoundingClientRect();
        const vh = window.innerHeight;
        const bodyStyle = body ? getComputedStyle(body) : null;
        const scaled = sheet?.dataset?.rapScale;
        return {
          ok:
            !gate &&
            !!btn &&
            btnRect &&
            btnRect.top >= 0 &&
            btnRect.bottom <= vh + 2 &&
            bodyStyle?.overflowY !== "auto",
          scaled,
          gate: !!gate,
          btnBottom: btnRect?.bottom,
          vh,
          overflowY: bodyStyle?.overflowY,
        };
      });
      assert.ok(metrics.ok, JSON.stringify(metrics));
      await playBtn.click({ timeout: 5000 });
      await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__.getPhase() === "LINEUP", { timeout: 8000 });
    } finally {
      await browser.close();
    }
  });
}

test("e2e — round clear card click advances", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1280, height: 690 });
    await page.goto(`${baseUrl}/index.html?layoutAudit=1&pacing=fast`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openRoundClear());
    await page.waitForSelector('[data-layout-key="round-clear-card"]', { timeout: 8000 });
    await page.waitForFunction(
      () => window.__GB_LAYOUT_AUDIT__.getState().roundClearCanContinue,
      { timeout: 12_000 },
    );
    await page.locator('[data-layout-key="round-clear-card"]').click({ position: { x: 40, y: 40 } });
    await page.waitForFunction(() => !window.__GB_LAYOUT_AUDIT__.isRoundClearVisible(), { timeout: 8000 });
  } finally {
    await browser.close();
  }
});

test("e2e — resume shop keeps selected route after reload", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1280, height: 690 });
    const payload = plain(
      createGame(fixtures.snapshot()).api.normalizeSavedRun(fixtures.shopBusy()),
    );
    payload.phase = "SHOP";
    payload.selectedShopPathId = "PAWN";
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ({ runKey, data }) => localStorage.setItem(runKey, JSON.stringify(data)),
      { runKey: RUN_KEY, data: payload },
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__.getPhase() === "SHOP", { timeout: 12_000 });
    const route = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.getState().selectedShopPathId);
    assert.equal(route, "PAWN");
  } finally {
    await browser.close();
  }
});

test("e2e — fresh meta shows Runs: 0 on lineup", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1280, height: 690 });
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      localStorage.removeItem("gutterbones1977:meta:v1");
      localStorage.removeItem("gutterbones1977:run:v1");
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openLineup());
    await page.waitForSelector('[data-layout-key="lineup-title"]', { timeout: 12_000 });
    const runs = await page.evaluate(() => {
      const row = Array.from(document.querySelectorAll("span")).find((el) => /Runs:/i.test(el.textContent || ""));
      const bold = row?.querySelector("b");
      return bold ? Number(bold.textContent) : NaN;
    });
    assert.equal(runs, 0);
  } finally {
    await browser.close();
  }
});

test("e2e — shop intel shows compact loadout block", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1280, height: 690 });
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
    const payload = plain(
      createGame(fixtures.snapshot()).api.normalizeSavedRun(fixtures.shopBusy()),
    );
    payload.phase = "SHOP";
    await page.evaluate(
      ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
      { key: RUN_KEY, data: payload },
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__.getPhase() === "SHOP", { timeout: 12_000 });
    const hasLoadout = await page.evaluate(() => !!document.querySelector('[data-layout-key="run-intel-compact-loadout"]'));
    assert.ok(hasLoadout);
  } finally {
    await browser.close();
  }
});
