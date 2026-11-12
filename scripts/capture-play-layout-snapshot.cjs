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

const SETTINGS_ANIM = {
  pacing: "fast",
  reducedMotion: false,
  tutorialCompleted: true,
  skippedAlleyIntro: true,
};

const SETTINGS_STILL = {
  ...SETTINGS_ANIM,
  reducedMotion: true,
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

  const fixturePayload = (extra = {}) => fixtures.run({
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
    ...extra,
  });

  async function seedPage(page, runExtra, settings = SETTINGS_STILL) {
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(fixturePayload(runExtra)));
    await page.evaluate(
      ({ key, data, settings: st }) => {
        localStorage.setItem("gutterbones1977:settings:v1", JSON.stringify(st));
        localStorage.setItem(key, JSON.stringify(data));
      },
      { key: RUN_KEY, data: payload, settings },
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 90_000 });
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
  }

  async function preparePhonePage(settings = SETTINGS_STILL) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: VIEWPORTS.phone.w, height: VIEWPORTS.phone.h });
    await seedPage(page, {}, settings);
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

  const phonePillArmed = await preparePhonePage();
  await phonePillArmed.evaluate(() => window.__GB_LAYOUT_AUDIT__.setPillTrayArmed(true));
  await phonePillArmed.waitForSelector(".pill-attach-tray--armed", { timeout: 10_000 });
  await phonePillArmed.waitForTimeout(300);
  await phonePillArmed.screenshot({
    path: path.join(outDir, "option-c-phone-pill-armed.png"),
    scale: "css",
  });
  await phonePillArmed.close();

  const phoneHand = await preparePhonePage(SETTINGS_ANIM);
  await phoneHand.waitForSelector('[data-layout-key="play-roll-btn"]', { timeout: 5000 }).catch(() => null);
  const hasRoll = await phoneHand.$('[data-layout-key="play-roll-btn"]');
  if (hasRoll) {
    await phoneHand.click('[data-layout-key="play-roll-btn"]', { timeout: 8000 }).catch(() => null);
  } else {
    await phoneHand.evaluate(() => window.__GB_LAYOUT_AUDIT__.triggerRollHandOverlayFx());
  }
  await phoneHand.waitForSelector('[data-layout-key="roll-hand-throw-overlay"]', { timeout: 12_000 });
  await phoneHand.evaluate(() => window.__GB_LAYOUT_AUDIT__.freezeRollHandThrowAt(520));
  await phoneHand.waitForTimeout(80);
  await phoneHand.screenshot({
    path: path.join(outDir, "option-c-phone-mid-roll-hand.png"),
    scale: "css",
  });
  await phoneHand.close();

  const lap = await browser.newPage();
  await lap.setViewportSize({ width: VIEWPORTS.laptop.w, height: VIEWPORTS.laptop.h });
  await seedPage(lap, { usedCats: ["ONES"] });
  await lap.waitForSelector('[data-layout-key="play-ledger-column"]', { timeout: 45_000 });
  await lap.waitForTimeout(350);
  await lap.screenshot({
    path: path.join(outDir, "option-c-laptop-layout.png"),
    scale: "css",
  });
  await lap.close();

  const desk = await browser.newPage();
  await desk.setViewportSize({ width: VIEWPORTS.desktop.w, height: VIEWPORTS.desktop.h });
  await seedPage(desk, { usedCats: ["ONES"] });
  await desk.waitForSelector('[data-layout-key="play-ledger-column"]', { timeout: 45_000 });
  await desk.waitForTimeout(350);
  await desk.screenshot({
    path: path.join(outDir, "option-c-desktop-layout.png"),
    scale: "css",
  });
  await desk.close();

  try {
    const videoDir = path.join(outDir, "_roll-video-tmp");
    fs.mkdirSync(videoDir, { recursive: true });
    const context = await browser.newContext({
      viewport: { width: VIEWPORTS.phone.w, height: VIEWPORTS.phone.h },
      recordVideo: { dir: videoDir, size: { width: VIEWPORTS.phone.w, height: VIEWPORTS.phone.h } },
    });
    const rollPage = await context.newPage();
    await seedPage(rollPage, { hasRolled: false, hands: 3, score: 0 }, SETTINGS_ANIM);
    await rollPage.waitForSelector('[data-layout-key="play-roll-btn"]', { timeout: 45_000 });
    await rollPage.click('[data-layout-key="play-roll-btn"]');
    await rollPage.waitForTimeout(2200);
    await context.close();
    const webm = fs.readdirSync(videoDir).find((f) => f.endsWith(".webm"));
    if (webm) {
      fs.renameSync(path.join(videoDir, webm), path.join(outDir, "option-c-phone-roll-hand.webm"));
    }
    fs.rmSync(videoDir, { recursive: true, force: true });
  } catch (e) {
    console.warn("Roll video capture skipped:", e.message);
  }

  const critterPhone = await browser.newPage();
  await critterPhone.setViewportSize({ width: VIEWPORTS.phone.w, height: VIEWPORTS.phone.h });
  await critterPhone.goto(`${baseUrl}/index.html?layoutAudit=1&critters=force`, { waitUntil: "domcontentloaded" });
  await seedPage(critterPhone, {}, SETTINGS_ANIM);
  await critterPhone.waitForSelector('[data-layout-key="play-dice-lane"]', { timeout: 45_000 });
  await critterPhone.evaluate(() => window.__GB_LAYOUT_AUDIT__.forceAlleyCritter("rat"));
  await critterPhone.waitForSelector('[data-layout-key="alley-critter-crawl"]', { timeout: 8000 });
  await critterPhone.evaluate(() => window.__GB_LAYOUT_AUDIT__.freezeAlleyCritterMid());
  await critterPhone.waitForTimeout(120);
  await critterPhone.screenshot({
    path: path.join(outDir, "option-c-phone-critter.png"),
    scale: "css",
  });
  await critterPhone.close();

  const critterDesk = await browser.newPage();
  await critterDesk.setViewportSize({ width: VIEWPORTS.desktop.w, height: VIEWPORTS.desktop.h });
  await critterDesk.goto(`${baseUrl}/index.html?layoutAudit=1&critters=force`, { waitUntil: "domcontentloaded" });
  await seedPage(critterDesk, { usedCats: ["ONES"] }, SETTINGS_ANIM);
  await critterDesk.waitForSelector('[data-layout-key="play-dice-lane"]', { timeout: 45_000 });
  await critterDesk.evaluate(() => window.__GB_LAYOUT_AUDIT__.forceAlleyCritter("roach"));
  await critterDesk.waitForSelector('[data-layout-key="alley-critter-crawl"]', { timeout: 8000 });
  await critterDesk.evaluate(() => {
    window.__GB_LAYOUT_AUDIT__.freezeAlleyCritterMid();
    const el = document.querySelector('[data-layout-key="alley-critter-crawl"]');
    if (el) {
      el.getAnimations().forEach((a) => {
        try {
          const dur = a.effect?.getComputedTiming?.()?.duration;
          if (typeof dur === "number") {
            a.currentTime = dur * 0.52;
          }
        } catch (_) { /* noop */ }
      });
    }
  });
  await critterDesk.waitForTimeout(120);
  await critterDesk.screenshot({
    path: path.join(outDir, "option-c-desktop-critter.png"),
    scale: "css",
  });
  await critterDesk.close();

  const phoneHud = await preparePhonePage();
  await phoneHud.screenshot({
    path: path.join(outDir, "option-c-phone-hud-warrant-tabs.png"),
    scale: "css",
  });
  await phoneHud.close();

  try {
    const critterVideoDir = path.join(outDir, "_critter-video-tmp");
    fs.mkdirSync(critterVideoDir, { recursive: true });
    const critterCtx = await browser.newContext({
      viewport: { width: VIEWPORTS.phone.w, height: VIEWPORTS.phone.h },
      recordVideo: { dir: critterVideoDir, size: { width: VIEWPORTS.phone.w, height: VIEWPORTS.phone.h } },
    });
    const critterVidPage = await critterCtx.newPage();
    await critterVidPage.goto(`${baseUrl}/index.html?layoutAudit=1&critters=force`, { waitUntil: "domcontentloaded" });
    await seedPage(critterVidPage, {}, SETTINGS_ANIM);
    await critterVidPage.waitForSelector('[data-layout-key="play-dice-lane"]', { timeout: 45_000 });
    await critterVidPage.evaluate(() => window.__GB_LAYOUT_AUDIT__.forceAlleyCritter("rat"));
    await critterVidPage.waitForTimeout(2800);
    await critterCtx.close();
    const critterWebm = fs.readdirSync(critterVideoDir).find((f) => f.endsWith(".webm"));
    if (critterWebm) {
      fs.renameSync(
        path.join(critterVideoDir, critterWebm),
        path.join(outDir, "option-c-alley-critter-crawl.webm"),
      );
    }
    fs.rmSync(critterVideoDir, { recursive: true, force: true });
  } catch (e) {
    console.warn("Critter video capture skipped:", e.message);
  }

  await browser.close();
  await new Promise((r) => server.close(r));
  console.log(`Wrote score-sheet snapshots to ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
