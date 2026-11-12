"use strict";
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const { chromium } = require("playwright");
const { createGame, plain } = require("../tests/helpers/game.cjs");
const fixtures = require("../tests/fixtures/runs.cjs");

const ROOT = path.join(__dirname, "..");
const RUN_KEY = "gutterbones1977:run:v1";

const VIEWPORTS = {
  phone: { id: "390x844", w: 390, h: 844 },
  laptop: { id: "1366x768", w: 1366, h: 768 },
  desktop: { id: "1920x1080", w: 1920, h: 1080 },
};

async function main() {
  const outDir = process.argv[2] || "/opt/cursor/artifacts";
  fs.mkdirSync(outDir, { recursive: true });

  const server = http.createServer((req, res) => {
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
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });

  const fixturePayload = () => fixtures.run({
    phase: "PLAY",
    round: 4,
    score: 62,
    target: 161,
    hands: 2,
    discards: 2,
    gold: 28,
    hasRolled: true,
    dice: fixtures.dice([2, 2, 2, 3, 4]),
    activeBossId: "LOAN_SHARK",
    inventory: [
      { id: "ENGINE", name: "The Engine", instanceId: "snap-1" },
      { id: "FUSE_BOX", name: "Fuse Box", instanceId: "snap-2" },
    ],
    currentRouteEffect: { name: "BACK ALLEY", effects: ["Standard hustle"] },
  });

  async function preparePhonePage() {
    const page = await browser.newPage();
    await page.setViewportSize({ width: VIEWPORTS.phone.w, height: VIEWPORTS.phone.h });
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(fixturePayload()));
    await page.evaluate(
      ({ key, data }) => {
        localStorage.setItem(
          "gutterbones1977:settings:v1",
          JSON.stringify({
            pacing: "fast",
            reducedMotion: true,
            tutorialCompleted: true,
            skippedAlleyIntro: true,
          }),
        );
        localStorage.setItem(key, JSON.stringify(data));
      },
      { key: RUN_KEY, data: payload },
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 90_000 });
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
    await page.waitForSelector('[data-layout-key="play-mobile-score-sheet"]', { timeout: 45_000 });
    return page;
  }

  const phoneScoreReady = await preparePhonePage();
  await phoneScoreReady.waitForSelector(".mobile-score-sheet--score-ready", { timeout: 15_000 });
  await phoneScoreReady.waitForTimeout(300);
  await phoneScoreReady.screenshot({
    path: path.join(outDir, "option-c-phone-score-ready.png"),
    scale: "css",
  });
  await phoneScoreReady.close();

  const phoneStatus = await preparePhonePage();
  await phoneStatus.evaluate(() => window.__GB_LAYOUT_AUDIT__.togglePlayStatusBreakdown());
  await phoneStatus.waitForSelector('[data-layout-key="play-status-breakdown"]', { timeout: 10_000 });
  await phoneStatus.waitForTimeout(250);
  await phoneStatus.screenshot({
    path: path.join(outDir, "option-c-phone-status-bar.png"),
    scale: "css",
  });
  await phoneStatus.close();

  const phonePillArmed = await preparePhonePage();
  await phonePillArmed.evaluate(() => window.__GB_LAYOUT_AUDIT__.setPillTrayArmed(true));
  await phonePillArmed.waitForSelector(".pill-attach-tray--armed", { timeout: 10_000 });
  await phonePillArmed.waitForTimeout(300);
  await phonePillArmed.screenshot({
    path: path.join(outDir, "option-c-phone-pill-tray-armed.png"),
    scale: "css",
  });
  await phonePillArmed.close();

  const lap = await browser.newPage();
  await lap.setViewportSize({ width: VIEWPORTS.laptop.w, height: VIEWPORTS.laptop.h });
  await lap.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
  const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(fixturePayload()));
  await lap.evaluate(
    ({ key, data }) => {
      localStorage.setItem(
        "gutterbones1977:settings:v1",
        JSON.stringify({ pacing: "fast", reducedMotion: true, tutorialCompleted: true, skippedAlleyIntro: true }),
      );
      localStorage.setItem(key, JSON.stringify(data));
    },
    { key: RUN_KEY, data: payload },
  );
  await lap.reload({ waitUntil: "domcontentloaded" });
  await lap.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 90_000 });
  await lap.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
  await lap.waitForSelector('[data-layout-key="play-ledger-column"]', { timeout: 45_000 });
  await lap.waitForTimeout(350);
  await lap.screenshot({
    path: path.join(outDir, "option-c-laptop-layout.png"),
    scale: "css",
  });
  await lap.close();

  const desk = await browser.newPage();
  await desk.setViewportSize({ width: VIEWPORTS.desktop.w, height: VIEWPORTS.desktop.h });
  await desk.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
  const deskPayload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(fixturePayload()));
  await desk.evaluate(
    ({ key, data }) => {
      localStorage.setItem(
        "gutterbones1977:settings:v1",
        JSON.stringify({ pacing: "fast", reducedMotion: true, tutorialCompleted: true, skippedAlleyIntro: true }),
      );
      localStorage.setItem(key, JSON.stringify(data));
    },
    { key: RUN_KEY, data: deskPayload },
  );
  await desk.reload({ waitUntil: "domcontentloaded" });
  await desk.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 90_000 });
  await desk.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
  await desk.waitForSelector('[data-layout-key="play-ledger-column"]', { timeout: 45_000 });
  await desk.waitForTimeout(350);
  await desk.screenshot({
    path: path.join(outDir, "option-c-desktop-layout.png"),
    scale: "css",
  });
  await desk.close();

  await browser.close();
  await new Promise((r) => server.close(r));
  console.log(`Wrote score-sheet snapshots to ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
