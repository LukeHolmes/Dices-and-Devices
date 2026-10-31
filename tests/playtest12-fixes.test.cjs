"use strict";
/**
 * Playtest 12: rap sheet row alignment, alley MULT pips, roll after score dismiss, smelling salts.
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

async function waitForGameReady(page) {
  await page.waitForSelector("#root-gutterbones", { timeout: 45_000 });
  await page.waitForFunction(
    () => {
      const root = document.getElementById("root-gutterbones");
      return root && root.innerText && !root.innerText.includes("LOADING");
    },
    { timeout: 45_000 },
  );
  await waitForLayoutAudit(page);
}

function normalizeFixture(name) {
  const builders = {
    normal: () => fixtures.run(),
    rapSheet: fixtures.rapSheet,
  };
  const builder = builders[name];
  assert.ok(builder, `unknown fixture: ${name}`);
  const g = createGame(fixtures.snapshot());
  return plain(g.api.normalizeSavedRun(builder()));
}

test("rules — THE RAID boss quota modifier is ~1.5x", () => {
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
    name: "THE RAID",
    applyTarget: (t) => Math.floor(t * 1.5),
  };
  const out = sandbox.R.projectNextRound({
    path: { id: "RAID", mod: 1, boss: THE_RAID },
    round: 9,
    target: 457,
    debt: 0,
    insaneContract: false,
    hasLedger: false,
    personaPlays: 4,
    personaPills: 3,
  });
  assert.ok(out.nextTargetDisplay >= Math.floor(out.nextTarget * 1.35));
  assert.ok(out.nextTargetDisplay < out.nextTarget * 2);
});

test("e2e — rap sheet stat values align vertically with labels", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1280, height: 690 });
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
    await waitForGameReady(page);
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openRapSheet());
    await page.waitForSelector('[data-layout-key="rap-sheet"]', { timeout: 8000 });
    await page.waitForTimeout(350);
    await page.evaluate(() => {
      document.querySelector('[data-layout-key="rap-sheet"]')?.scrollIntoView({ block: "center" });
    });
    await page.waitForTimeout(200);
    const align = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.measureRapSheetStatAlignment());
    assert.ok(align.ok, `misaligned rows: ${JSON.stringify(align.bad || align.reason)}`);
  } finally {
    await browser.close();
  }
});

test("e2e — alley MULT die shows pip sprite when value is 0 on face record", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(fixtures.run({
      phase: "PLAY",
      dice: fixtures.diceWithFaces([
        { value: 0, faceId: "MULT_FACE", type: "modifier" },
        { value: 1 },
        { value: 2 },
        { value: 4 },
        { value: 5 },
      ]),
      hasRolled: true,
    })));
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
    await waitForLayoutAudit(page);
    await page.evaluate(
      ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
      { key: RUN_KEY, data: payload },
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForLayoutAudit(page);
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
    await page.waitForSelector('[data-tutorial="dice-lane"] .bone-die-img', { timeout: 8000 });
    const src = await page.locator('[data-tutorial="dice-lane"] .bone-die-img').first().getAttribute("src");
    assert.ok(src && src.includes("die-1"), `expected die-1 fallback pip, got ${src}`);
  } finally {
    await browser.close();
  }
});

test("e2e — first roll click works immediately after score overlay dismiss", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${baseUrl}/index.html?e2e=1`, { waitUntil: "domcontentloaded" });
    await waitForE2E(page);
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
    await page.evaluate(() => {
      window.__GB_E2E__.skipIntroOverlays();
      window.__GB_E2E__.setPlaysRemaining(4);
      window.__GB_E2E__.setQuotaTarget(9999);
      window.__GB_E2E__.prepareScore("TOK", [2, 2, 2, 3, 4]);
    });
    await page.waitForFunction(
      () => document.querySelector('[data-layout-key="score-breakdown-overlay"]') || document.querySelector('[data-layout-key="score-resolution-overlay"]'),
      { timeout: 15_000 },
    );
    for (let i = 0; i < 4; i += 1) {
      await page.evaluate(() => window.__GB_E2E__.dismissOverlays());
      const open = await page.evaluate(
        () => !!(document.querySelector('[data-layout-key="score-breakdown-overlay"]') || document.querySelector('[data-layout-key="score-resolution-overlay"]')),
      );
      if (!open) break;
      await page.waitForTimeout(120);
    }
    await page.waitForFunction(() => !window.__GB_E2E__.isRollDisabled(), { timeout: 12_000 });
    await page.click('[data-tutorial="roll-btn"]');
    await page.waitForFunction(() => window.__GB_E2E__.getHasRolled() === true, { timeout: 8000 });
  } finally {
    await browser.close();
  }
});

test("e2e — chain banner sits above score breakdown (no overlap)", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
    await waitForGameReady(page);
    const payload = normalizeFixture("normal");
    await page.evaluate(
      ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
      { key: RUN_KEY, data: payload },
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForGameReady(page);
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__.getPhase() === "PLAY", { timeout: 12_000 });
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openScoreBreakdownDemo());
    await page.waitForFunction(
      () => document.querySelector('[data-layout-key="synergy-chain-overlay"]') && document.querySelector('[data-layout-key="score-breakdown-overlay"]'),
      { timeout: 12_000 },
    );
    const overlap = await page.evaluate(() => {
      const chain = document.querySelector('[data-layout-key="synergy-chain-overlay"]');
      const panel = document.querySelector('[data-layout-key="score-breakdown-overlay"]');
      const c = chain.getBoundingClientRect();
      const p = panel.getBoundingClientRect();
      return { ok: c.bottom <= p.top + 2, chainBottom: c.bottom, panelTop: p.top };
    });
    assert.ok(overlap.ok, `chain/panel overlap chainBottom=${overlap.chainBottom} panelTop=${overlap.panelTop}`);
  } finally {
    await browser.close();
  }
});

test("rules — smelling salts shop purchase adds pills immediately", () => {
  const item = {
    id: "SMELLING_SALTS",
    name: "Smelling Salts",
    desc: "+2 Pills immediately.",
    cost: 24,
    rarity: "common",
    type: "consumable",
    icon: "+P",
  };
  const g = createGame(fixtures.snapshot({ phase: "SHOP", gold: 50, discards: 2, shopItems: [item] }));
  g.api.handlePurchase(item);
  assert.equal(g.state("discards"), 4);
  assert.equal(g.state("consumables").length, 0);
});
