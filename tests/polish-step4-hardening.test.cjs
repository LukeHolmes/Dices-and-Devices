"use strict";
/**
 * Polish step 4: layout leftovers (844×390 score/shop/gamble/tutorial), typography,
 * run-intel / shop BUY hit targets, off-screen clip budget, stuck recovery surface.
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
const OFFSCREEN_CLIP_BUDGET_844 = 170;

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
  if (vp.phone) {
    test(`polish step4 — score overlay in viewport @ ${vp.name}`, async () => {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      try {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
        await resumeFixture(page, fixtures.playStashOpen844);
        await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openScoreBreakdownDemo());
        await page.waitForSelector('[data-layout-key="score-breakdown-overlay"]', { timeout: 8000, state: "visible" });
        await page.waitForTimeout(350);
        const m = await page.evaluate(() =>
          window.__GB_LAYOUT_AUDIT__.measureLayoutKeysInViewport(["score-breakdown-overlay"]),
        );
        assertViewport(vp.name, m.ok, JSON.stringify(m), { suite: "polish-step4", label: "measure" });
      } finally {
        await browser.close();
      }
    });
  }

  if (!vp.phone) {
    test(`polish step4 — score overlay clears stash @ ${vp.name}`, async () => {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      try {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
        await resumeFixture(page, fixtures.playStashOpen844);
        await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openScoreBreakdownDemo());
        await page.waitForSelector('[data-layout-key="score-breakdown-overlay"]', { timeout: 8000 });
        await page.waitForTimeout(450);
        const m = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.measureScoreOverlayVsStash());
        assertViewport(vp.name, m.ok, JSON.stringify(m), { suite: "polish-step4", label: "measure" });
      } finally {
        await browser.close();
      }
    });

    test(`polish step4 — score resolution clears stash @ ${vp.name}`, async () => {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      try {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
        await resumeFixture(page, fixtures.playStashOpen844);
        await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openScoreResolutionDemo());
        await page.waitForSelector('[data-layout-key="score-resolution-overlay"]', { timeout: 8000 });
        await page.waitForTimeout(450);
        const m = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.measureScoreOverlayVsStash());
        assertViewport(vp.name, m.ok, JSON.stringify(m), { suite: "polish-step4", label: "measure" });
      } finally {
        await browser.close();
      }
    });
  }

  test(`polish step4 — heavy hardware stash programs in viewport @ ${vp.name}`, async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
      await resumeFixture(page, fixtures.playHeavyHardware);
      if (vp.phone) {
        await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openPlayStashPanel());
        await page.waitForTimeout(250);
      } else {
        await page.waitForTimeout(400);
      }
      const m = await page.evaluate(
        (keys) => window.__GB_LAYOUT_AUDIT__.measureLayoutKeysInViewport(keys),
        STASH_KEYS,
      );
      assertViewport(vp.name, m.ok, JSON.stringify(m), { suite: "polish-step4", label: "measure" });
    } finally {
      await browser.close();
    }
  });

  test(`polish step4 — shop LOAN cards in viewport @ ${vp.name}`, async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
      await resumeFixture(page, fixtures.shopBusy);
      await page.waitForTimeout(350);
      const shop = await page.evaluate(() => {
        const layout = window.__GB_LAYOUT_AUDIT__.measureLayoutKeysInViewport(["shop-layout"]);
        const btn = document.querySelector('[data-layout-key="shop-buy-button"]');
        if (!btn) return layout;
        const r = btn.getBoundingClientRect();
        const vh = window.innerHeight;
        const btnOk = r.width > 8 && r.height > 8 && r.top >= -2 && r.bottom <= vh + 2;
        return { ok: layout.ok && btnOk, layout, btnTop: r.top, btnBottom: r.bottom, vh };
      });
      assertViewport(vp.name, shop.ok, JSON.stringify(shop), { suite: "polish-step4", label: "shop" });
    } finally {
      await browser.close();
    }
  });

  test(`polish step4 — gamble card in viewport @ ${vp.name}`, async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
      await resumeFixture(page, fixtures.run);
      await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openGambleDemo());
      await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__.getPhase() === "GAMBLE", { timeout: 12_000 });
      await page.waitForTimeout(350);
      const gamble = await page.evaluate(() =>
        window.__GB_LAYOUT_AUDIT__.measureLayoutKeysInViewport(["gamble-card"]),
      );
      assertViewport(vp.name, gamble.ok, JSON.stringify(gamble), { suite: "polish-step4", label: "gamble" });
    } finally {
      await browser.close();
    }
  });

  test(`polish step4 — shop tutorial COPY THAT in viewport @ ${vp.name}`, async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
      await resumeFixture(page, fixtures.shop);
      await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openTutorialCoachShop());
      await page.waitForSelector('[data-layout-key="tutorial-coach-ack"]', { timeout: 8000 });
      await page.waitForTimeout(400);
      const m = await page.evaluate(() =>
        window.__GB_LAYOUT_AUDIT__.measureLayoutKeysInViewport(["tutorial-coach-ack", "tutorial-coach-dismiss"]),
      );
      assertViewport(vp.name, m.ok, JSON.stringify(m), { suite: "polish-step4", label: "measure" });
      const hit = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.measureElementHitTarget('[data-layout-key="tutorial-coach-ack"]'));
      assertViewport(vp.name, hit.ok, JSON.stringify(hit), { suite: "polish-step4", label: "hit" });
    } finally {
      await browser.close();
    }
  });

  test(`polish step4 — typography and tappable labels @ ${vp.name}`, async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
      await resumeFixture(page, fixtures.playHeavyHardware);
      await page.waitForTimeout(350);
      const playAudit = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.auditVisibleTypography(11));
      assertViewport(vp.name, playAudit.ok, JSON.stringify(playAudit), {
        suite: "polish-step4",
        label: "play audit",
      });
      const history = fixtures.rapSheetHistory8().history;
      await page.evaluate((rows) => window.__GB_LAYOUT_AUDIT__.openRapSheetDemo(rows), history);
      await page.waitForSelector('[data-layout-key="rap-sheet"]', { timeout: 8000 });
      await page.waitForTimeout(300);
      const rapAudit = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.auditVisibleTypography(11));
      assertViewport(vp.name, rapAudit.ok, JSON.stringify(rapAudit), {
        suite: "polish-step4",
        label: "rap audit",
      });
    } finally {
      await browser.close();
    }
  });

  test(`polish step4 — run intel HIDE/DETAILS hit @ ${vp.name}`, async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
      await resumeFixture(page, fixtures.playHeavyHardware);
      await page.waitForTimeout(400);
      const intelHits = await page.evaluate(() => {
        const vw = window.innerWidth;
        const collapse = document.querySelector('[data-layout-key="run-intel-collapse-toggle"]');
        const detailsBtn = document.querySelector('[data-layout-key="run-intel-details-toggle"]');
        if (vw < 768 || !detailsBtn) {
          return { ok: true, skipped: true, vw };
        }
        if (vw >= 768 && vw < 1024 && window.innerHeight > 900) {
          return { ok: true, skipped: true, reason: "tablet-portrait-stash-drawer", vw };
        }
        const hide = collapse ? window.__GB_LAYOUT_AUDIT__.probeRunIntelHideHit() : { ok: true, skipped: true };
        const details = window.__GB_LAYOUT_AUDIT__.probeRunIntelDetailsHit();
        return {
          ok: (hide.ok || hide.skipped) && details.ok,
          hide,
          details,
          vw,
        };
      });
      assertViewport(vp.name, intelHits.ok, JSON.stringify(intelHits), {
        suite: "polish-step4",
        label: "intel hits",
      });
    } finally {
      await browser.close();
    }
  });

  test(`polish step4 — stuck recovery overlay in viewport @ ${vp.name}`, async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
      await resumeFixture(page, fixtures.playStashOpen844);
      await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.triggerStuckRecoveryDemo());
      await page.waitForSelector('[data-layout-key="stuck-recovery-continue"]', { timeout: 8000 });
      const m = await page.evaluate(() =>
        window.__GB_LAYOUT_AUDIT__.measureLayoutKeysInViewport(["stuck-recovery-continue"]),
      );
      assertViewport(vp.name, m.ok, JSON.stringify(m), { suite: "polish-step4", label: "measure" });
      const hit = await page.evaluate(() =>
        window.__GB_LAYOUT_AUDIT__.measureElementHitTarget('[data-layout-key="stuck-recovery-continue"]'),
      );
      assertViewport(vp.name, hit.ok, JSON.stringify(hit), { suite: "polish-step4", label: "hit" });
    } finally {
      await browser.close();
    }
  });

  if (vp.phone) {
    test(`polish step4 — shop BUY elementFromPoint @ ${vp.name}`, async () => {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      try {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
        await resumeFixture(page, fixtures.shop);
        await page.waitForTimeout(400);
        await page.locator('[data-tutorial="shop-panel"]').evaluate((el) => {
          el.scrollTop = el.scrollHeight;
        });
        const buy = page.locator('[data-layout-key="shop-buy-button"]').first();
        await buy.scrollIntoViewIfNeeded();
        await page.waitForTimeout(250);
        const hit = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.probeShopBuyHit());
        assertViewport(vp.name, hit.ok, JSON.stringify(hit), { suite: "polish-step4", label: "hit" });
      } finally {
        await browser.close();
      }
    });
  }
}

test("polish step4 — 844×390 off-screen layout key budget", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
    const scenarios = [
      () => resumeFixture(page, fixtures.playStashOpen844),
      async () => {
        await resumeFixture(page, fixtures.playStashOpen844);
        await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openScoreBreakdownDemo());
        await page.waitForTimeout(400);
      },
      () => resumeFixture(page, fixtures.shopBusy),
      () => resumeFixture(page, fixtures.gamble),
    ];
    let maxCount = 0;
    for (const run of scenarios) {
      await run();
      const { count } = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.countOffscreenLayoutKeys());
      maxCount = Math.max(maxCount, count);
    }
    assertViewport(
      "844x390",
      maxCount <= OFFSCREEN_CLIP_BUDGET_844,
      `off-screen clips ${maxCount} exceed budget ${OFFSCREEN_CLIP_BUDGET_844}`,
      { suite: "polish-step4", label: "844 off-screen budget" },
    );
  } finally {
    await browser.close();
  }
});

test("source — polish step4 layout hooks present", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(html, /measureScoreOverlayVsStash/);
  assert.match(html, /openTutorialCoachShop/);
  assert.match(html, /countOffscreenLayoutKeys/);
  assert.match(html, /triggerStuckRecoveryDemo/);
  assert.match(html, /--gb-play-stash-reserve/);
});
