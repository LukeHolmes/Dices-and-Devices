"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const http = require("node:http");
const fs = require("node:fs");
const { createGame, plain } = require("./helpers/game.cjs");
const fixtures = require("./fixtures/runs.cjs");

const ROOT = path.join(__dirname, "..");
const RUN_KEY = "gutterbones1977:run:v1";
const INDEX = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

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
    fs.createReadStream(filePath).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

test("LAF reduced motion stops ambient, ashtray FX, and rat sprite CSS", async () => {
  assert.ok(INDEX.includes("gb-motion-reduce .alley-critter-rat-webp"));
  assert.ok(INDEX.includes("animation: none !important"));
  assert.ok(INDEX.includes("gb-motion-reduce .laf-ashtray-ember"));

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 90_000 });
    await page.evaluate(() => {
      localStorage.setItem(
        "gutterbones1977:settings:v1",
        JSON.stringify({ pacing: "fast", reducedMotionPref: true, tutorialCompleted: true, skippedAlleyIntro: true }),
      );
    });
    const payload = plain(
      createGame(fixtures.snapshot()).api.normalizeSavedRun(
        fixtures.run({
          phase: "PLAY",
          round: 3,
          score: 12,
          target: 110,
          hands: 4,
          discards: 3,
          hasRolled: false,
          dice: fixtures.dice([3, 4, 5, 2, 6]),
        }),
      ),
    );
    await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), {
      key: RUN_KEY,
      data: payload,
    });
    await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 90_000 });
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
    await page.waitForTimeout(600);

    const audit = await page.evaluate(() => {
      const root = document.getElementById("root-gutterbones");
      const st = (sel) => {
        const el = document.querySelector(sel);
        return el ? getComputedStyle(el) : null;
      };
      return {
        reduced: root?.classList.contains("gb-motion-reduce"),
        ambientDisplay: st(".look-and-feel-ambient")?.display,
        emberDisplay: st(".laf-ashtray-ember")?.display,
        smokeDisplay: st(".laf-ashtray-smoke")?.display,
        ambients: [...document.querySelectorAll(".laf-ambient")].map((el) => getComputedStyle(el).animationPlayState),
      };
    });
    assert.equal(audit.reduced, true);
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__?.forceAlleyCritter?.("rat"));
    await page.waitForTimeout(200);
    const afterCritter = await page.evaluate(() => {
      const rat = document.querySelector(".alley-critter-rat-webp");
      const amb = document.querySelector(".look-and-feel-ambient");
      return {
        hasAmbient: !!amb,
        ratAnim: rat ? getComputedStyle(rat).animationName : null,
        ember: document.querySelector(".laf-ashtray-ember"),
        emberDisplay: document.querySelector(".laf-ashtray-ember")
          ? getComputedStyle(document.querySelector(".laf-ashtray-ember")).display
          : null,
      };
    });
    assert.equal(afterCritter.hasAmbient, false);
    assert.ok(afterCritter.ratAnim === "none" || !afterCritter.ratAnim || afterCritter.ratAnim === undefined);
    assert.ok(afterCritter.emberDisplay === "none" || !afterCritter.ember);
  } finally {
    await browser.close();
  }
});