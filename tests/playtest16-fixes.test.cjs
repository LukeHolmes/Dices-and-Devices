"use strict";
/**
 * Playtest 16: forfeit rap sheet, intel fit, smelling salts exclusivity, score display reset.
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

test("source — forfeit clears overlays and tracks exclusive shop ids", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(html, /forceClearPresentationOverlays/);
  assert.match(html, /openForfeitRapSheetDemo/);
  assert.match(html, /runExclusiveShopIds/);
  assert.match(html, /requestScoreOverlayDismiss/);
  assert.match(html, /resetRoundScoreDisplay/);
  assert.match(html, /roundClearCardActive && phase !== 'RAP_SHEET'/);
  assert.doesNotMatch(html, /setSoldItems\(prev => prev\.filter\(id => id !== item\.id\)\)/);
});

test("rules — smelling salts purchase marks run-exclusive shop id", () => {
  const item = {
    id: "SMELLING_SALTS",
    name: "Smelling Salts",
    type: "consumable",
    cost: 24,
    rarity: "common",
  };
  const g = createGame(fixtures.snapshot({ phase: "SHOP", gold: 50, shopItems: [item] }));
  g.api.handlePurchase(item);
  assert.equal(g.state("pillRunBonus"), 2);
  assert.ok(g.state("runExclusiveShopIds").includes("SMELLING_SALTS"));
});

test("source — round advance resets heat display with score", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(html, /setScore\(0\);\s*\n\s*resetRoundScoreDisplay\(\)/);
});

const INTEL_VIEWPORTS = [
  { name: "1280x690", width: 1280, height: 690 },
  { name: "390x844", width: 390, height: 844 },
  { name: "844x390", width: 844, height: 390 },
];

for (const vp of INTEL_VIEWPORTS) {
  test(`e2e — inline run intel fully visible @ ${vp.name}`, async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
      const payload = plain(
        createGame(fixtures.snapshot()).api.normalizeSavedRun(fixtures.playHeavyHardware()),
      );
      payload.currentRouteEffect = {
        name: "TEST ROUTE",
        effects: ["Quota x1.40 (scaled by round curve)", "Stash to 100% on pick"],
      };
      await page.evaluate(
        ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
        { key: RUN_KEY, data: payload },
      );
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
      await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
      if (vp.width < 768) {
        await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openPlayStashPanel());
        await page.waitForSelector('[data-layout-key="play-stash"].flex', { timeout: 8000 });
      }
      await page.waitForSelector('[data-layout-key="run-intel-inline"]', { timeout: 12_000 });
      await page.waitForTimeout(400);
      const metrics = await page.evaluate(() => {
        const panel = document.querySelector('[data-layout-key="run-intel-inline"]');
        const body = panel?.querySelector(".run-intel-body");
        const route = panel?.querySelector(".run-intel-route-copy");
        const boss = panel?.textContent || "";
        if (!panel || !body) return { ok: false, reason: "missing intel" };
        const routeClipped = route ? route.scrollHeight > route.clientHeight + 2 : false;
        const panelOverflow = panel.scrollHeight > panel.clientHeight + 3;
        const loadout = panel?.querySelector('[data-layout-key="run-intel-inline-loadout"]');
        const loadoutText = loadout?.textContent || "";
        const hasBossSection = loadoutText.includes("BOSS");
        const hasHardware = loadoutText.includes("RIG");
        return {
          scaled: panel?.dataset?.intelScaled || null,
          ok:
            !routeClipped &&
            hasBossSection &&
            hasHardware &&
            (panel.scrollHeight <= panel.clientHeight + 4 || !!panel?.dataset?.intelScaled),
          panelOverflow,
          routeClipped,
          scrollH: panel.scrollHeight,
          clientH: panel.clientHeight,
          hasBossSection,
          hasHardware,
        };
      });
      assert.ok(metrics.ok, JSON.stringify(metrics));
    } finally {
      await browser.close();
    }
  });
}

test("e2e — forfeit rap sheet bright, aligned, no round-clear overlay", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1280, height: 690 });
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openForfeitRapSheetDemo());
    await page.waitForSelector('[data-layout-key="rap-sheet"]', { timeout: 12_000 });
    await page.waitForTimeout(300);
    const metrics = await page.evaluate(() => {
      const sheet = document.querySelector('[data-layout-key="rap-sheet"]');
      const gate = document.querySelector('[data-layout-key="rap-reveal-gate"]');
      const roundClear = document.querySelector('[data-layout-key="round-clear-card"]');
      const align = window.__GB_LAYOUT_AUDIT__?.measureRapSheetStatAlignment?.();
      const style = sheet ? getComputedStyle(sheet) : null;
      const flat = sheet?.classList.contains("paper-card-flat");
      const anim = style?.animationName || "";
      return {
        ok:
          !gate &&
          !roundClear &&
          flat &&
          anim === "none" &&
          align?.ok === true,
        gate: !!gate,
        roundClear: !!roundClear,
        flat,
        anim,
        align,
      };
    });
    assert.ok(metrics.ok, JSON.stringify(metrics));
  } finally {
    await browser.close();
  }
});

test("e2e — rap hand history scores align to rows", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1280, height: 690 });
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
    const history = fixtures.rapSheetHistory3().history;
    await page.evaluate((rows) => window.__GB_LAYOUT_AUDIT__.openRapSheetDemo(rows), history);
    await page.waitForSelector('[data-layout-key="rap-sheet-history-row"]', { timeout: 12_000 });
    const metrics = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('[data-layout-key="rap-sheet-history-row"]'));
      const bad = rows.map((row) => {
        const label = row.children[0];
        const score = row.querySelector(".rap-sheet-history-score");
        if (!label || !score) return { reason: "missing cells" };
        const a = label.getBoundingClientRect();
        const b = score.getBoundingClientRect();
        const delta = Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2);
        return delta > 10 ? { delta, label: label.textContent?.slice(0, 24) } : null;
      }).filter(Boolean);
      const more = document.querySelector('[data-layout-key="rap-sheet-history-more"]');
      return { ok: bad.length === 0, bad, rowCount: rows.length, hasMoreLine: !!more };
    });
    assert.ok(metrics.ok, JSON.stringify(metrics));
    assert.ok(metrics.rowCount >= 3);
  } finally {
    await browser.close();
  }
});
