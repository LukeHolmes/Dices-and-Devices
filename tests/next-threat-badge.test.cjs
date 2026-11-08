"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const http = require("node:http");
const fs = require("node:fs");
const { createGame, plain } = require("./helpers/game.cjs");
const fixtures = require("./fixtures/runs.cjs");
const { assertViewport, isNonBlockingViewport, phonePortraitBlockingEnabled } = require("./helpers/phone-portrait.cjs");

const ROOT = path.join(__dirname, "..");
const ARTIFACT_DIR = "/opt/cursor/artifacts";
const RUN_KEY = "gutterbones1977:run:v1";
const BLOCKING = [
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1920x1080", width: 1920, height: 1080 },
];

let server;
let baseUrl;
let chromium;

before(async () => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
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

async function resume(page, builder) {
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

test("shop — RAID route shows THE RAID as next threat", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
    await resume(page, fixtures.shopRound9RaidRefreshable);
    const badge = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.readNextThreatBadge());
    assert.equal(badge.visible, true);
    assert.match(badge.headline, /NEXT THREAT/i);
    assert.match(badge.bossName, /THE RAID/i);
  } finally {
    await browser.close();
  }
});

test("shop — selecting LOAN SHARK turf updates threat label", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
    await resume(page, () => {
      const base = fixtures.shopBusy();
      const paths = [
        { id: "LOCAL", name: "BACK ALLEY", desc: "Quiet.", mod: 1, color: "border-gray-600 text-gray-400" },
        {
          id: "SHARK_TURF",
          name: "SHARK TURF",
          desc: "Debt job.",
          mod: 1.2,
          color: "border-red-600 text-red-600",
          bossId: "LOAN_SHARK",
        },
      ];
      return { ...base, paths, selectedShopPathId: null };
    });
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.selectShopPathById("SHARK_TURF"));
    await page.waitForTimeout(200);
    const badge = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.readNextThreatBadge());
    assert.match(badge.bossName, /LOAN SHARK/i);
  } finally {
    await browser.close();
  }
});

test("play — boss round shows BOSS NOW", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
    await resume(page, fixtures.playRaidRound9);
    const badge = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.readNextThreatBadge());
    assert.equal(badge.visible, true);
    assert.match(badge.headline, /BOSS NOW/i);
    assert.match(badge.bossName, /THE RAID/i);
  } finally {
    await browser.close();
  }
});

test("play — non-boss round hides badge", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
    await resume(page, fixtures.run);
    const badge = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.readNextThreatBadge());
    assert.equal(badge.visible, false);
    assert.equal(badge.bossName, "");
  } finally {
    await browser.close();
  }
});

for (const vp of BLOCKING) {
  test(`next threat in viewport — shop @ ${vp.name}`, async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
      await resume(page, fixtures.shopRound9RaidRefreshable);
      const badge = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.readNextThreatBadge());
      assertViewport(vp.name, badge.visible, JSON.stringify(badge), { suite: "next-threat-badge", label: "shop" });
      if (isNonBlockingViewport(vp.name) && !phonePortraitBlockingEnabled()) return;
      assert.ok(badge.visible, JSON.stringify(badge));
    } finally {
      await browser.close();
    }
  });

  test(`next threat in viewport — play boss @ ${vp.name}`, async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
      await resume(page, fixtures.playRaidRound9);
      const badge = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.readNextThreatBadge());
      assertViewport(vp.name, badge.visible, JSON.stringify(badge), { suite: "next-threat-badge", label: "play" });
      if (isNonBlockingViewport(vp.name) && !phonePortraitBlockingEnabled()) return;
      assert.ok(badge.visible, JSON.stringify(badge));
    } finally {
      await browser.close();
    }
  });
}

test("detail popover — close stays in viewport @ 1366x768", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
    await resume(page, fixtures.shopRound9RaidRefreshable);
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openNextThreatBadgeDetail());
    await page.waitForSelector('[data-layout-key="next-threat-badge-close"]', { timeout: 5000 });
    const closeOk = await page.evaluate(() => {
      const el = document.querySelector('[data-layout-key="next-threat-badge-close"]');
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      return r.width >= 32 && r.height >= 32 && r.bottom <= vh && r.right <= vw;
    });
    assert.ok(closeOk, "close button in viewport");
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "next-threat-shop-detail-1366x768.png") });
  } finally {
    await browser.close();
  }
});

test("screenshots — PLAY and SHOP badges", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    for (const [label, vp, builder] of [
      ["play", { width: 1366, height: 768 }, fixtures.playRaidRound9],
      ["play", { width: 768, height: 1024 }, fixtures.playRaidRound9],
      ["shop", { width: 1366, height: 768 }, fixtures.shopRound9RaidRefreshable],
      ["shop", { width: 768, height: 1024 }, fixtures.shopRound9RaidRefreshable],
    ]) {
      await page.setViewportSize(vp);
      await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
      await resume(page, builder);
      await page.waitForTimeout(300);
      const vpName = `${vp.width}x${vp.height}`;
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, `next-threat-${label}-${vpName}.png`),
        fullPage: false,
      });
    }
  } finally {
    await browser.close();
  }
});
