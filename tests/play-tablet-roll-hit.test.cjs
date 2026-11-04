"use strict";
/** Tablet portrait: ROLL 'EM must be hit-testable at center (768×1024, round 4+ play). */
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

test("ROLL 'EM hit-test @ 768x1024 (round 4 play)", { timeout: 120_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 768, height: 1024 } });
  try {
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
    const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(fixtures.shopBusy()));
    payload.phase = "PLAY";
    payload.round = 4;
    payload.hasRolled = false;
    payload.hands = 4;
    payload.score = 0;
    await page.evaluate(
      ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
      { key: RUN_KEY, data: payload },
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__?.getPhase?.() === "PLAY", { timeout: 15_000 });
    await page.waitForTimeout(350);
    const m = await page.evaluate(() => {
      const btn = document.querySelector('[data-tutorial="roll-btn"]');
      if (!btn || btn.disabled) return { ok: false, reason: "missing or disabled roll btn" };
      const r = btn.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return { ok: false, reason: "zero size", rect: r };
      const cx = r.x + r.width / 2;
      const cy = r.y + r.height / 2;
      const el = document.elementFromPoint(cx, cy);
      const ok = !!(el && (btn === el || btn.contains(el)));
      return { ok, rect: { w: r.width, h: r.height, top: r.top, bottom: r.bottom }, cx, cy, blocker: ok ? null : el?.tagName };
    });
    assert.ok(m.ok, JSON.stringify(m));
  } finally {
    await browser.close();
  }
});
