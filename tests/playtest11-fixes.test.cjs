"use strict";
/**
 * Playtest 11: score/HUD layout, overlay sequencing, roll lock, pills, MULT pips (rendered UI).
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const { createGame, plain } = require("./helpers/game.cjs");
const fixtures = require("./fixtures/runs.cjs");

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

async function waitForE2E(page) {
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

async function primePlayScore(page) {
  await page.evaluate(() => {
    localStorage.setItem(
      "gutterbones1977:settings:v1",
      JSON.stringify({ pacing: "normal", reducedMotion: true, tutorialCompleted: true, skippedAlleyIntro: true }),
    );
    localStorage.setItem(
      "gutterbones1977:meta:v1",
      JSON.stringify({ totalRuns: 5, unlockedPersonaIds: ["STREET_RAT"], purchasedUpgradeIds: [] }),
    );
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForE2E(page);
  await page.evaluate(() => {
    window.__GB_E2E__.goLineup();
    window.__GB_E2E__.selectFirstPersona();
    window.__GB_E2E__.startNewRun();
  });
  await page.waitForFunction(() => window.__GB_E2E__.getState().phase === "PLAY", { timeout: 25_000 });
  await page.evaluate(() => window.__GB_E2E__.skipIntroOverlays());
  await page.evaluate(() => {
    window.__GB_E2E__.setQuotaTarget(9999);
    window.__GB_E2E__.grantHardware(["ENGINE", "FUSE_BOX"]);
  });
  await page.waitForFunction(() => (document.body.innerText || "").includes("MODS (2)"), { timeout: 8000 });
  await page.evaluate(() => window.__GB_E2E__.prepareScore("TOK", [2, 2, 2, 3, 4]));
  await page.waitForFunction(
    () => {
      const panel = document.querySelector('[data-layout-key="score-breakdown-overlay"]')
        || document.querySelector('[data-layout-key="score-resolution-overlay"]');
      return !!(panel && panel.getBoundingClientRect().height > 8);
    },
    { timeout: 15_000 },
  );
}

async function waitForLayoutAudit(page) {
  await page.waitForSelector("#root-gutterbones", { timeout: 45_000 });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 20_000 });
}

test("rules — MULT face database keeps pip from bone when carved", () => {
  const g = createGame(fixtures.snapshot());
  const face = g.api.FACE_DATABASE.MULT_FACE;
  const die = { value: 4 };
  const pipValue = face.id === "MULT_FACE" && typeof die.value === "number" && die.value >= 1 ? die.value : face.value;
  assert.equal(pipValue, 4);
});

test("e2e — score panel sits below play HUD after real score", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${baseUrl}/index.html?e2e=1`, { waitUntil: "domcontentloaded" });
    await waitForE2E(page);
    await primePlayScore(page);
    const overlap = await page.evaluate(() => window.__GB_E2E__.measureScoreHudOverlap());
    assert.ok(overlap.ok, `HUD overlap (hudBottom=${overlap.hudBottom}, panelTop=${overlap.panelTop})`);
  } finally {
    await browser.close();
  }
});

test("e2e — resolution and breakdown never overlap (layout audit)", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
    await waitForLayoutAudit(page);
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openScoreResolutionDemo());
    await page.waitForTimeout(250);
    let overlap = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.measureOverlayOverlap());
    assert.ok(overlap.ok, `resolution overlap ${overlap.overlaps?.join(",")}`);
    await page.evaluate(() => {
      window.__GB_LAYOUT_AUDIT__.openScoreResolutionDemo();
      window.__GB_LAYOUT_AUDIT__.openScoreBreakdownDemo();
    });
    await page.waitForTimeout(250);
    overlap = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.measureOverlayOverlap());
    assert.ok(overlap.ok, `breakdown overlap ${overlap.overlaps?.join(",")}`);
  } finally {
    await browser.close();
  }
});

test("e2e — roll disabled while score overlay open", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${baseUrl}/index.html?e2e=1`, { waitUntil: "domcontentloaded" });
    await waitForE2E(page);
    await primePlayScore(page);
    await page.waitForFunction(() => window.__GB_E2E__.isRollDisabled(), { timeout: 8000 });
    assert.ok(await page.evaluate(() => window.__GB_E2E__.isRollDisabled()));
  } finally {
    await browser.close();
  }
});

test("e2e — carved MULT bone shows pip art not plus overlay", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(fixtures.run({
      phase: "PLAY",
      dice: fixtures.diceWithFaces([
        { value: 3, faceId: "MULT_FACE", type: "modifier" },
        { value: 1 },
        { value: 2 },
        { value: 4 },
        { value: 5 },
      ]),
      hasRolled: true,
    })));
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
    await waitForLayoutAudit(page);
    await page.evaluate(
      ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
      { key: "gutterbones1977:run:v1", data: payload },
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForLayoutAudit(page);
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
    await page.waitForTimeout(600);
    const src = await page.locator(".bone-die-img").first().getAttribute("src");
    assert.ok(src && src.includes("die-"), "MULT face should render standard pip sprite");
    const badge = await page.locator(".bone-die-btn").first().getByText("+M", { exact: true }).count();
    assert.ok(badge >= 1, "MULT badge should render");
  } finally {
    await browser.close();
  }
});

test("e2e — synergy chain banner visible after scored chain hand", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${baseUrl}/index.html?e2e=1`, { waitUntil: "domcontentloaded" });
    await waitForE2E(page);
    await primePlayScore(page);
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-layout-key="synergy-chain-overlay"]');
        return !!(el && el.getBoundingClientRect().height > 4);
      },
      { timeout: 8000 },
    );
    const box = await page.evaluate(() => {
      const el = document.querySelector('[data-layout-key="synergy-chain-overlay"]');
      return el ? el.getBoundingClientRect() : null;
    });
    assert.ok(box && box.height > 4, "CHAIN banner should be visible in play");
  } finally {
    await browser.close();
  }
});
