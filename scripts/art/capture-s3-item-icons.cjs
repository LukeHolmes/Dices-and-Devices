#!/usr/bin/env node
"use strict";
/**
 * Screenshots for Stage 3 PR-3 item icons: shop, intel modal, HUD inventory.
 * Usage: node scripts/art/capture-s3-item-icons.cjs [before|after]
 */
const path = require("node:path");
const http = require("node:http");
const fs = require("node:fs");
const { createGame, plain } = require("../../tests/helpers/game.cjs");
const fixtures = require("../../tests/fixtures/runs.cjs");

const ROOT = process.env.S3_ITEM_ICON_ROOT || path.join(__dirname, "../..");
const RUN_KEY = "gutterbones1977:run:v1";
const label = process.argv[2] === "before" ? "before" : "after";
const OUT = process.env.S3_ITEM_ICON_OUT || path.join("/opt/cursor/artifacts", `s3-item-icons-${label}`);

const DEMO_SHOP_IDS = [
  "CENTERPIECE", "CROWBAR", "BLOOD_PACT", "ENGINE", "SHIV_FACE", "GOLD_FACE",
];

const VIEWPORTS = [
  { tag: "1440x900", width: 1440, height: 900 },
  { tag: "1024x768", width: 1024, height: 768 },
  { tag: "390x844", width: 390, height: 844 },
];

function s3DemoShopRun() {
  return fixtures.run({
    phase: "SHOP",
    round: 3,
    gold: 120,
    target: 140,
    shopItems: DEMO_SHOP_IDS.map((id) => ({ id })),
    paths: fixtures.shop()?.paths || [],
  });
}

function s3DemoPlayRun() {
  return fixtures.run({
    phase: "PLAY",
    round: 3,
    gold: 55,
    target: 120,
    hasRolled: true,
    inventory: [
      { id: "CENTERPIECE", instanceId: "hw-1" },
      { id: "FUSE_BOX", instanceId: "hw-2" },
      { id: "BRASS_KNUCKLES", instanceId: "hw-3" },
    ],
    consumables: [
      { id: "SECOND_WIND", instanceId: "c-1" },
      { id: "DIRTY_WAD", instanceId: "c-2" },
    ],
    dice: fixtures.dice([3, 4, 5, 2, 6]),
  });
}

async function resume(page, builder) {
  const g = createGame(fixtures.snapshot());
  const payload = plain(g.api.normalizeSavedRun(builder()));
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: RUN_KEY, data: payload });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 90_000 });
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
  await page.waitForTimeout(600);
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

    await resume(page, s3DemoShopRun);
    await page.waitForSelector('[data-layout-key="shop-layout"]', { timeout: 20_000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, `shop-mixed-stock-${vp.tag}.png`) });

    const intelBtn = page.locator('[data-layout-key="shop-intel-button"]').first();
    if (await intelBtn.count()) {
      await intelBtn.click();
      await page.waitForSelector('[data-layout-key="upgrade-intel-panel"]', { timeout: 8000 });
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `intel-modal-${vp.tag}.png`) });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
    }

    await resume(page, s3DemoPlayRun);
    await page.evaluate(() => {
      const root = document.querySelector("#root-gutterbones");
      if (root) root.setAttribute("data-ui-redesign", "0");
    });
    await page.waitForTimeout(400);
  const stashPanel = page.locator(".stash-hardware-panel");
  if (await stashPanel.isVisible()) {
      await stashPanel.screenshot({ path: path.join(OUT, `hud-inventory-${vp.tag}.png`) });
    } else {
      const modsBtn = page.getByRole("button", { name: /^MODS \(/ });
      if (await modsBtn.count()) {
        await modsBtn.click();
        await page.waitForTimeout(250);
      }
      await page.screenshot({ path: path.join(OUT, `hud-inventory-${vp.tag}.png`) });
    }
    await page.close();
    console.log(`Viewport ${vp.tag} → ${OUT}`);
  }

  await browser.close();
  server.close();
  console.log(`Done (${label}) → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});