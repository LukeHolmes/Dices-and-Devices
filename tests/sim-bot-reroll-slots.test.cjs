"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const http = require("node:http");
const fs = require("node:fs");

const ROOT = path.join(__dirname, "..");

let server;
let baseUrl;

before(async () => {
  server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    const rel = urlPath === "/" ? "/index.html" : urlPath;
    const filePath = path.join(ROOT, rel.replace(/^\//, ""));
    if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath)) {
      res.statusCode = 404;
      return res.end("not found");
    }
    const ext = path.extname(filePath);
    const types = { ".html": "text/html", ".js": "text/javascript" };
    res.setHeader("Content-Type", types[ext] || "application/octet-stream");
    fs.createReadStream(filePath).pipe(res);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  if (server) server.close();
});

test("browser — WP2 keepDiceForReroll keeps slots 0 and 4 for lone Ghost/Echo", { timeout: 120_000 }, async () => {
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  try {
    await page.goto(`${baseUrl}/index.html?e2e=1&simPolicy=2026-11-12-wp2-v1&balanceObserver=1`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.waitForFunction(() => window.GutterbonesSimBotPolicy && window.__GB_E2E__, { timeout: 90_000 });
    await page.evaluate(() => {
      localStorage.setItem(
        "gutterbones1977:settings:v1",
        JSON.stringify({ pacing: "fast", reducedMotionPref: true, tutorialCompleted: true, skippedAlleyIntro: true }),
      );
      localStorage.setItem(
        "gutterbones1977:meta:v1",
        JSON.stringify({ totalRuns: 12, victories: 2, unlockedPersonaIds: ["STREET_RAT", "HUSTLER", "ENFORCER", "CARD_COUNTER", "GRINDER"] }),
      );
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__GB_E2E__?.goLineup, { timeout: 60_000 });
    await page.evaluate(() => {
      window.__GB_E2E__.goLineup();
      window.__GB_E2E__.selectPersonaByIndex(0);
      window.__GB_E2E__.startNewRun();
      window.__GB_E2E__.skipIntroOverlays?.();
    });
    await page.waitForFunction(
      () => window.__GB_E2E__?.getState?.().phase === "PLAY",
      { timeout: 60_000 },
    );
    await page.evaluate(() => {
      window.__GB_E2E__.setDiceLaneForSimPolicyTest([
        { value: 3, faceId: "GHOST_FACE" },
        { value: 2, faceId: null },
        { value: 5, faceId: null },
        { value: 4, faceId: null },
        { value: 1, faceId: "ECHO_FACE" },
      ]);
    });
    await page.waitForFunction(() => {
      const s = window.__GB_E2E__.getState();
      return s.diceFaceIds?.[0] === "GHOST_FACE" && s.diceFaceIds?.[4] === "ECHO_FACE";
    });
    const kept = await page.evaluate(() => {
      if (window.__GB_E2E__.getState().phase !== "PLAY") return null;
      return window.GutterbonesSimBotPolicy.selectKeptSlots({
        revision: "2026-11-12-wp2-v1",
        dice: [
          { value: 3, faceId: "GHOST_FACE" },
          { value: 2, faceId: null },
          { value: 5, faceId: null },
          { value: 4, faceId: null },
          { value: 1, faceId: "ECHO_FACE" },
        ],
      });
    });
    assert.ok(kept, "expected PLAY phase with policy module loaded");
    assert.deepEqual(kept.kept, [true, false, false, false, true], kept);

    await page.evaluate(() => {
      window.__GB_E2E__.keepDiceForReroll();
    });
    const ledgerReason = await page.evaluate(() => {
      const ev = (window.__GB_BALANCE_OBSERVER__?.ledger?.events || []).find(
        (e) => e.type === "action" && e.action?.kind === "bot_policy" && e.action?.reason?.value === "keep_for_reroll",
      );
      return ev?.action?.reason?.detail || null;
    });
    assert.ok(ledgerReason, "observer should record keep_for_reroll");
    assert.deepEqual(ledgerReason.kept, [true, false, false, false, true]);
  } finally {
    await browser.close();
  }
});
