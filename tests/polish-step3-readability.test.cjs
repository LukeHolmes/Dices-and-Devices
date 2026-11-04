"use strict";
/**
 * Polish step 3: stash fit, carving→shop softlock, tutorial dismiss, boss hit target,
 * rap sheet settled, typography, opening sniff overlap.
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
  { name: "360x640", width: 360, height: 640, phone: true },
  { name: "390x844", width: 390, height: 844, phone: true },
  { name: "412x915", width: 412, height: 915, phone: true },
  { name: "844x390", width: 844, height: 390, phone: true },
  { name: "768x1024", width: 768, height: 1024, phone: false },
  { name: "1024x768", width: 1024, height: 768, phone: false },
  { name: "1366x768", width: 1366, height: 768, phone: false },
  { name: "1920x1080", width: 1920, height: 1080, phone: false },
];

const STASH_KEYS = ["stash-program-SNIFF", "stash-program-BRIBE", "stash-program-FIX", "stash-program-LAUNDER"];

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
  test(`polish step3 — play stash programs in viewport @ ${vp.name}`, async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
      await resumeFixture(page, fixtures.playStashOpen844);
      await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openPlayStashPanel());
      await page.waitForTimeout(350);
      const m = await page.evaluate(
        (keys) => window.__GB_LAYOUT_AUDIT__.measureLayoutKeysInViewport(keys),
        STASH_KEYS,
      );
      assert.ok(m.ok, JSON.stringify(m));
    } finally {
      await browser.close();
    }
  });

  test(`polish step3 — boss CONTINUE is top hit target @ ${vp.name}`, async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
      await resumeFixture(page, fixtures.playRaidRound9);
      await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openBossIntroFor("THE_RAID"));
      await page.waitForSelector('[data-layout-key="boss-intro-continue"]', { timeout: 8000 });
      await page.waitForTimeout(400);
      const hit = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.measureBossContinueHitTarget());
      assert.ok(hit.ok, JSON.stringify(hit));
      assert.equal(hit.hitKey, "boss-intro-continue", JSON.stringify(hit));
    } finally {
      await browser.close();
    }
  });

  test(`polish step3 — carving return shop route hit @ ${vp.name}`, async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
      await resumeFixture(page, fixtures.shopAfterCarve);
      await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.returnFromCarvingToShop());
      await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__.getPhase() === "SHOP", { timeout: 8000 });
      await page.waitForTimeout(400);
      await page.locator('[data-layout-key="shop-route-card"]').first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      const hit = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.probeShopRouteHit());
      assert.ok(hit.ok, JSON.stringify(hit));
      await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.clickShopRouteCard());
      await page.waitForTimeout(100);
      const pathId = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.getState().selectedShopPathId);
      assert.ok(pathId, `expected route selected, got ${pathId}`);
    } finally {
      await browser.close();
    }
  });

  test(`polish step3 — tutorial COPY THAT dismiss in viewport @ ${vp.name}`, async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
      await resumeFixture(page, fixtures.playStashOpen844);
      await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openTutorialCoachAck(0, "PLAY"));
      await page.waitForSelector('[data-layout-key="tutorial-coach-ack"]', { timeout: 8000 });
      await page.waitForTimeout(350);
      const m = await page.evaluate(() =>
        window.__GB_LAYOUT_AUDIT__.measureLayoutKeysInViewport([
          "tutorial-coach-ack",
          "tutorial-coach-dismiss",
        ]),
      );
      assert.ok(m.ok, JSON.stringify(m));
    } finally {
      await browser.close();
    }
  });

  test(`polish step3 — rap sheet settled at rest @ ${vp.name}`, async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
      const history = fixtures.rapSheetHistory8().history;
      await page.evaluate((rows) => window.__GB_LAYOUT_AUDIT__.openRapSheetDemo(rows), history);
      await page.waitForSelector('[data-layout-key="rap-sheet"]', { timeout: 8000 });
      await page.waitForFunction(
        () => {
          const layout = window.__GB_LAYOUT_AUDIT__.getRapSheetLayout();
          return layout.ok;
        },
        { timeout: 8000 },
      );
    } finally {
      await browser.close();
    }
  });

  test(`polish step3 — opening sniff does not overlap payout @ ${vp.name}`, async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
      await resumeFixture(page, fixtures.playStashOpen844);
      await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openOpeningSniffBannerDemo());
      await page.waitForTimeout(450);
      const m = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.measureOpeningSniffOverlap());
      assert.ok(m.ok, JSON.stringify(m));
    } finally {
      await browser.close();
    }
  });

  test(`polish step3 — main screen typography >= 11px @ ${vp.name}`, async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
      await resumeFixture(page, fixtures.playHeavyHardware);
      await page.waitForTimeout(350);
      const playAudit = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.auditVisibleTypography(11));
      assert.ok(playAudit.ok, JSON.stringify(playAudit));
    } finally {
      await browser.close();
    }
  });

  if (vp.phone) {
    test(`polish step3 — phone tap targets >= 32px @ ${vp.name}`, async () => {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      try {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
        await resumeFixture(page, fixtures.playStashOpen844);
        await page.waitForTimeout(350);
        const tap = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.auditPhoneTapTargets(32));
        assert.ok(tap.ok, JSON.stringify(tap));
      } finally {
        await browser.close();
      }
    });
  }
}

test("source — polish step3 layout hooks present", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(html, /stash-program-\$\{p\.id\}/);
  assert.match(html, /data-rap-sheet-settled/);
  assert.match(html, /returnToInRunShop/);
  assert.match(html, /measureBossContinueHitTarget/);
  assert.match(html, /measureElementHitTarget/);
  assert.match(html, /data-layout-key="opening-sniff-banner"/);
  assert.match(html, /data-layout-key="tutorial-coach-dismiss"/);
});
