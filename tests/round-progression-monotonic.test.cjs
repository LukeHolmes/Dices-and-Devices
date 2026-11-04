"use strict";
/** Round and quota must not regress after round-clear → shop → streets (stale pending transition guard). */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");

const ROOT = path.join(__dirname, "..");
const BOT_FN = require("node:fs").readFileSync(path.join(__dirname, "sim/in-page-bot.js"), "utf8");
const RIDS = [46, 70, 82, 110, 126];

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

test("five forced round clears never regress round or quota", { timeout: 180_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  try {
    await bootToPlay(page);
    let lastRound = 1;
    let lastTarget = 0;
    for (let cycle = 0; cycle < 5; cycle += 1) {
      const st = await page.evaluate(() => window.__GB_E2E__.getState());
      assert.ok(st.round >= lastRound, JSON.stringify({ cycle, st, lastRound }));
      if (lastTarget > 0 && st.round === lastRound && st.phase === "PLAY") {
        assert.ok(st.target >= lastTarget, JSON.stringify({ cycle, st, lastTarget }));
      }
      lastRound = st.round;
      lastTarget = st.target;
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
        { timeout: 25_000 },
      );
      await page.evaluate(() => {
        window.__GB_E2E__.dismissOverlays?.();
        window.__GB_E2E__.finishRoundClear?.();
      });
      await page.waitForFunction(
        () => {
          const s = window.__GB_E2E__.getState();
          return s.phase === "SHOP" || s.phase === "GAMBLE";
        },
        { timeout: 25_000 },
      );
      if ((await page.evaluate(() => window.__GB_E2E__.getState())).phase === "GAMBLE") {
        await page.evaluate(() => window.__GB_E2E__.takeSafeCut());
        await page.waitForFunction(() => window.__GB_E2E__.getState().phase === "SHOP", { timeout: 15_000 });
      }
      await page.locator('[data-layout-key="shop-route-card"]').first().click({ timeout: 8000 });
      await page.evaluate(() => window.__GB_E2E__.hitStreets());
      await page.waitForFunction(() => window.__GB_E2E__.getState().phase === "PLAY", { timeout: 25_000 });
    }
    const end = await page.evaluate(() => window.__GB_E2E__.getState());
    assert.ok(end.round >= 6, JSON.stringify(end));
    assert.ok(end.target >= 75, JSON.stringify(end));
    assert.notEqual(end.target, 28, JSON.stringify(end));
  } finally {
    await browser.close();
  }
});

for (const rid of RIDS) {
  test(`seeded bot run never regresses round (rid ${rid})`, { timeout: 180_000 }, async () => {
    const browser = await chromium.launch({ headless: true });
    const viewports = [
      { width: 844, height: 390 },
      { width: 768, height: 1024 },
      { width: 1920, height: 1080 },
    ];
    const vp = viewports[rid % viewports.length];
    const page = await browser.newPage({ viewport: vp });
    try {
      await page.goto(`${baseUrl}/index.html?e2e=1`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__GB_E2E__, { timeout: 45_000 });
      await page.evaluate(() => {
        localStorage.setItem(
          "gutterbones1977:settings:v1",
          JSON.stringify({ pacing: "fast", reducedMotion: true, tutorialCompleted: true, skippedAlleyIntro: true }),
        );
        localStorage.removeItem("gutterbones1977:run:v1");
      });
        const result = await page.evaluate(
        async ({ botSource, opts }) => {
          // eslint-disable-next-line no-eval
          eval(botSource);
          return await runBotSession(opts);
        },
        {
          botSource: BOT_FN,
          opts: {
            maxSteps: 220,
            seed: rid * 7919,
            strategy: ["random", "greedy", "edge", "rapid"][rid % 4],
            stuckThreshold: 36,
            maxFallbacks: 12,
          },
        },
      );
      assert.notEqual(result.reason, "round_regression", JSON.stringify(result));
      if (result.stuck) {
        assert.notEqual(result.reason, "round_regression", JSON.stringify(result));
      }
    } finally {
      await browser.close();
    }
  });
}
