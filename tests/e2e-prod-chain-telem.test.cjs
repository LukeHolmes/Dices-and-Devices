"use strict";
/**
 * Production executePayout + __GB_SIM_TELEM__ records pairwise chainLinks (not calculateScore-only).
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");

const ROOT = path.join(__dirname, "..");
let server;
let baseUrl;

before(async () => {
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

test("e2e executePayout telem records blood_ripple→fuse_spark with carved lane", async () => {
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(`${baseUrl}/index.html?e2e=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForFunction(() => window.__GB_E2E__, { timeout: 45_000 });
    await page.evaluate(() => {
      localStorage.setItem(
        "gutterbones1977:settings:v1",
        JSON.stringify({
          pacing: "fast",
          reducedMotionPref: true,
          tutorialCompleted: true,
          skippedAlleyIntro: true,
        }),
      );
      localStorage.setItem(
        "gutterbones1977:meta:v1",
        JSON.stringify({
          totalRuns: 12,
          unlockedPersonaIds: ["STREET_RAT", "HUSTLER", "ENFORCER", "CARD_COUNTER", "GRINDER"],
          unlockedHardwareIds: ["ENGINE", "FUSE_BOX", "CROWBAR", "BOOKENDS"],
          purchasedUpgradeIds: ["rig-shop", "rare-faces", "danger-faces", "chain-manual"],
        }),
      );
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__GB_E2E__, { timeout: 45_000 });
    await page.evaluate(() => {
      window.__GB_SIM_TELEM__ = { hands: [], roundEvents: [], record(h) { this.hands.push(h); } };
      window.__GB_E2E__.goLineup();
      window.__GB_E2E__.selectPersonaByIndex(1);
      window.__GB_E2E__.startNewRun();
      window.__GB_E2E__.skipIntroOverlays?.();
    });
    await page.waitForFunction(
      () => {
        const s = window.__GB_E2E__?.getState?.();
        return s?.phase === "PLAY" && (s?.hands ?? 0) > 0;
      },
      { timeout: 30_000 },
    );
    const ok = await page.evaluate(() =>
      window.__GB_E2E__.prepareCarvedPayout("C", [
        { value: 6, faceId: "BLOOD_6" },
        { value: 6, faceId: "BLOOD_6" },
        { value: 0, faceId: "FUSE_FACE" },
        { value: 3 },
        { value: 4 },
      ]),
    );
    assert.equal(ok, true);
    await page.waitForTimeout(800);
    const hands = await page.evaluate(() => window.__GB_SIM_TELEM__?.hands || []);
    const links = hands.flatMap((h) => h.chainLinks || []);
    assert.ok(
      links.some((l) => l.from === "blood_ripple" && l.to === "fuse_spark"),
      `expected telem link pair, got ${JSON.stringify(links)}`,
    );
  } finally {
    await browser.close();
  }
});

test("e2e executePayout telem records ghost_echo→bookends_retrigger with haunted ends", async () => {
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(`${baseUrl}/index.html?e2e=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForFunction(() => window.__GB_E2E__, { timeout: 45_000 });
    await page.evaluate(() => {
      localStorage.setItem(
        "gutterbones1977:settings:v1",
        JSON.stringify({
          pacing: "fast",
          reducedMotionPref: true,
          tutorialCompleted: true,
          skippedAlleyIntro: true,
        }),
      );
      localStorage.setItem(
        "gutterbones1977:meta:v1",
        JSON.stringify({
          totalRuns: 12,
          unlockedPersonaIds: ["STREET_RAT", "HUSTLER", "ENFORCER", "CARD_COUNTER", "GRINDER"],
          unlockedHardwareIds: ["ENGINE", "FUSE_BOX", "CROWBAR", "BOOKENDS"],
          purchasedUpgradeIds: ["rig-shop", "rare-faces", "danger-faces", "chain-manual"],
        }),
      );
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__GB_E2E__, { timeout: 45_000 });
    await page.evaluate(() => {
      window.__GB_SIM_TELEM__ = { hands: [], roundEvents: [], record(h) { this.hands.push(h); } };
      window.__GB_E2E__.goLineup();
      window.__GB_E2E__.selectPersonaByIndex(1);
      window.__GB_E2E__.startNewRun();
      window.__GB_E2E__.skipIntroOverlays?.();
      window.__GB_E2E__.grantHardware?.(["BOOKENDS"]);
    });
    await page.waitForFunction(
      () => {
        const s = window.__GB_E2E__?.getState?.();
        return s?.phase === "PLAY" && (s?.hands ?? 0) > 0;
      },
      { timeout: 30_000 },
    );
    const ok = await page.evaluate(() =>
      window.__GB_E2E__.prepareCarvedPayout("C", [
        { value: 4, faceId: "MULT_FACE" },
        { value: 0, faceId: "ECHO_FACE" },
        { value: 4, faceId: "GHOST_FACE" },
        { value: 2 },
        { value: 4, faceId: "GOLD_FACE" },
      ]),
    );
    assert.equal(ok, true);
    await page.waitForTimeout(1200);
    const hands = await page.evaluate(() => window.__GB_SIM_TELEM__?.hands || []);
    const links = hands.flatMap((h) => h.chainLinks || []);
    assert.ok(
      links.some((l) => l.from === "ghost_echo" && l.to === "bookends_retrigger"),
      `expected ghost→bookends telem link, got ${JSON.stringify(links)}`,
    );
  } finally {
    await browser.close();
  }
});
