"use strict";
/**
 * Playtest 10 regressions: empty upper scores, quota cash-out, chain banner, rap sheet grid.
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const { createGame, plain } = require("./helpers/game.cjs");
const { snapshot, dice } = require("./fixtures/runs.cjs");

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

async function waitForGameReady(page, { layoutAudit = false } = {}) {
  await page.waitForSelector("#root-gutterbones", { timeout: 45_000 });
  await page.waitForFunction(
    () => {
      const root = document.getElementById("root-gutterbones");
      return root && root.innerText && !root.innerText.includes("LOADING");
    },
    { timeout: 45_000 },
  );
  if (layoutAudit) {
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 20_000 });
  } else {
    await page.waitForFunction(() => window.__GB_E2E__, { timeout: 20_000 });
  }
}

test("rules — empty Sixes scores 0 (no mastery leak)", () => {
  const g = createGame(snapshot({ handLevels: { SIXES: 3 } }));
  const result = g.api.calculateScore("SIXES", dice([1, 2, 3, 4, 5]));
  assert.equal(result.valid, false);
  assert.equal(result.total, 0);
});

test("rules — empty Fives preview total is 0", () => {
  const g = createGame(snapshot({ handLevels: { FIVES: 2 } }));
  const result = g.api.calculateScore("FIVES", dice([1, 2, 3, 4, 6]));
  assert.equal(result.valid, false);
  assert.equal(result.total, 0);
});

test("e2e — shop shows stash programs including FIX GAME", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await waitForGameReady(page, { layoutAudit: true });
    const fixtures = require("./fixtures/runs.cjs");
    const { createGame: cg } = require("./helpers/game.cjs");
    const payload = plain(cg(fixtures.snapshot()).api.normalizeSavedRun(fixtures.shopBusy()));
    await page.evaluate(
      ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
      { key: "gutterbones1977:run:v1", data: payload },
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForGameReady(page, { layoutAudit: true });
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
    await page.waitForTimeout(500);
    const panel = await page.locator('[data-layout-key="shop-stash-panel"]');
    await panel.waitFor({ timeout: 5000 });
    const text = await panel.innerText();
    assert.match(text, /FIX/i);
    assert.match(text, /SNIFF/i);
    const box = await panel.boundingBox();
    assert.ok(box && box.height > 10);
    assert.ok(box.y + box.height <= 800 + 2, "stash panel should stay in viewport");
  } finally {
    await browser.close();
  }
});

test("e2e — synergy chain banner visible on triad with starter hardware", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1280, height: 690 });
    await page.goto(`${baseUrl}/index.html?e2e=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await waitForGameReady(page);
    await page.evaluate(() => {
      localStorage.setItem(
        "gutterbones1977:settings:v1",
        JSON.stringify({ pacing: "normal", reducedMotion: false, tutorialCompleted: true, skippedAlleyIntro: true }),
      );
      localStorage.setItem(
        "gutterbones1977:meta:v1",
        JSON.stringify({ totalRuns: 5, unlockedPersonaIds: ["STREET_RAT"], purchasedUpgradeIds: [] }),
      );
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForGameReady(page);
    await page.evaluate(() => {
      window.__GB_E2E__.goLineup();
      window.__GB_E2E__.selectFirstPersona();
      window.__GB_E2E__.startNewRun();
    });
    await page.waitForFunction(
      () => {
        const s = window.__GB_E2E__?.getState?.();
        return s && s.phase === "PLAY";
      },
      { timeout: 25_000 },
    );
    await page.evaluate(() => window.__GB_E2E__.skipIntroOverlays());
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      window.__GB_E2E__.setQuotaTarget(9999);
      window.__GB_E2E__.grantHardware(["ENGINE", "FUSE_BOX"]);
    });
    await page.waitForFunction(() => (document.body.innerText || "").includes("MODS (2)"), { timeout: 5000 });
    await page.evaluate(() => {
      window.__GB_E2E__.prepareScore("TOK", [2, 2, 2, 3, 4]);
    });
    await page.waitForFunction(
      () => {
        const banner = document.querySelector('[data-layout-key="synergy-chain-overlay"]');
        if (banner && banner.getBoundingClientRect().height > 2) return true;
        const panel = document.querySelector(".readable-panel");
        return !!(panel && (panel.textContent || "").includes("CHAIN:"));
      },
      { timeout: 12_000 },
    );
    const chainVisible = await page.evaluate(() => {
      const el = document.querySelector('[data-layout-key="synergy-chain-overlay"]');
      const banner = !!(el && el.getBoundingClientRect().height > 2);
      const panel = document.querySelector(".readable-panel");
      const steps = !!(panel && (panel.textContent || "").includes("CHAIN:"));
      return banner || steps;
    });
    assert.ok(chainVisible, "synergy chain lane banner or breakdown CHAIN steps should render");
  } finally {
    await browser.close();
  }
});
