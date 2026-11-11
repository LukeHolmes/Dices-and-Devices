#!/usr/bin/env node
/**
 * Continuous real-time clips — no layoutAudit freeze, no timeline sampling.
 * Outputs WebM under /opt/cursor/artifacts/
 */
import path from "node:path";
import fs from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const { createGame, plain } = require("../tests/helpers/game.cjs");
const fixtures = require("../tests/fixtures/runs.cjs");

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ART = "/opt/cursor/artifacts";
const RUN_KEY = "gutterbones1977:run:v1";

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const rel = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.join(ROOT, rel.replace(/^\//, ""));
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }
  const ext = path.extname(filePath);
  const types = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".cjs": "text/javascript" };
  res.setHeader("Content-Type", types[ext] || "application/octet-stream");
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;

function shopWithBlood6() {
  const base = plain(fixtures.shop());
  base.shopItems = [
    {
      id: "BLOOD_6",
      value: 6,
      label: "BLOOD 6",
      style: "bg-[#2b0808] text-[#ff1111] border-[#ff1111]",
      type: "blood",
      cost: 16,
      rarity: "danger",
    },
    {
      id: "ENGINE",
      name: "The Engine",
      desc: "Slot 1 adds mult for each higher-value bone to its right. Max +4.",
      cost: 25,
      rarity: "rare",
    },
    ...base.shopItems,
  ].slice(0, 6);
  return base;
}

async function recordShopIntel() {
  const browser = await chromium.launch({ headless: true });
  const out = path.join(ART, "ordinary-flow-shop-intel.webm");
  const context = await browser.newContext({
    viewport: { width: 768, height: 1024 },
    recordVideo: { dir: ART, size: { width: 768, height: 1024 } },
  });
  const page = await context.newPage();
  const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(shopWithBlood6()));
  const waitReady = async () => {
    await page.waitForFunction(
      () => {
        const root = document.getElementById("root-gutterbones");
        return root && root.innerText && !root.innerText.includes("LOADING");
      },
      { timeout: 120_000 },
    );
  };
  await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await waitReady();
  const SETTINGS_KEY = "gutterbones1977:settings:v1";
  await page.evaluate(
    ({ key, data, settingsKey }) => {
      localStorage.setItem(key, JSON.stringify(data));
      const settings = JSON.parse(localStorage.getItem(settingsKey) || "{}");
      localStorage.setItem(
        settingsKey,
        JSON.stringify({
          ...settings,
          tutorialCompleted: true,
          tipSeenShop: true,
          skippedAlleyIntro: true,
        }),
      );
    },
    { key: RUN_KEY, data: payload, settingsKey: SETTINGS_KEY },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitReady();
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  await page.waitForFunction(
    () => document.getElementById("root-gutterbones")?.getAttribute("data-phase") === "LINEUP",
    { timeout: 60_000 },
  );
  await page.waitForFunction(
    () => {
      const btn = document.querySelector('[data-layout-key="lineup-resume"]');
      return btn && btn.getAttribute("aria-hidden") !== "true" && btn.offsetWidth > 0;
    },
    { timeout: 60_000 },
  );
  await page.click('[data-layout-key="lineup-resume"]');
  await page.waitForFunction(
    () => document.getElementById("root-gutterbones")?.getAttribute("data-phase") === "SHOP",
    { timeout: 60_000 },
  );
  await page.waitForSelector('[data-layout-key="shop-intel-button"]', { timeout: 60_000 });
  await page.waitForTimeout(400);
  await page.locator('[data-layout-key="shop-intel-button"]').first().click();
  await page.waitForSelector('[data-layout-key="upgrade-intel-panel"]', { timeout: 8000 });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: path.join(ART, "ordinary-shop-intel-blood6.png") });
  await page.click('[data-layout-key="upgrade-intel-close"]');
  await page.waitForFunction(
    () => !document.querySelector('[data-layout-key="upgrade-intel-panel"]'),
    { timeout: 5000 },
  );
  await page.waitForTimeout(600);
  const video = page.video();
  await context.close();
  await browser.close();
  if (video) {
    fs.copyFileSync(await video.path(), out);
    console.log("Wrote", out);
  }
}

async function recordRollAndScore() {
  const browser = await chromium.launch({ headless: true });
  const out = path.join(ART, "ordinary-flow-roll-score.webm");
  const context = await browser.newContext({
    viewport: { width: 768, height: 1024 },
    recordVideo: { dir: ART, size: { width: 768, height: 1024 } },
  });
  const page = await context.newPage();
  const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(fixtures.playStashOpen844()));
  await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForFunction(
    () => {
      const root = document.getElementById("root-gutterbones");
      return root && root.innerText && !root.innerText.includes("LOADING");
    },
    { timeout: 120_000 },
  );
  const SETTINGS_KEY = "gutterbones1977:settings:v1";
  await page.evaluate(
    ({ key, data, settingsKey }) => {
      localStorage.setItem(key, JSON.stringify(data));
      const settings = JSON.parse(localStorage.getItem(settingsKey) || "{}");
      localStorage.setItem(
        settingsKey,
        JSON.stringify({
          ...settings,
          tutorialCompleted: true,
          tipSeenShop: true,
          skippedAlleyIntro: true,
        }),
      );
    },
    { key: RUN_KEY, data: payload, settingsKey: SETTINGS_KEY },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => {
      const root = document.getElementById("root-gutterbones");
      return root && root.innerText && !root.innerText.includes("LOADING");
    },
    { timeout: 120_000 },
  );
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  await page.waitForFunction(
    () => document.getElementById("root-gutterbones")?.getAttribute("data-phase") === "LINEUP",
    { timeout: 60_000 },
  );
  await page.waitForFunction(
    () => {
      const btn = document.querySelector('[data-layout-key="lineup-resume"]');
      return btn && btn.getAttribute("aria-hidden") !== "true" && btn.offsetWidth > 0;
    },
    { timeout: 60_000 },
  );
  await page.click('[data-layout-key="lineup-resume"]');
  await page.waitForSelector('[data-tutorial="roll-btn"]', { timeout: 60_000 });
  await page.waitForFunction(() => window.__GB_ROLL_HAND_SPRITES_READY === true, { timeout: 25_000 });
  await page.waitForTimeout(300);
  await page.click('[data-tutorial="roll-btn"]');
  await page.waitForSelector('[data-layout-key="roll-hand-throw-overlay"]', { timeout: 8000 });
  const handMs = await page.evaluate(() => window.GutterbonesPresentation?.rollHandFxMs?.("normal", false) ?? 1180);
  await page.waitForTimeout(handMs + 200);
  await page.waitForSelector('[data-layout-key="score-breakdown-overlay"], [data-layout-key="score-resolution-overlay"]', {
    timeout: 90_000,
  }).catch(() => {});
  await page.waitForFunction(() => {
    const t = document.body.innerText || "";
    return t.includes("TAP TO CONTINUE") || t.includes("…");
  }, { timeout: 120_000 }).catch(() => {});
  const minHold = await page.evaluate(() => window.GutterbonesPresentation?.gateMinMs?.("scoreOverlay", "normal", false) ?? 2400);
  await page.waitForTimeout(Math.min(minHold + 200, 3200));
  await page.screenshot({ path: path.join(ART, "ordinary-score-overlay-hold.png") });
  await page.locator("body").click({ position: { x: 384, y: 512 }, timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(800);
  const video = page.video();
  await context.close();
  await browser.close();
  if (video) {
    fs.copyFileSync(await video.path(), out);
    console.log("Wrote", out, `handMs=${handMs}`);
  }
}

await recordRollAndScore();
await recordShopIntel();
server.close();
