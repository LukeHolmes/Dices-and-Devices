"use strict";
/**
 * Playtest 13: roll after overlay/boss dismiss, MULT scoring, smelling salts carry, boss quota copy, double-roll guard.
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

async function waitForE2E(page) {
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

async function waitForLayoutAudit(page) {
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 20_000 });
}

async function startPlayRun(page) {
  await page.evaluate(() => {
    localStorage.setItem(
      "gutterbones1977:settings:v1",
      JSON.stringify({ pacing: "normal", reducedMotion: true, tutorialCompleted: true, skippedAlleyIntro: true }),
    );
    localStorage.setItem(
      "gutterbones1977:meta:v1",
      JSON.stringify({ totalRuns: 5, unlockedPersonaIds: ["STREET_RAT"], purchasedUpgradeIds: [] }),
    );
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForE2E(page);
  await page.evaluate(() => {
    window.__GB_E2E__.goLineup();
    window.__GB_E2E__.selectFirstPersona();
    window.__GB_E2E__.startNewRun();
  });
  await page.waitForFunction(() => window.__GB_E2E__.getState().phase === "PLAY", { timeout: 25_000 });
  await page.evaluate(() => window.__GB_E2E__.skipIntroOverlays());
}

test("rules — MULT_FACE pip counts toward Triad", () => {
  const g = createGame(fixtures.snapshot());
  const dice = fixtures.diceWithFaces([
    { value: 3, faceId: "MULT_FACE", type: "modifier" },
    { value: 3, faceId: null, type: "standard" },
    { value: 3, faceId: null, type: "standard" },
    { value: 2, faceId: null, type: "standard" },
    { value: 5, faceId: null, type: "standard" },
  ]);
  const r = g.api.calculateScore("TOK", dice);
  assert.ok(r.valid, "Triad should validate with MULT pip 3");
  assert.ok(r.total >= 40);
});

test("rules — smelling salts purchase sets run pill bonus", () => {
  const item = {
    id: "SMELLING_SALTS",
    name: "Smelling Salts",
    desc: "+2 max pills for this run (refreshes each round).",
    cost: 24,
    rarity: "common",
    type: "consumable",
    icon: "+P",
  };
  const g = createGame(fixtures.snapshot({ phase: "SHOP", gold: 50, discards: 3, pillRunBonus: 0, shopItems: [item] }));
  g.api.handlePurchase(item);
  assert.equal(g.state("pillRunBonus"), 2);
  assert.equal(g.state("discards"), 3);
});

test("rules — THE RAID boss card multiplier label matches ~1.38× math", () => {
  const vm = require("node:vm");
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const start = html.indexOf('<script id="gutterbones-routes">') + 33;
  const end = html.indexOf("</script>", start);
  const routesSource = html.slice(start, end);
  const sandbox = {};
  vm.createContext(sandbox);
  new vm.Script(`${routesSource}\nglobalThis.R = GutterbonesRoutes;`).runInContext(sandbox);
  const THE_RAID = {
    id: "THE_RAID",
    applyTarget: (t) => Math.floor(t * 1.5),
  };
  const base = 547;
  const display = sandbox.R.applyBossAdjustedTarget(base, THE_RAID, 9);
  const ratio = Math.round((display / base) * 100) / 100;
  assert.ok(ratio >= 1.37 && ratio <= 1.39, `expected ~1.38×, got ${ratio} (${display}/${base})`);
  assert.match(html, /Quota ×1\.38 \(~\+38%\)/);
});

test("e2e — one roll after score dismiss changes dice values", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${baseUrl}/index.html?e2e=1`, { waitUntil: "domcontentloaded" });
    await startPlayRun(page);
    await page.evaluate(() => {
      window.__GB_E2E__.setPlaysRemaining(4);
      window.__GB_E2E__.setQuotaTarget(9999);
      window.__GB_E2E__.prepareScore("TOK", [2, 2, 2, 3, 4]);
    });
    await page.waitForFunction(
      () => document.querySelector('[data-layout-key="score-breakdown-overlay"]') || document.querySelector('[data-layout-key="score-resolution-overlay"]'),
      { timeout: 15_000 },
    );
    for (let i = 0; i < 5; i += 1) {
      await page.evaluate(() => window.__GB_E2E__.dismissOverlays());
      const open = await page.evaluate(
        () => !!(document.querySelector('[data-layout-key="score-breakdown-overlay"]') || document.querySelector('[data-layout-key="score-resolution-overlay"]')),
      );
      if (!open) break;
      await page.waitForTimeout(120);
    }
    await page.waitForFunction(() => !window.__GB_E2E__.isRollDisabled(), { timeout: 12_000 });
    const before = await page.evaluate(() => window.__GB_E2E__.getDiceValues());
    await page.click('[data-tutorial="roll-btn"]');
    await page.waitForFunction(
      (prev) => {
        const next = window.__GB_E2E__.getDiceValues();
        return next.length === 5 && JSON.stringify(next) !== JSON.stringify(prev);
      },
      before,
      { timeout: 10_000 },
    );
    assert.equal(await page.evaluate(() => window.__GB_E2E__.getHasRolled()), true);
  } finally {
    await browser.close();
  }
});

test("e2e — one roll after boss intro dismiss changes dice", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${baseUrl}/index.html?e2e=1`, { waitUntil: "domcontentloaded" });
    await startPlayRun(page);
    await page.evaluate(() => window.__GB_E2E__.forceBossIntro("LOAN_SHARK"));
    await page.waitForSelector('[data-layout-key="boss-intro-overlay"]', { timeout: 8000 });
    await page.evaluate(() => window.__GB_E2E__.dismissBossIntro());
    await page.waitForFunction(() => !document.querySelector('[data-layout-key="boss-intro-overlay"]'), { timeout: 8000 });
    await page.waitForFunction(() => !window.__GB_E2E__.isRollDisabled(), { timeout: 12_000 });
    const before = await page.evaluate(() => window.__GB_E2E__.getDiceValues());
    await page.click('[data-tutorial="roll-btn"]');
    await page.waitForFunction(
      (prev) => JSON.stringify(window.__GB_E2E__.getDiceValues()) !== JSON.stringify(prev),
      before,
      { timeout: 10_000 },
    );
  } finally {
    await browser.close();
  }
});

test("e2e — double-click roll only spends one pill on reroll", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${baseUrl}/index.html?e2e=1`, { waitUntil: "domcontentloaded" });
    await startPlayRun(page);
    await page.waitForFunction(() => !window.__GB_E2E__.isRollDisabled(), { timeout: 12_000 });
    await page.click('[data-tutorial="roll-btn"]');
    await page.waitForFunction(() => window.__GB_E2E__.getHasRolled() === true, { timeout: 8000 });
    await page.waitForFunction(() => !window.__GB_E2E__.isRollDisabled(), { timeout: 8000 });
    const pillsBefore = await page.evaluate(() => window.__GB_E2E__.getDiscards());
    await page.evaluate(() => window.__GB_E2E__.rollOnce());
    await page.waitForFunction(() => !window.__GB_E2E__.isRollDisabled(), { timeout: 8000 });
    await page.evaluate(() => {
      window.__GB_E2E__.rollOnce();
      window.__GB_E2E__.rollOnce();
    });
    await page.waitForTimeout(400);
    const pillsAfter = await page.evaluate(() => window.__GB_E2E__.getDiscards());
    assert.equal(pillsAfter, pillsBefore - 1, `expected one pill spent, before=${pillsBefore} after=${pillsAfter}`);
  } finally {
    await browser.close();
  }
});

test("e2e — score breakdown panel hides scrollbar gutter", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
    await waitForLayoutAudit(page);
    const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(fixtures.run()));
    await page.evaluate(
      ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
      { key: RUN_KEY, data: payload },
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForLayoutAudit(page);
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__.getPhase() === "PLAY", { timeout: 12_000 });
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openScoreBreakdownDemo());
    await page.waitForSelector('[data-layout-key="score-breakdown-overlay"]', { timeout: 8000 });
    const scrollMetrics = await page.evaluate(() => {
      const panel = document.querySelector(".score-explanation-panel");
      if (!panel) return { ok: false, reason: "no panel" };
      const cs = getComputedStyle(panel);
      return {
        ok: cs.scrollbarWidth === "none" || cs.overflowY !== "visible",
        scrollbarWidth: cs.scrollbarWidth,
        overflowY: cs.overflowY,
      };
    });
    assert.ok(scrollMetrics.ok, JSON.stringify(scrollMetrics));
  } finally {
    await browser.close();
  }
});
