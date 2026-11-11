"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.join(__dirname, "..");
const { createGame, plain } = require(path.join(ROOT, "tests/helpers/game.cjs"));
const fixtures = require(path.join(ROOT, "tests/fixtures/runs.cjs"));

(async () => {
  const server = http.createServer((req, res) => {
    const p = path.join(ROOT, "index.html");
    res.setHeader("Content-Type", "text/html");
    fs.createReadStream(p).pipe(res);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${base}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
  const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(fixtures.playHeavyHardware()));
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), {
    key: "gutterbones1977:run:v1",
    data: payload,
  });
  await page.reload();
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
  await page.waitForTimeout(400);
  const out = await page.evaluate(() => {
    const detail = window.__GB_LAYOUT_AUDIT__.probeRunIntelDetailsHit();
    const hide = window.__GB_LAYOUT_AUDIT__.probeRunIntelHideHit();
    const stack = (cx, cy) =>
      (document.elementsFromPoint(cx, cy) || []).slice(0, 8).map((n) => ({
        tag: n.tagName,
        key: n.getAttribute?.("data-layout-key"),
        cls: String(n.className || "").slice(0, 60),
      }));
    return { detail, hide, detailStack: stack(detail.cx, detail.cy), hideStack: stack(hide.cx, hide.cy) };
  });
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
  await new Promise((r) => server.close(r));
})();
