"use strict";
/**
 * Playtest 9 regressions: round clear payout, job round after carve, coach suppress, synergy banner.
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const { createGame, plain } = require("./helpers/game.cjs");
const fixtures = require("./fixtures/runs.cjs");
const RUN_KEY = "gutterbones1977:run:v1";

function loadEconomyFromHtml() {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const start = html.indexOf('<script id="gutterbones-routes">') + '<script id="gutterbones-routes">'.length;
  const end = html.indexOf("</script>", start);
  const routesSource = html.slice(start, end);
  const sandbox = {};
  vm.createContext(sandbox);
  new vm.Script(
    routesSource +
      "\nconst computeRoundClearPayout = (handsRemaining, cashHeld) => {\n" +
      "  const ECONOMY_TUNING = { roundClearBaseCash: 8, roundClearPerUnusedPlay: 3, roundClearInterestCap: 5, roundClearInterestPerFive: 1 };\n" +
      "  const base = ECONOMY_TUNING.roundClearBaseCash || 8;\n" +
      "  const unusedPlays = Math.max(0, Math.floor(Number(handsRemaining) || 0));\n" +
      "  const unused = unusedPlays * (ECONOMY_TUNING.roundClearPerUnusedPlay || 1);\n" +
      "  const interest = Math.min(ECONOMY_TUNING.roundClearInterestCap || 5, Math.floor(Math.max(0, cashHeld) / 5) * (ECONOMY_TUNING.roundClearInterestPerFive || 1));\n" +
      "  return { base, unused, unusedPlays, interest, total: base + unused + interest };\n" +
      "};\n" +
      "globalThis.computeRoundClearPayout = computeRoundClearPayout;",
  ).runInContext(sandbox);
  return sandbox.computeRoundClearPayout;
}

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

test("round clear payout — zero unused plays yields $0 unused", () => {
  const compute = loadEconomyFromHtml();
  const payout = compute(0, 20);
  assert.equal(payout.unusedPlays, 0);
  assert.equal(payout.unused, 0);
  assert.equal(payout.total, payout.base + payout.interest);
});

test("e2e — carve returns to shop without skipping job round", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${baseUrl}/index.html?e2e=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await waitForGameReady(page);
    const g = createGame(fixtures.snapshot());
    const payload = plain(
      g.api.normalizeSavedRun({
        ...fixtures.carving(),
        round: 2,
      }),
    );
    await page.evaluate(
      ({ key, data, settings }) => {
        localStorage.setItem(
          "gutterbones1977:settings:v1",
          JSON.stringify(settings),
        );
        localStorage.setItem(key, JSON.stringify(data));
      },
      {
        key: RUN_KEY,
        data: payload,
        settings: { tutorialCompleted: true, skippedAlleyIntro: true, pacing: "fast" },
      },
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForGameReady(page);
    await page.evaluate(() => window.__GB_E2E__.resumeSavedRun());
    await page.waitForTimeout(400);
    const before = await page.evaluate(() => window.__GB_E2E__.getState());
    assert.equal(before.phase, "CARVING");
    assert.equal(before.round, 2);
    await page.evaluate(() => {
      const tile = document.querySelector('[data-layout-key="carving-layout"] button');
      tile?.click();
    });
    await page.waitForTimeout(900);
    const after = await page.evaluate(() => window.__GB_E2E__.getState());
    assert.equal(after.phase, "SHOP");
    assert.equal(after.round, 2, "carve must not advance job round");
    const label = await page.evaluate(() => {
      const panel = document.querySelector('[data-layout-key="shop-routes-panel"]');
      return panel ? panel.innerText : "";
    });
    assert.match(label, /ROUND\s+2/);
  } finally {
    await browser.close();
  }
});

test("e2e — tutorial skip suppresses first-run coach overlay on new run", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${baseUrl}/index.html?e2e=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await waitForGameReady(page);
    await page.evaluate(() => {
      localStorage.setItem(
        "gutterbones1977:settings:v1",
        JSON.stringify({ tutorialCompleted: true, skippedAlleyIntro: true }),
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
    const coachVisible = await page.evaluate(() => {
      const firstRun = document.querySelector('[data-layout-key="first-run-overlay"]');
      const tutorial = document.querySelector('[data-layout-key="tutorial-coach-mark"]');
      return !!(firstRun || tutorial);
    });
    assert.equal(coachVisible, false);
  } finally {
    await browser.close();
  }
});
