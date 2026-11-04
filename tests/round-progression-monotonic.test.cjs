"use strict";
/** Round and quota must not regress after round-clear → shop → streets (stale pending transition guard). */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");

const ROOT = path.join(__dirname, "..");
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

async function bootToPlay(page) {
  await page.goto(`${baseUrl}/index.html?e2e=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__GB_E2E__, { timeout: 45_000 });
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__GB_E2E__.startNewRun());
  await page.waitForFunction(() => window.__GB_E2E__.getState().phase === "PLAY", { timeout: 20_000 });
}

test("round and target never regress across two round clears", { timeout: 120_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  try {
    await bootToPlay(page);
    const seen = [];
    for (let cycle = 0; cycle < 2; cycle += 1) {
      const before = await page.evaluate(() => window.__GB_E2E__.getState());
      seen.push({ round: before.round, target: before.target, phase: before.phase });
      await page.evaluate(() => {
        const e = window.__GB_E2E__;
        const s = e.getState();
        e.setScore(s.target);
        e.setPlaysRemaining(0);
        e.forceRoundWin();
      });
      await page.waitForFunction(
        () => {
          const s = window.__GB_E2E__.getState();
          return s.roundClearVisible || s.phase === "SHOP" || s.phase === "GAMBLE";
        },
        { timeout: 20_000 },
      );
      await page.waitForFunction(
        () => window.__GB_E2E__.getState().roundClearCanContinue || window.__GB_E2E__.getState().phase !== "PLAY",
        { timeout: 15_000 },
      ).catch(() => {});
      await page.evaluate(() => window.__GB_E2E__.finishRoundClear());
      await page.waitForFunction(
        () => {
          const s = window.__GB_E2E__.getState();
          return s.phase === "SHOP" || s.phase === "GAMBLE";
        },
        { timeout: 20_000 },
      );
      if ((await page.evaluate(() => window.__GB_E2E__.getState())).phase === "GAMBLE") {
        await page.evaluate(() => window.__GB_E2E__.takeSafeCut());
        await page.waitForFunction(() => window.__GB_E2E__.getState().phase === "SHOP", { timeout: 12_000 });
      }
      const shop = await page.evaluate(() => window.__GB_E2E__.getState());
      seen.push({ round: shop.round, target: shop.target, phase: shop.phase });
      await page.locator('[data-layout-key="shop-route-card"]').first().click({ timeout: 8000 });
      await page.evaluate(() => window.__GB_E2E__.hitStreets());
      await page.waitForFunction(() => window.__GB_E2E__.getState().phase === "PLAY", { timeout: 25_000 });
      const play = await page.evaluate(() => window.__GB_E2E__.getState());
      seen.push({ round: play.round, target: play.target, phase: play.phase });
      await page.evaluate(() => {
        window.__GB_E2E__.dismissOverlays?.();
        window.__GB_E2E__.finishRoundClear?.();
      });
    }
    for (let i = 1; i < seen.length; i += 1) {
      const prev = seen[i - 1];
      const cur = seen[i];
      assert.ok(cur.round >= 1, JSON.stringify(cur));
      if (typeof prev.round === "number" && typeof cur.round === "number") {
        assert.ok(
          cur.round >= prev.round,
          `round regressed: ${JSON.stringify({ prev, cur, seen })}`,
        );
      }
      if (
        typeof prev.target === "number"
        && typeof cur.target === "number"
        && cur.phase === "PLAY"
        && prev.phase === "PLAY"
        && cur.round === prev.round
      ) {
        assert.ok(cur.target >= prev.target, `target regressed: ${JSON.stringify({ prev, cur })}`);
      }
    }
    const rounds = seen.map((s) => s.round).filter((r) => typeof r === "number");
    assert.ok(Math.max(...rounds) >= 2, `expected round progression, saw ${JSON.stringify(seen)}`);
  } finally {
    await browser.close();
  }
});
