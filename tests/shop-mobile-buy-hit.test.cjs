"use strict";
/** At phone widths, at least one shop BUY must be hit-testable at its center (elementFromPoint). */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const { createGame, plain } = require("./helpers/game.cjs");
const fixtures = require("./fixtures/runs.cjs");
const { assertViewport, phonePortraitBlockingEnabled } = require("./helpers/phone-portrait.cjs");

const ROOT = path.join(__dirname, "..");
const RUN_KEY = "gutterbones1977:run:v1";

const PHONE_VIEWPORTS = [
  { name: "360x640", width: 360, height: 640 },
  { name: "390x844", width: 390, height: 844 },
  { name: "412x915", width: 412, height: 915 },
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

async function resumeShopBusy(page) {
  const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(fixtures.shopBusy()));
  await page.evaluate(
    ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
    { key: RUN_KEY, data: payload },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__?.getPhase?.() === "SHOP", { timeout: 15_000 });
}

function probeBuyButtons() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const buys = [...document.querySelectorAll('[data-layout-key="shop-buy-button"]')].filter((b) => !b.disabled);
  const hits = [];
  for (const b of buys) {
    const cs = getComputedStyle(b);
    if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) continue;
    const r = b.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    if (cx < 0 || cy < 0 || cx > W || cy > H) continue;
    const el = document.elementFromPoint(cx, cy);
    const ok = !!(el && (b === el || b.contains(el)));
    hits.push({ ok, w: r.width, h: r.height, cx, cy, text: (b.innerText || "").trim().slice(0, 40) });
  }
  return {
    buyCount: buys.length,
    hitCount: hits.filter((h) => h.ok).length,
    hits,
  };
}

for (const vp of PHONE_VIEWPORTS) {
  test(`shop BUY hit-test @ ${vp.name}`, { timeout: 120_000 }, async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
      await resumeShopBusy(page);
      let m = await page.evaluate(probeBuyButtons);
      if (m.hitCount < 1) {
        await page.waitForTimeout(600);
        m = await page.evaluate(probeBuyButtons);
      }
      const label = `BUY hit-test (${m.hitCount}/${m.buyCount} tappable)`;
      assertViewport(vp.name, m.buyCount >= 1, JSON.stringify(m), {
        suite: "shop-mobile-buy-hit",
        label,
      });
      assertViewport(vp.name, m.hitCount >= 1, JSON.stringify(m), {
        suite: "shop-mobile-buy-hit",
        label,
      });
      if (m.hitCount < 1 && !phonePortraitBlockingEnabled()) {
        console.warn(`[phone non-blocking] ${vp.name}: ${label}\n${JSON.stringify(m)}`);
      }
    } finally {
      await browser.close();
    }
  });
}
