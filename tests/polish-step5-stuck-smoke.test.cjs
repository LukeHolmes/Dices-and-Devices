"use strict";
/**
 * Polish step 5: stuck-game smoke — 2 seeded bot games per blocking viewport plus route smokes.
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const http = require("node:http");
const fs = require("node:fs");
const { runOneGame, VIEWPORTS_BLOCKING } = require("./sim/run.cjs");
const { createGame, plain } = require("./helpers/game.cjs");
const fixtures = require("./fixtures/runs.cjs");
const {
  isNonBlockingViewport,
  phonePortraitBlockingEnabled,
  recordPhoneWarning,
  printPhonePortraitReport,
} = require("./helpers/phone-portrait.cjs");

const ROOT = path.join(__dirname, "..");
const RUN_KEY = "gutterbones1977:run:v1";
const SEEDS = [13, 61];

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
  if (process.env.CHECK_FAST_PRINT_PHONE_REPORT === "1") {
    printPhonePortraitReport();
  }
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
  await page.waitForTimeout(500);
}

function assertSmokeResult(vpName, result) {
  const incomplete =
    result.stuck
    || result.reason === "incomplete"
    || String(result.outcome || "").startsWith("INCOMPLETE");
  if (!incomplete) return;
  if (isNonBlockingViewport(vpName) && !phonePortraitBlockingEnabled()) {
    recordPhoneWarning({
      suite: "polish-step5-stuck-smoke",
      viewport: vpName,
      label: `sim rid ${result.rid}`,
      message: JSON.stringify(result),
    });
    return;
  }
  assert.equal(incomplete, false, JSON.stringify(result));
}

for (const vp of VIEWPORTS_BLOCKING) {
  for (const rid of SEEDS) {
    test(`polish step5 stuck smoke — bot rid ${rid} @ ${vp.name}`, async () => {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      try {
        const strategy = ["random", "greedy", "edge", "rapid"][rid % 4];
        page.__baseUrl = baseUrl;
        const result = await runOneGame(page, {
          rid,
          seed: rid * 7919,
          strategy,
          viewport: vp,
          maxSteps: 220,
          stuckThreshold: 36,
          maxFallbacks: 12,
        });
        assertSmokeResult(vp.name, result);
      } finally {
        await browser.close();
      }
    });
  }
}

const ROUTE_SMOKES = [
  {
    id: "rap_sheet",
    builder: fixtures.run,
    assert: async (page) => {
      await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.forfeitRunDemo(320));
      await page.waitForSelector('[data-layout-key="rap-sheet"]', { timeout: 12_000 });
      await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.finishRapReveal?.());
      await page.waitForTimeout(250);
      const phase = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.getPhase());
      assert.equal(phase, "RAP_SHEET");
    },
  },
  {
    id: "carving",
    builder: fixtures.carving,
    assert: async (page) => {
      const phase = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.getPhase());
      assert.equal(phase, "CARVING");
    },
  },
  {
    id: "shop",
    builder: fixtures.shopBusy,
    assert: async (page) => {
      const phase = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.getPhase());
      assert.equal(phase, "SHOP");
      const buy = await page.evaluate(() => !!document.querySelector('[data-layout-key="shop-buy-button"]'));
      assert.ok(buy, "shop buy visible");
    },
  },
  {
    id: "boss_intro",
    builder: fixtures.run,
    assert: async (page) => {
      await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openBossIntroFor("LOAN_SHARK"));
      await page.waitForSelector('[data-layout-key="boss-intro-overlay"]', { timeout: 10_000 });
    },
  },
];

for (const route of ROUTE_SMOKES) {
  for (const vp of VIEWPORTS_BLOCKING) {
    test(`polish step5 route smoke — ${route.id} @ ${vp.name}`, async () => {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      try {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
        await resumeFixture(page, route.builder);
        await route.assert(page);
      } finally {
        await browser.close();
      }
    });
  }
}
