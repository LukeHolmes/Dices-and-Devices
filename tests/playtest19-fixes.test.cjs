"use strict";
/**
 * Playtest 19: intel details portal, chip/boss labels, shop header, score-before-clear, forfeit meta, click-through guard.
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

const VIEWPORTS = [
  { name: "1280x690", width: 1280, height: 690 },
  { name: "390x844", width: 390, height: 844 },
  { name: "844x390", width: 844, height: 390 },
];

test("source — playtest 19 hooks present", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(html, /RunIntelDetailOverlay/);
  assert.match(html, /ReactDOM\.createPortal/);
  assert.match(html, /abbrevBossChipName/);
  assert.match(html, /awaitScoreOverlay/);
  assert.match(html, /consumeNextClickRef/);
  assert.match(html, /runMetaAwardedRef/);
  assert.match(html, /shop-next-job-header/);
  assert.match(html, /armClickThroughGuard/);
});

test("source — finalize waits for score overlay when awaitScoreOverlay", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(html, /pending\.awaitScoreOverlay/);
  assert.match(html, /scheduleTimeout\(\(\) => attemptRoundFinalizeAfterScore\(\), 48\)/);
  assert.doesNotMatch(html, /pending\.firstAttemptAt < 8000/);
});

async function resumePlayHeavy(page) {
  const payload = plain(
    createGame(fixtures.snapshot()).api.normalizeSavedRun(fixtures.playHeavyHardware()),
  );
  await page.evaluate(
    ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
    { key: RUN_KEY, data: payload },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
}

for (const vp of VIEWPORTS) {
  test(`e2e — run intel DETAILS popover in viewport @ ${vp.name}`, async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
      await resumePlayHeavy(page);
      if (vp.width < 768 || vp.height < 450) {
        await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openPlayStashPanel());
      }
      await page.evaluate(() =>
        window.__GB_LAYOUT_AUDIT__.seedPlayIntelState({
          bossId: "JUNKIE",
          routeEffect: {
            name: "LONG ROUTE MODIFIER NAME",
            effects: ["Quota x1.40 (scaled by round curve)", "Stash to 100% on pick"],
          },
          round: 3,
        }),
      );
      await page.waitForSelector('[data-layout-key="run-intel-summary"]', { timeout: 12_000 });
      await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.toggleRunIntelDetails());
      await page.waitForSelector('[data-layout-key="run-intel-detail-popover"]', { timeout: 8000 });
      await page.waitForFunction(
        () => {
          const m = window.__GB_LAYOUT_AUDIT__.measureRunIntelDetailsPopover();
          return m.ok;
        },
        { timeout: 8000 },
      );
      const pop = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.measureRunIntelDetailsPopover());
      assert.ok(pop.ok, JSON.stringify(pop));
      const chips = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.readChipRowRows());
      assert.ok(chips.ok, JSON.stringify(chips));
      const boss = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.readBossIntelChip());
      assert.ok(boss.ok, JSON.stringify(boss));
      assert.match(boss.value, /JUNKIE/i);
    } finally {
      await browser.close();
    }
  });

  test(`e2e — shop NEXT JOB readable @ ${vp.name}`, async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const payload = plain(
        createGame(fixtures.snapshot()).api.normalizeSavedRun(fixtures.shopBusy()),
      );
      payload.phase = "SHOP";
      await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
      await page.evaluate(
        ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
        { key: RUN_KEY, data: payload },
      );
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
      await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
      await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__.getPhase() === "SHOP", { timeout: 12_000 });
      await page.locator('[data-layout-key="shop-routes-panel"]').scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      const header = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.measureShopNextJobHeader());
      assert.ok(header.ok, JSON.stringify(header));
    } finally {
      await browser.close();
    }
  });
}

test("e2e — score overlay visible before round clear (round 3 demo)", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1280, height: 690 });
    const payload = plain(
      createGame(fixtures.snapshot()).api.normalizeSavedRun(fixtures.run()),
    );
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
      { key: RUN_KEY, data: payload },
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__.getPhase() === "PLAY", { timeout: 12_000 });
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openScoreBreakdownDemo());
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__.isScoreOverlayVisible(), { timeout: 8000 });
    await page.waitForSelector('[data-layout-key="score-breakdown-overlay"]', { timeout: 12_000 });
    await page.evaluate(() => {
      window.__GB_LAYOUT_AUDIT__.armPendingRoundFinalizeDemo();
      window.__GB_LAYOUT_AUDIT__.runAttemptRoundFinalizeDemo();
    });
    await page.waitForTimeout(200);
    const mid = await page.evaluate(() => ({
      score: window.__GB_LAYOUT_AUDIT__.isScoreOverlayVisible(),
      roundClear: window.__GB_LAYOUT_AUDIT__.isRoundClearVisible(),
    }));
    assert.ok(mid.score, JSON.stringify(mid));
    assert.equal(mid.roundClear, false, JSON.stringify(mid));
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.completeScoreOverlayRoundClearDemo());
    await page.waitForFunction(
      () => window.__GB_LAYOUT_AUDIT__.isRoundClearVisible() && !window.__GB_LAYOUT_AUDIT__.isScoreOverlayVisible(),
      { timeout: 12_000 },
    );
  } finally {
    await browser.close();
  }
});

test("e2e — forfeit increments runs and best heat", async () => {
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
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.forfeitRunDemo(320));
    await page.waitForSelector('[data-layout-key="rap-sheet"]', { timeout: 12_000 });
    const meta = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("gutterbones1977:meta:v1") || "{}"),
    );
    assert.equal(meta.totalRuns, 1);
    assert.equal(meta.bestHeat, 320);
    await page.locator('[data-layout-key="rap-play-again"]').click({ force: true });
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__.getPhase() === "LINEUP", { timeout: 8000 });
    const runsLine = await page.evaluate(() => {
      const row = Array.from(document.querySelectorAll("span")).find((el) => /Runs:/i.test(el.textContent || ""));
      return Number(row?.querySelector("b")?.textContent);
    });
    const best = await page.evaluate(() => {
      const row = Array.from(document.querySelectorAll("span")).find((el) => /Best Heat:/i.test(el.textContent || ""));
      return Number(row?.querySelector("b")?.textContent);
    });
    assert.equal(runsLine, 1);
    assert.equal(best, 320);
  } finally {
    await browser.close();
  }
});

test("e2e — rapid shop clicks after overlay dismiss register", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1280, height: 690 });
    const payload = plain(
      createGame(fixtures.snapshot()).api.normalizeSavedRun(fixtures.shop()),
    );
    payload.phase = "SHOP";
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
      { key: RUN_KEY, data: payload },
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__.getPhase() === "SHOP", { timeout: 12_000 });
    await page.evaluate(() => {
      const card = document.querySelector('[data-layout-key="shop-route-card"]');
      card?.click();
      card?.click();
    });
    await page.waitForTimeout(200);
    const selected = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.getState().selectedShopPathId);
    assert.ok(selected, "expected route selected after double click");
  } finally {
    await browser.close();
  }
});
