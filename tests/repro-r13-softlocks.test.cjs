"use strict";
/**
 * r13 regressions: multi-path shop advance without prior route click; harness-style hitStreets.
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
  await page.waitForFunction(() => window.__GB_E2E__, { timeout: 45_000 });
  await page.evaluate(() => window.__GB_E2E__.resumeSavedRun());
}

for (const [label, width, height] of [
  ["desktop_fhd", 1920, 1080],
  ["tablet_portrait", 768, 1024],
]) {
  test(`r13 — hitStreets leaves multi-path round-9 shop without prior select @ ${label}`, async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width, height });
      await page.goto(`${baseUrl}/index.html?e2e=1`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__GB_E2E__, { timeout: 45_000 });
      await resumeFixture(page, fixtures.shopLandscape161);
      await page.waitForFunction(
        () => window.__GB_E2E__.getState().phase === "SHOP" && !window.__GB_E2E__.getState().selectedShopPathId,
        { timeout: 8000 },
      );
      const ok = await page.evaluate(() => window.__GB_E2E__.hitStreets());
      assert.equal(ok, true);
      await page.waitForFunction(
        () => {
          const s = window.__GB_E2E__.getState();
          return s.phase === "PLAY" || s.phase === "SHOP";
        },
        { timeout: 5000 },
      );
      await page.waitForTimeout(400);
      const phase = await page.evaluate(() => window.__GB_E2E__.getState().phase);
      assert.notEqual(phase, "SHOP", `expected to leave SHOP, still ${phase}`);
    } finally {
      await browser.close();
    }
  });
}

test("r14 — desktop PLAY e2e focuses payouts dock before scoring (rid61 smoke @ 1024×768)", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(`${baseUrl}/index.html?e2e=1`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__GB_E2E__, { timeout: 45_000 });
    await page.evaluate(() => {
      localStorage.setItem(
        "gutterbones1977:settings:v1",
        JSON.stringify({
          pacing: "fast",
          reducedMotionPref: true,
          tutorialCompleted: true,
          skippedAlleyIntro: true,
        }),
      );
    });
    await page.evaluate(() => {
      window.__GB_E2E__.goLineup();
      window.__GB_E2E__.selectFirstPersona();
      window.__GB_E2E__.startNewRun();
      window.__GB_E2E__.skipIntroOverlays?.();
    });
    await page.waitForTimeout(500);
    await page.evaluate(() => window.__GB_E2E__.rollOnce());
    await page.waitForFunction(
      () => window.__GB_E2E__?.getHasRolled?.() && !window.__GB_E2E__?.getPlayLocks?.().rolling,
      { timeout: 20_000 },
    );
    await page.waitForFunction(
      () => document.querySelector("[data-payout-row]") != null,
      { timeout: 20_000 },
    );
    const ok = await page.evaluate(async () => {
      window.__GB_E2E__.focusPlayPayoutsTab?.();
      for (let i = 0; i < 20; i += 1) {
        if (window.__GB_E2E__.scoreFirstPayoutRow?.()) return true;
        await new Promise((r) => setTimeout(r, 150));
      }
      return false;
    });
    assert.equal(ok, true);
  } finally {
    await browser.close();
  }
});

test("r15 — broke round-9 RAID shop exposes hit streets without route tap @ tablet_portrait", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${baseUrl}/index.html?e2e=1`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__GB_E2E__, { timeout: 45_000 });
    await resumeFixture(page, fixtures.shopRound9RaidBroke);
    await page.evaluate(() => window.__GB_E2E__.skipIntroOverlays?.());
    await page.waitForFunction(
      () => {
        const btn = document.querySelector('[data-layout-key="shop-hit-streets"]');
        return btn && !btn.disabled;
      },
      { timeout: 8000 },
    );
    const st = await page.evaluate(() => window.__GB_E2E__.getState());
    assert.equal(st.selectedShopPathId, "RAID");
    const ok = await page.evaluate(() => window.__GB_E2E__.hitStreets());
    assert.equal(ok, true);
    await page.waitForFunction(() => window.__GB_E2E__.getState().phase !== "SHOP", { timeout: 8000 });
  } finally {
    await browser.close();
  }
});

test("r15 — refresh stock keeps RAID selection on final-job shop", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${baseUrl}/index.html?e2e=1`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__GB_E2E__, { timeout: 45_000 });
    await resumeFixture(page, fixtures.shopRound9RaidRefreshable);
    await page.click('[data-layout-key="shop-refresh-stock"]');
    await page.waitForTimeout(300);
    const st = await page.evaluate(() => window.__GB_E2E__.getState());
    assert.equal(st.selectedShopPathId, "RAID");
    const disabled = await page.evaluate(
      () => document.querySelector('[data-layout-key="shop-hit-streets"]')?.disabled,
    );
    assert.notEqual(disabled, true);
  } finally {
    await browser.close();
  }
});

test("r15 — loan carve blocked at broke final RAID shop", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${baseUrl}/index.html?e2e=1`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__GB_E2E__, { timeout: 45_000 });
    await resumeFixture(page, fixtures.shopRound9RaidBroke);
    await page.evaluate(() => window.__GB_E2E__.skipIntroOverlays?.());
    await page.waitForTimeout(400);
    const carved = await page.evaluate(() => {
      const hits = [...document.querySelectorAll('[data-layout-key="shop-buy-button"]')];
      const btn = hits[0];
      if (!btn || btn.disabled) return false;
      btn.click();
      return window.__GB_E2E__.getState().phase === "CARVING";
    });
    assert.equal(carved, false, "expected no loan carve at final RAID shop when broke");
  } finally {
    await browser.close();
  }
});

test("r15 — harness seed 483059 greedy tablet_portrait no R9 shop softlock", { timeout: 420_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${baseUrl}/index.html?e2e=1`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__GB_E2E__, { timeout: 45_000 });
    await page.evaluate(() => {
      localStorage.setItem(
        "gutterbones1977:settings:v1",
        JSON.stringify({
          pacing: "fast",
          reducedMotionPref: true,
          tutorialCompleted: true,
          skippedAlleyIntro: true,
        }),
      );
    });
    const { runOneGame } = require("./sim/run.cjs");
    page.__baseUrl = baseUrl;
    const result = await runOneGame(page, {
      rid: 61,
      seed: 483059,
      strategy: "greedy",
      viewport: { name: "768x1024", width: 768, height: 1024 },
      maxSteps: 12_000,
      stuckThreshold: 28,
      maxFallbacks: 20,
    });
    assert.notEqual(result.outcome, "INCOMPLETE:SHOP", JSON.stringify(result));
    assert.equal(result.reason, undefined, JSON.stringify(result));
    assert.ok(result.outcome === "BUST" || result.outcome === "WIN", JSON.stringify(result));
  } finally {
    await browser.close();
  }
});

test("r15 — harness seed 831495 greedy phone_landscape no R9 shop softlock", { timeout: 420_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto(`${baseUrl}/index.html?e2e=1`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__GB_E2E__, { timeout: 45_000 });
    await page.evaluate(() => {
      localStorage.setItem(
        "gutterbones1977:settings:v1",
        JSON.stringify({
          pacing: "fast",
          reducedMotionPref: true,
          tutorialCompleted: true,
          skippedAlleyIntro: true,
        }),
      );
    });
    const { runOneGame } = require("./sim/run.cjs");
    page.__baseUrl = baseUrl;
    const result = await runOneGame(page, {
      rid: 105,
      seed: 831495,
      strategy: "greedy",
      viewport: { name: "844x390", width: 844, height: 390 },
      maxSteps: 12_000,
      stuckThreshold: 28,
      maxFallbacks: 20,
    });
    assert.notEqual(result.outcome, "INCOMPLETE:SHOP", JSON.stringify(result));
    assert.equal(result.reason, undefined, JSON.stringify(result));
    assert.ok(result.outcome === "BUST" || result.outcome === "WIN", JSON.stringify(result));
  } finally {
    await browser.close();
  }
});

test("r13 — harness seed 546411 greedy desktop_fhd reaches terminal without shop softlock", { timeout: 420_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`${baseUrl}/index.html?e2e=1`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__GB_E2E__, { timeout: 45_000 });
    await page.evaluate(() => {
      localStorage.setItem(
        "gutterbones1977:settings:v1",
        JSON.stringify({
          pacing: "fast",
          reducedMotionPref: true,
          tutorialCompleted: true,
          skippedAlleyIntro: true,
        }),
      );
    });
    const { runOneGame } = require("./sim/run.cjs");
    page.__baseUrl = baseUrl;
    const result = await runOneGame(page, {
      rid: 69,
      seed: 546411,
      strategy: "greedy",
      viewport: { name: "1920x1080", width: 1920, height: 1080 },
      maxSteps: 8000,
      stuckThreshold: 28,
      maxFallbacks: 20,
    });
    assert.ok(result.outcome === "BUST" || result.outcome === "WIN", JSON.stringify(result));
    assert.equal(result.reason, undefined);
  } finally {
    await browser.close();
  }
});
