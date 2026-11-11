"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const { createGame, plain } = require("./helpers/game.cjs");
const fixtures = require("./fixtures/runs.cjs");

const ROOT = path.join(__dirname, "..");
const RUN_KEY = "gutterbones1977:run:v1";
const SETTINGS_KEY = "gutterbones1977:settings:v1";

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

async function seedPlayBlood6(page) {
  const payload = plain(
    createGame(fixtures.snapshot()).api.normalizeSavedRun(plain(fixtures.playBlood6Carved())),
  );
  await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 90_000 });
  await page.evaluate(
    ({ key, data, settingsKey }) => {
      localStorage.setItem(key, JSON.stringify(data));
      localStorage.setItem(
        settingsKey,
        JSON.stringify({ tutorialCompleted: true, skippedAlleyIntro: true, reducedMotionPref: true }),
      );
    },
    { key: RUN_KEY, data: payload, settingsKey: SETTINGS_KEY },
  );
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 90_000 });
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
  await page.waitForFunction(
    () => document.getElementById("root-gutterbones")?.dataset.phase === "PLAY",
    { timeout: 60_000 },
  );
}

function assertPanelIsolatesPlayfield(page) {
  return page.evaluate(() => {
    const root = document.getElementById("root-gutterbones");
    const panel = document.querySelector('[data-layout-key="upgrade-intel-panel"]');
    const backdrop = document.querySelector('[data-layout-key="upgrade-intel-backdrop"]');
    if (!panel || !backdrop) return { ok: false, reason: "missing panel" };
    if (root?.dataset.upgradeIntelOpen !== "1") return { ok: false, reason: "upgrade-intel-open flag missing" };
    const panelRect = panel.getBoundingClientRect();
    const offenders = [];
    const samplePanel = (el) => {
      const r = el.getBoundingClientRect();
      for (let xi = 0; xi <= 4; xi++) {
        for (let yi = 0; yi <= 4; yi++) {
          const x = r.left + (r.width * xi) / 4;
          const y = r.top + (r.height * yi) / 4;
          if (x < panelRect.left || x > panelRect.right || y < panelRect.top || y > panelRect.bottom) continue;
          const top = document.elementFromPoint(x, y);
          if (!top) continue;
          if (!panel.contains(top) && top !== backdrop && !backdrop.contains(top)) {
            offenders.push({
              label: el.textContent?.trim()?.slice(0, 16) || el.getAttribute("data-layout-key"),
              hit: top.getAttribute?.("data-layout-key") || top.className?.slice?.(0, 40),
            });
          }
        }
      }
    };
    panel.querySelectorAll("dt, dd").forEach(samplePanel);
    document.querySelectorAll(".bone-pill-control").forEach((pill) => {
      const pr = pill.getBoundingClientRect();
      const cx = (pr.left + pr.right) / 2;
      const cy = (pr.top + pr.bottom) / 2;
      if (cx < panelRect.left || cx > panelRect.right || cy < panelRect.top || cy > panelRect.bottom) return;
      const top = document.elementFromPoint(cx, cy);
      if (top && !panel.contains(top)) {
        offenders.push({ label: "pill", hit: top.className?.slice(0, 40) });
      }
    });
    const shell = document.querySelector(".gb-app-shell");
    const shellPe = shell ? getComputedStyle(shell).pointerEvents : "";
    return {
      ok: offenders.length === 0 && shellPe === "none",
      offenders: offenders.slice(0, 8),
      shellPe,
    };
  });
}

test("upgrade intel modal — no playfield bleed on panel @ 768x1024", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 768, height: 1024 } });
  try {
    await seedPlayBlood6(page);
    const handsBefore = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.getState?.().hands);
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openUpgradeIntel("BLOOD_6"));
    await page.waitForSelector('[data-layout-key="upgrade-intel-panel"]', { timeout: 8000 });
    let iso = await assertPanelIsolatesPlayfield(page);
    assert.equal(iso.ok, true, JSON.stringify(iso));
    await page.evaluate(() => {
      const panel = document.querySelector('[data-layout-key="upgrade-intel-panel"]');
      panel.scrollTop = panel.scrollHeight;
    });
    iso = await assertPanelIsolatesPlayfield(page);
    assert.equal(iso.ok, true, `after scroll: ${JSON.stringify(iso)}`);
    await page.mouse.click(120, 420);
    const handsAfterClick = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.getState?.().hands);
    assert.equal(handsAfterClick, handsBefore, "background click should not change run state");
    const btn = page.locator('[data-layout-key="bone-face-intel-1"]');
    await btn.evaluate((el) => el.click());
    await page.waitForSelector('[data-layout-key="upgrade-intel-panel"]');
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () => !document.querySelector('[data-layout-key="upgrade-intel-panel"]'),
      { timeout: 8000 },
    );
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("data-layout-key"));
    assert.equal(focused, "bone-face-intel-1", `focus after Escape: ${focused}`);
  } finally {
    await browser.close();
  }
});

test("shop ENGINE ? — intel control in viewport @ 768x1024", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 768, height: 1024 } });
  try {
    const shopBase = plain(fixtures.shop());
    shopBase.shopItems = [
      {
        id: "ENGINE",
        name: "The Engine",
        desc: "Slot 1 adds mult for each higher-value bone to its right. Max +4.",
        cost: 25,
        rarity: "rare",
      },
      ...(shopBase.shopItems || []),
    ].slice(0, 6);
    const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(shopBase));
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 90_000 });
    await page.evaluate(
      ({ key, data, settingsKey }) => {
        localStorage.setItem(key, JSON.stringify(data));
        localStorage.setItem(
          settingsKey,
          JSON.stringify({ tutorialCompleted: true, skippedAlleyIntro: true, reducedMotionPref: true, tipSeenShop: true }),
        );
      },
      { key: RUN_KEY, data: payload, settingsKey: SETTINGS_KEY },
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 90_000 });
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
    await page.waitForFunction(
      () => document.getElementById("root-gutterbones")?.dataset.phase === "SHOP",
      { timeout: 60_000 },
    );
    let found = false;
    for (let pageIdx = 0; pageIdx < 4 && !found; pageIdx++) {
      const labels = await page.locator(".shop-item-card .font-bold").allTextContents();
      if (labels.some((t) => /engine/i.test(t))) {
        const card = page.locator(".shop-item-card").filter({ hasText: /engine/i }).first();
        const intel = card.locator('[data-layout-key="shop-intel-button"]');
        await intel.scrollIntoViewIfNeeded();
        const box = await intel.boundingBox();
        assert.ok(box && box.width >= 28 && box.height >= 28, "ENGINE ? tap box");
        assert.ok(box.y >= 0 && box.y + box.height <= 1024, "ENGINE ? within viewport height");
        found = true;
        break;
      }
      const next = page.locator('[data-layout-key="shop-item-pagination"] button[aria-label="Next stock page"]');
      if (await next.isEnabled()) await next.click();
    }
    assert.ok(found, "ENGINE offer not found in shop pagination");
  } finally {
    await browser.close();
  }
});
