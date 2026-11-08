"use strict";
/**
 * Regression: r12 harness stuck runs — score overlay e2e auto-dismiss (PLAY) and shop refresh sold-state (SHOP).
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");

const ROOT = path.join(__dirname, "..");
const RUN_KEY = "gutterbones1977:run:v1";
const { createGame, plain } = require("./helpers/game.cjs");
const fixtures = require("./fixtures/runs.cjs");

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

async function boot(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(`${baseUrl}/index.html?e2e=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForFunction(() => window.__GB_E2E__, { timeout: 45_000 });
  await page.evaluate(() => {
    localStorage.setItem(
      "gutterbones1977:settings:v1",
      JSON.stringify({
        pacing: "normal",
        reducedMotion: true,
        tutorialCompleted: true,
        skippedAlleyIntro: true,
      }),
    );
  });
}

test("r12 — score overlay auto-dismisses in e2e so PLAY can continue (tablet seed 102947 path)", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await boot(page, { width: 768, height: 1024 });
    await page.evaluate(() => {
      window.__GB_E2E__.startNewRun();
      window.__GB_E2E__.selectFirstPersona();
    });
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const e = window.__GB_E2E__;
      e.setPlaysRemaining(1);
      e.setScore(0);
      e.grantHardware([]);
    });
    await page.evaluate(() => {
      window.__GB_E2E__.prepareScore("FOURS", [1, 5, 1, 4, 4]);
    });
    await page.waitForTimeout(900);
    const stuck = await page.evaluate(() => {
      const e = window.__GB_E2E__;
      const s = e.getState();
      const txt = document.body.innerText || "";
      const overlayOpen = /SCORE EXPLANATION|SCORE RESOLUTION/.test(txt);
      return { phase: s.phase, overlayOpen, hands: s.hands };
    });
    assert.equal(stuck.phase, "PLAY");
    assert.equal(stuck.overlayOpen, false, "score overlay should auto-dismiss under ?e2e=1");
    assert.ok(stuck.hands >= 0);
  } finally {
    await browser.close();
  }
});

test("r12 — shop refresh clears sold flags so stock stays buyable", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`${baseUrl}/index.html?e2e=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForFunction(() => window.__GB_E2E__, { timeout: 45_000 });
    const payload = plain(
      createGame(fixtures.snapshot()).api.normalizeSavedRun(
        fixtures.run({
          phase: "SHOP",
          round: 4,
          gold: 200,
          target: 161,
          stash: 40,
          shopItems: [
            {
              id: "DIRTY_WAD",
              name: "Dirty Wad",
              cost: 22,
              type: "consumable",
              icon: "+$",
              desc: "+$12 cash on use.",
              rarity: "rare",
            },
            {
              id: "SECOND_WIND",
              name: "Second Wind",
              cost: 24,
              type: "consumable",
              icon: "+1",
              desc: "+1 Play this round.",
              rarity: "common",
            },
          ],
          paths: fixtures.shopBusy().paths,
        }),
      ),
    );
    await page.evaluate(
      ({ key, data }) => {
        localStorage.setItem(
          "gutterbones1977:settings:v1",
          JSON.stringify({ tutorialCompleted: true, skippedAlleyIntro: true, pacing: "fast", reducedMotion: true }),
        );
        localStorage.setItem(key, JSON.stringify(data));
      },
      { key: RUN_KEY, data: payload },
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__GB_E2E__, { timeout: 45_000 });
    await page.evaluate(() => window.__GB_E2E__.resumeSavedRun());
    await page.waitForFunction(() => window.__GB_E2E__.getState().phase === "SHOP", { timeout: 20_000 });
    await page.waitForSelector("[data-layout-key=shop-refresh-stock]", { timeout: 15_000 });
    await page.click("[data-layout-key=shop-buy-button]");
    await page.waitForTimeout(250);
    await page.click("[data-layout-key=shop-refresh-stock]");
    await page.waitForTimeout(400);
    const buyable = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll("[data-layout-key=shop-buy-button]")];
      return buttons.filter((b) => !b.disabled).length;
    });
    assert.ok(buyable >= 1, "after refresh at least one BUY control should be enabled");
  } finally {
    await browser.close();
  }
});
