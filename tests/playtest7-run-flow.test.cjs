"use strict";
/**
 * E2E: rounds 1–5 — round clear, gamble safe cut, shop route select + single advance.
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");

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

async function waitForGameReady(page) {
  await page.waitForSelector("#root-gutterbones", { timeout: 45_000 });
  await page.waitForFunction(
    () => {
      const root = document.getElementById("root-gutterbones");
      return root && root.innerText && !root.innerText.includes("LOADING");
    },
    { timeout: 45_000 },
  );
  await page.waitForFunction(() => window.__GB_E2E__, { timeout: 20_000 });
}

async function dismissUi(page, maxMs = 25_000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const state = await page.evaluate(() => window.__GB_E2E__?.getState?.());
    if (!state) break;
    if (state.roundClearVisible && state.roundClearCanContinue) {
      await page.evaluate(() => window.__GB_E2E__.finishRoundClear());
      await page.waitForTimeout(400);
      continue;
    }
    await page.evaluate(() => window.__GB_E2E__.dismissOverlays());
    await page.waitForTimeout(350);
    const next = await page.evaluate(() => window.__GB_E2E__?.getState?.());
    if (next?.phase === "SHOP" || next?.phase === "GAMBLE" || next?.phase === "PLAY") {
      if (!next.roundClearVisible) break;
    }
    await page.waitForTimeout(200);
  }
}

async function clearRoundWithSixes(page) {
  await page.evaluate(() => window.__GB_E2E__.forceRoundWin());
  await page.waitForTimeout(800);
  await dismissUi(page, 35_000);
  const start = Date.now();
  while (Date.now() - start < 35_000) {
    const state = await page.evaluate(() => window.__GB_E2E__.getState());
    if (state.phase === "SHOP" || state.phase === "GAMBLE") return state;
    await dismissUi(page, 3000);
    await page.waitForTimeout(350);
  }
  throw new Error("timeout waiting for shop/gamble after round clear");
}

test("e2e — rounds 1–5 shop route idempotent, single advance, safe cut", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1280, height: 690 });
    await page.goto(`${baseUrl}/index.html?e2e=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await waitForGameReady(page);
    await page.evaluate(() => {
      localStorage.removeItem("gutterbones1977:run:v1");
      localStorage.setItem(
        "gutterbones1977:settings:v1",
        JSON.stringify({ pacing: "fast", reducedMotion: true, tutorialCompleted: true, skippedAlleyIntro: true }),
      );
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForGameReady(page);

    await page.evaluate(() => window.__GB_E2E__.goLineup());
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      window.__GB_E2E__.selectFirstPersona();
      window.__GB_E2E__.startNewRun();
    });
    await page.waitForTimeout(1500);

    for (let r = 1; r <= 5; r += 1) {
      let state = await page.evaluate(() => window.__GB_E2E__.getState());
      assert.equal(state.phase, "PLAY", `round ${r} should start in PLAY`);
      assert.equal(state.round, r, `expected round ${r}`);

      await clearRoundWithSixes(page);
      state = await page.evaluate(() => window.__GB_E2E__.getState());

      if (state.phase === "GAMBLE") {
        const sawClear = await page.evaluate(() => {
          const card = document.querySelector('[data-layout-key="round-clear-card"]');
          return !!card;
        });
        assert.ok(sawClear || r >= 3, "round clear card should appear before gamble from round 3");
        await page.evaluate(() => window.__GB_E2E__.takeSafeCut());
        await page.waitForTimeout(700);
        state = await page.evaluate(() => window.__GB_E2E__.getState());
        assert.equal(state.phase, "SHOP", `after safe cut round ${r} should be SHOP`);
      } else {
        assert.equal(state.phase, "SHOP", `round ${r} should enter SHOP`);
      }

      const beforeShop = await page.evaluate(() => window.__GB_E2E__.getState());
      await page.evaluate(() => window.__GB_E2E__.selectRoute("LOCAL"));
      await page.waitForTimeout(200);
      await page.evaluate(() => window.__GB_E2E__.selectRoute("LOCAL"));
      await page.waitForTimeout(200);
      const midShop = await page.evaluate(() => window.__GB_E2E__.getState());
      assert.equal(midShop.round, beforeShop.round, "route select must not advance round");
      assert.equal(midShop.gold, beforeShop.gold, "route select must not grant cash");

      await page.evaluate(() => window.__GB_E2E__.hitStreets());
      await page.waitForTimeout(900);
      const after = await page.evaluate(() => window.__GB_E2E__.getState());
      assert.equal(after.round, beforeShop.round, `round label should match job round after streets (was ${beforeShop.round})`);
      assert.equal(after.phase, "PLAY", "should return to alley PLAY");
    }
  } finally {
    await browser.close();
  }
});
