"use strict";
/**
 * Polish step 2: boss intro fit, rap backdrop, payout collapse, shop refresh, run intel close.
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const http = require("node:http");
const fs = require("node:fs");
const { createGame, plain } = require("./helpers/game.cjs");
const fixtures = require("./fixtures/runs.cjs");
const { assertViewport } = require("./helpers/phone-portrait.cjs");

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
  for (const [bossId] of fixtures.bossCases) {
    test(`polish step2 — boss intro CONTINUE in viewport (${bossId}) @ ${vp.name}`, async () => {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      try {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
        await resumeFixture(page, fixtures.playRaidRound9);
        await page.evaluate((id) => window.__GB_LAYOUT_AUDIT__.openBossIntroFor(id), bossId);
        await page.waitForSelector('[data-layout-key="boss-intro-continue"]', { timeout: 8000 });
        await page.waitForTimeout(350);
        const m = await page.evaluate(() =>
          window.__GB_LAYOUT_AUDIT__.measureLayoutKeysInViewport(["boss-intro-continue"]),
        );
        assertViewport(vp.name, m.ok, JSON.stringify(m), {
          suite: "polish-step2",
          label: `boss intro ${bossId}`,
        });
      } finally {
        await browser.close();
      }
    });
  }

  test(`polish step2 — rap sheet backdrop in viewport @ ${vp.name}`, async () => {
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
        window.__GB_LAYOUT_AUDIT__.measureLayoutKeysInViewport(["rap-sheet-backdrop", "rap-play-again"]),
      );
      assertViewport(vp.name, m.ok, JSON.stringify(m), {
        suite: "polish-step2",
        label: "layout measure",
      });
    } finally {
      await browser.close();
    }
  });

  test(`polish step2 — payout rows fit @ ${vp.name}`, async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
      await resumeFixture(page, fixtures.playHeavyHardware);
      await page.waitForTimeout(400);
      const m = await page.evaluate(() => {
        const audit = window.__GB_LAYOUT_AUDIT__;
        const container = document.querySelector(".payout-sheet-rows");
        if (!container) return { ok: false, reason: "no payout container" };
        const cr = container.getBoundingClientRect();
        const rows = Array.from(container.querySelectorAll("[data-payout-row]:not(.payout-row-collapsed)"));
        const bad = [];
        rows.forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.bottom > cr.bottom + 1 || r.top < cr.top - 1) {
            bad.push({ key: el.getAttribute("data-layout-key") || el.getAttribute("data-payout-row"), bottom: r.bottom, limit: cr.bottom });
          }
        });
        const more = audit.measureLayoutKeysInViewport(["payout-sheet-more"]);
        if (!more.ok && document.querySelector('[data-layout-key="payout-sheet-more"]')) {
          return more;
        }
        return { ok: bad.length === 0, bad, containerBottom: cr.bottom };
      });
      assertViewport(vp.name, m.ok, JSON.stringify(m), {
        suite: "polish-step2",
        label: "layout measure",
      });
    } finally {
      await browser.close();
    }
  });

  test(`polish step2 — shop REFRESH STOCK height @ ${vp.name}`, async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
      await resumeFixture(page, fixtures.shopLandscape161);
      await page.waitForTimeout(400);
      const m = await page.evaluate(() =>
        window.__GB_LAYOUT_AUDIT__.measureLayoutKeysInViewport(["shop-refresh-stock"]),
      );
      assertViewport(vp.name, m.ok, JSON.stringify(m), {
        suite: "polish-step2",
        label: "layout measure",
      });
    } finally {
      await browser.close();
    }
  });

  test(`polish step2 — run intel CLOSE in viewport @ ${vp.name}`, async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
      await resumeFixture(page, fixtures.playHeavyHardware);
      await page.evaluate(() => {
        window.__GB_LAYOUT_AUDIT__.seedPlayIntelState({ round: 5, stash: 40 });
        window.__GB_LAYOUT_AUDIT__.toggleRunIntelDetails();
      });
      await page.waitForSelector('[data-layout-key="run-intel-detail-close"]', { timeout: 8000 });
      await page.waitForTimeout(200);
      const m = await page.evaluate(() =>
        window.__GB_LAYOUT_AUDIT__.measureLayoutKeysInViewport(["run-intel-detail-close"]),
      );
      assertViewport(vp.name, m.ok, JSON.stringify(m), {
        suite: "polish-step2",
        label: "layout measure",
      });
    } finally {
      await browser.close();
    }
  });

  test(`polish step2 — loss DISMISS clamp @ ${vp.name}`, async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
      await resumeFixture(page, fixtures.run);
      await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openLossExplanationDemo());
      await page.waitForTimeout(400);
      const m = await page.evaluate(() =>
        window.__GB_LAYOUT_AUDIT__.measureLayoutKeysInViewport(["loss-explanation-dismiss"]),
      );
      assertViewport(vp.name, m.ok, JSON.stringify(m), {
        suite: "polish-step2",
        label: "layout measure",
      });
      assertViewport(vp.name, (m.bad[0]?.left ?? 0) >= 0, JSON.stringify(m), {
        suite: "polish-step2",
        label: "loss dismiss left",
      });
    } finally {
      await browser.close();
    }
  });
}

test("source — polish step2 layout hooks present", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(html, /data-layout-key="boss-intro-continue"/);
  assert.match(html, /data-layout-key="shop-refresh-stock"/);
  assert.match(html, /data-layout-key="run-intel-detail-close"/);
  assert.match(html, /data-layout-key="rap-sheet-backdrop"/);
  assert.match(html, /PayoutSheetRows/);
  assert.match(html, /openBossIntroFor/);
});
