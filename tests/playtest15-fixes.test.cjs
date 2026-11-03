"use strict";
/**
 * Playtest 15: intel layout, score tick, overlay guard, forfeit, smelling salts.
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

test("source — heat counter animation is monotonic (no overshoot)", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(html, /displayScoreRef\.current/);
  assert.doesNotMatch(html, /overshoot.*displayScore|peak = to \+ overshoot/s);
  assert.match(html, /Math\.min\(next, to\)/);
});

test("source — score resolution hides mult until mult phase", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(html, /setMultPhase\(true\)/);
  assert.match(html, /multShown != null \? `\$\{multShown\.toFixed\(2\)\}x` : '…'/);
});

test("source — overlay click-through guard scopes shop purchases", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(html, /consumeNextClickRef/);
  assert.match(html, /armClickThroughGuard/);
  assert.match(html, /FORFEIT \/ ABANDON RUN/);
  assert.match(html, /ensureEarlySmellingSalts/);
  assert.match(html, /data-layout-key="rap-sheet-run-summary"/);
});

test("source — inline run intel uses fixed-height chip summary", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(html, /RunIntelSummary/);
  assert.match(html, /run-intel-summary--inline/);
  assert.match(html, /run-intel-chip-row/);
});

const VIEWPORTS = [{ name: "1280x690", width: 1280, height: 690 }];

for (const vp of VIEWPORTS) {
  test(`e2e — play stash intel readable, no hardware scrollbar @ ${vp.name}`, async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
      const payload = plain(
        createGame(fixtures.snapshot()).api.normalizeSavedRun(fixtures.playHeavyHardware()),
      );
      await page.evaluate(
        ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
        { key: RUN_KEY, data: payload },
      );
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
      await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
      await page.waitForSelector('[data-layout-key="run-intel-summary"]', { timeout: 12_000 });
      const metrics = await page.evaluate(() => {
        const panel = document.querySelector('[data-layout-key="run-intel-summary"]');
        const chips = panel?.querySelector('[data-layout-key="run-intel-chip-row"]');
        if (!panel || !chips) return { ok: false, reason: "no inline intel summary" };
        const style = getComputedStyle(panel);
        const fontPx = parseFloat(style.fontSize) || 0;
        const panelRect = panel.getBoundingClientRect();
        const chipsRect = chips.getBoundingClientRect();
        return {
          ok:
            fontPx >= 8 &&
            style.overflowY === "hidden" &&
            chipsRect.width <= panelRect.width + 2,
          fontPx,
          scrollH: panel.scrollHeight,
          clientH: panel.clientHeight,
        };
      });
      assert.ok(metrics.ok, JSON.stringify(metrics));
    } finally {
      await browser.close();
    }
  });
}

const SHOP_INTEL_VIEWPORTS = [
  { name: "1280x690", width: 1280, height: 690 },
  { name: "390x844", width: 390, height: 844 },
];

for (const vp of SHOP_INTEL_VIEWPORTS) {
  test(`e2e — shop run intel route text not clipped @ ${vp.name}`, async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
      const payload = plain(
        createGame(fixtures.snapshot()).api.normalizeSavedRun(fixtures.shopBusy()),
      );
      payload.currentRouteEffect = {
        name: "PAWN SHOP",
        effects: ["Quota x1.40 (scaled by round curve)", "Stash to 100% on pick", "+$15 cash on pick"],
      };
      await page.evaluate(
        ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
        { key: RUN_KEY, data: payload },
      );
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
      await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
      await page.waitForSelector('[data-layout-key="shop-route-card"]', { timeout: 12_000 });
      const metrics = await page.evaluate(() => {
        const floating = document.querySelector('[data-layout-key="run-intel-floating"]');
        if (floating && getComputedStyle(floating).display !== "none") {
          return { ok: false, reason: "floating intel must not cover shop routes" };
        }
        const card = document.querySelector('[data-layout-key="shop-route-card"]');
        if (!card) return { ok: false, reason: "missing route card" };
        const r = card.getBoundingClientRect();
        const cx = r.x + r.width / 2;
        const cy = r.y + r.height / 2;
        const hit = document.elementFromPoint(cx, cy);
        const tappable = !!(hit && (hit === card || card.contains(hit)));
        const vw = window.innerWidth;
        const routeText = (card.innerText || "").replace(/\s+/g, " ");
        return {
          ok: tappable && r.right <= vw + 2 && /ROUTE|ALLEY|QUOTA/i.test(routeText),
          tappable,
          cardRight: r.right,
          routeText,
          vw,
        };
      });
      assert.ok(metrics.ok, JSON.stringify(metrics));
    } finally {
      await browser.close();
    }
  });
}
