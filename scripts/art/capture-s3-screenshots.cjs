#!/usr/bin/env node
"use strict";
const path = require("node:path");
const http = require("node:http");
const fs = require("node:fs");
const { createGame, plain } = require("../../tests/helpers/game.cjs");
const fixtures = require("../../tests/fixtures/runs.cjs");

const ROOT = path.join(__dirname, "../..");
const RUN_KEY = "gutterbones1977:run:v1";
const label = process.argv[2] === "before" ? "before" : "after";
const OUT = process.env.S3_SCREENSHOT_OUT || path.join(ROOT, "artifacts/s3-portraits-backdrops", label);

const VIEWPORTS = [
  { tag: "1920x1080", width: 1920, height: 1080 },
  { tag: "1440x900", width: 1440, height: 900 },
  { tag: "1280x800", width: 1280, height: 800 },
  { tag: "1024x768", width: 1024, height: 768 },
  { tag: "768x1024", width: 768, height: 1024 },
  { tag: "414x896", width: 414, height: 896 },
  { tag: "375x667", width: 375, height: 667 },
];

const SCREENS = [
  { id: "title", setup: async (page) => {
    await page.waitForSelector('[data-layout-key="title-screen"], .gb-brand-title', { timeout: 20_000 });
    await page.waitForTimeout(400);
  }},
  { id: "lineup", setup: async (page) => {
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openLineup());
    await page.waitForSelector('[data-layout-key="lineup-grid"]', { timeout: 15_000 });
    await page.waitForTimeout(400);
  }},
  { id: "boss-intro", setup: async (page) => {
    await resume(page, fixtures.run);
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openBossIntroFor("INFORMANT"));
    await page.waitForSelector('[data-layout-key="boss-intro-overlay"]', { timeout: 12_000 });
    await page.waitForTimeout(350);
  }},
  { id: "play-alley", fixture: fixtures.run, idKey: "play-alley" },
  { id: "shop", fixture: fixtures.shopBusy, idKey: "shop-layout" },
  { id: "carving", fixture: fixtures.carving, idKey: "carving-layout" },
  { id: "gamble", fixture: fixtures.gamble, idKey: "gamble-card" },
  { id: "busted", setup: async (page) => {
    await resume(page, fixtures.run);
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.forfeitRunDemo(280));
    await page.waitForSelector('[data-layout-key="rap-sheet"]', { timeout: 20_000 });
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.finishRapReveal?.());
    await page.waitForTimeout(400);
  }},
];

async function resume(page, builder) {
  const g = createGame(fixtures.snapshot());
  const payload = plain(g.api.normalizeSavedRun(builder()));
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: RUN_KEY, data: payload });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 90_000 });
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
  await page.waitForTimeout(500);
}

function serve(root) {
  return http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    const rel = urlPath === "/" ? "/index.html" : urlPath;
    const filePath = path.join(root, rel.replace(/^\//, ""));
    if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    const types = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".webp": "image/webp" };
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(res);
  });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const server = serve(ROOT);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}/index.html?layoutAudit=1`;
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ headless: true });

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 90_000 });

    for (const screen of SCREENS) {
      if (screen.fixture) await resume(page, screen.fixture);
      if (screen.setup) await screen.setup(page);
      else if (screen.idKey) {
        await page.waitForSelector(`[data-layout-key="${screen.idKey}"]`, { timeout: 15_000 }).catch(() => {});
        await page.waitForTimeout(350);
      }
      const out = path.join(OUT, `${screen.id}-${vp.tag}.png`);
      await page.screenshot({ path: out, fullPage: false });
      console.log(path.relative(ROOT, out));
    }
    await page.close();
  }

  await browser.close();
  server.close();
  console.log(`Done (${label}) → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});