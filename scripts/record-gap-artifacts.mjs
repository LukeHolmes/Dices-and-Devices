#!/usr/bin/env node
/**
 * Before/after shop PNGs, owned-face intel PNG, short roll→score clip (<15MB target).
 */
import path from "node:path";
import fs from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";

const require = createRequire(import.meta.url);
const { createGame, plain } = require("../tests/helpers/game.cjs");
const fixtures = require("../tests/fixtures/runs.cjs");

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ART = "/opt/cursor/artifacts";
const RUN_KEY = "gutterbones1977:run:v1";
const SETTINGS_KEY = "gutterbones1977:settings:v1";

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

function shopSix(base) {
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
      id: "MULT_FACE",
      value: 0,
      label: "+1 MULT",
      style: "bg-[#111] text-[#0df] border-[#0df]",
      type: "modifier",
      cost: 12,
      rarity: "common",
    },
    {
      id: "GOLD_FACE",
      value: 0,
      label: "+$2 CASH",
      style: "bg-[#1a1a00] text-[#d6b85c] border-[#d6b85c]",
      type: "modifier",
      cost: 10,
      rarity: "common",
    },
    {
      id: "ENGINE",
      name: "The Engine",
      desc: "Slot 1 adds mult for each higher-value bone to its right. Max +4.",
      cost: 25,
      rarity: "rare",
    },
    {
      id: "SHIV_FACE",
      value: 0,
      label: "THE SHIV",
      style: "bg-[#1a0000] text-[#ff1111] border-[#ff1111]",
      type: "destructive",
      cost: 22,
      rarity: "danger",
    },
    {
      id: "WILD_FACE",
      value: "W",
      label: "WILD",
      style: "bg-[#1a001a] text-[#ff007f] border-[#ff007f]",
      type: "wild",
      cost: 18,
      rarity: "rare",
    },
  ];
  return base;
}

async function captureShopAfter() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 768, height: 1024 } });
  const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(shopSix(plain(fixtures.shop()))));
  await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => document.getElementById("root-gutterbones")?.innerText && !document.getElementById("root-gutterbones").innerText.includes("LOADING"),
  );
  await page.evaluate(
    ({ key, data, settingsKey }) => {
      localStorage.setItem(key, JSON.stringify(data));
      localStorage.setItem(settingsKey, JSON.stringify({ tutorialCompleted: true, tipSeenShop: true, skippedAlleyIntro: true }));
    },
    { key: RUN_KEY, data: payload, settingsKey: SETTINGS_KEY },
  );
  await page.reload();
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  await page.click('[data-layout-key="lineup-resume"]');
  await page.waitForFunction(() => document.getElementById("root-gutterbones")?.getAttribute("data-phase") === "SHOP");
  await page.waitForTimeout(400);
  const panel = page.locator('[data-layout-key="shop-items-panel"]');
  await panel.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(ART, "shop-768-after-scroll.png"), fullPage: false });
  await panel.evaluate((el) => { el.scrollTop = 0; });
  await page.screenshot({ path: path.join(ART, "shop-768-after-top.png"), fullPage: false });
  await browser.close();
}

async function captureOwnedFaceIntel() {
  const payload = plain(
    createGame(fixtures.snapshot()).api.normalizeSavedRun(plain(fixtures.playBlood6Carved())),
  );
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 768, height: 1024 } });
  await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__);
  await page.evaluate(
    ({ key, data, settingsKey }) => {
      localStorage.setItem(key, JSON.stringify(data));
      localStorage.setItem(settingsKey, JSON.stringify({ tutorialCompleted: true, skippedAlleyIntro: true, reducedMotionPref: true }));
    },
    { key: RUN_KEY, data: payload, settingsKey: SETTINGS_KEY },
  );
  await page.reload();
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__);
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
  await page.waitForFunction(() => document.getElementById("root-gutterbones")?.getAttribute("data-phase") === "PLAY");
  const btn = page.locator('[data-layout-key="bone-face-intel-1"]');
  await btn.waitFor();
  await btn.evaluate((el) => el.click());
  await page.waitForSelector('[data-layout-key="upgrade-intel-panel"]');
  await page.screenshot({ path: path.join(ART, "owned-blood6-intel-768.png"), fullPage: false });
  await browser.close();
}

async function recordScoreShort() {
  const outRaw = path.join(ART, "score-roll-short-raw.webm");
  const out = path.join(ART, "ordinary-flow-score-short.webm");
  const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(fixtures.playStashOpen844()));
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 768, height: 1024 },
    recordVideo: { dir: ART, size: { width: 768, height: 1024 } },
  });
  await context.addInitScript(
    ({ key, data, settingsKey }) => {
      localStorage.setItem(key, JSON.stringify(data));
      localStorage.setItem(
        settingsKey,
        JSON.stringify({ tutorialCompleted: true, tipSeenShop: true, skippedAlleyIntro: true }),
      );
    },
    { key: RUN_KEY, data: payload, settingsKey: SETTINGS_KEY },
  );
  const page = await context.newPage();
  await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 90_000 });
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
  await page.waitForSelector('[data-tutorial="roll-btn"]', { timeout: 60_000 });
  await page.waitForFunction(() => window.__GB_ROLL_HAND_SPRITES_READY === true, { timeout: 25_000 }).catch(() => {});
  await page.waitForTimeout(250);
  await page.click('[data-tutorial="roll-btn"]');
  await page.waitForSelector('[data-layout-key="roll-hand-throw-overlay"]', { timeout: 8000 });
  const handMs = await page.evaluate(() => window.GutterbonesPresentation?.rollHandFxMs?.("normal", false) ?? 1180);
  await page.waitForTimeout(handMs + 250);
  await page.waitForSelector('[data-layout-key="score-breakdown-overlay"], [data-layout-key="score-resolution-overlay"]', {
    timeout: 90_000,
  }).catch(() => {});
  const minHold = await page.evaluate(() => window.GutterbonesPresentation?.gateMinMs?.("scoreOverlay", "normal", false) ?? 2400);
  await page.waitForTimeout(Math.min(minHold + 300, 3500));
  await page.locator("body").click({ position: { x: 384, y: 512 } }).catch(() => {});
  await page.waitForTimeout(400);
  const video = page.video();
  await context.close();
  await browser.close();
  if (video) {
    fs.copyFileSync(await video.path(), outRaw);
    try {
      execFileSync(
        "ffmpeg",
        ["-y", "-i", outRaw, "-c:v", "libvpx-vp9", "-crf", "35", "-b:v", "0", "-an", out],
        { stdio: "pipe" },
      );
    } catch {
      fs.copyFileSync(outRaw, out);
    }
    const mb = fs.statSync(out).size / (1024 * 1024);
    console.log(`Wrote ${out} (${mb.toFixed(2)} MB)`);
  }
}

const before = path.join(ART, "shop-768x1024-check.png");
const beforeCopy = path.join(ART, "shop-768-before-clip.png");
if (fs.existsSync(before)) fs.copyFileSync(before, beforeCopy);

await captureShopAfter();
await captureOwnedFaceIntel();
await recordScoreShort();
server.close();
