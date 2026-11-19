#!/usr/bin/env node
"use strict";
/**
 * Stage 4 shop card frame screenshots (before from parent branch worktree optional).
 * Usage: node scripts/art/capture-s4-shop-cards.cjs [before|after]
 */
const path = require("node:path");
const http = require("node:http");
const fs = require("node:fs");
const { createGame, plain } = require("../../tests/helpers/game.cjs");
const fixtures = require("../../tests/fixtures/runs.cjs");

const ROOT = process.env.S4_CAPTURE_ROOT || path.join(__dirname, "../..");
const RUN_KEY = "gutterbones1977:run:v1";
const label = process.argv[2] === "before" ? "before" : "after";
const OUT = process.env.S4_SHOP_CARD_OUT || path.join("/opt/cursor/artifacts", `s4-shop-cards-${label}`);

const VIEWPORTS = [
  { tag: "1440x900", width: 1440, height: 900 },
  { tag: "1366x768", width: 1366, height: 768 },
  { tag: "1024x768", width: 1024, height: 768 },
  { tag: "768x1024", width: 768, height: 1024 },
  { tag: "390x844", width: 390, height: 844 },
];

const S4_DEMO_IDS = [
  "CROWBAR",
  "CENTERPIECE",
  "BLOOD_PACT",
  "ENGINE",
  "GOLD_FACE",
  "SHIV_FACE",
];

function s4DemoShopRun() {
  return fixtures.run({
    phase: "SHOP",
    round: 4,
    gold: 200,
    target: 161,
    inventory: [{ id: "LOADED_DIE", instanceId: "hw-fence-demo" }],
    shopItems: S4_DEMO_IDS.map((id) => ({ id })),
    routeModifiers: { shopDiscount: 0.12 },
    paths: fixtures.shop()?.paths || [],
  });
}

async function resume(page, builder) {
  const g = createGame(fixtures.snapshot());
  const payload = plain(g.api.normalizeSavedRun(builder()));
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: RUN_KEY, data: payload });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 90_000 });
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
  await page.waitForTimeout(800);
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
    await resume(page, s4DemoShopRun);
    await page.waitForSelector('[data-layout-key="shop-layout"]', { timeout: 25_000 });
    await page.waitForTimeout(500);

    const crowbarBuy = page.locator(".shop-item-card", { hasText: "Crowbar" }).locator('[data-layout-key="shop-buy-button"]');
    if (await crowbarBuy.count()) await crowbarBuy.click({ force: true });
    await page.waitForTimeout(400);

    const inspectFace = page.locator(".shop-item-card", { hasText: "SHIV" }).first();
    if (await inspectFace.count()) {
      const inBtn = inspectFace.locator('button:has-text("IN")');
      if (await inBtn.count()) await inBtn.click({ force: true });
      await page.waitForTimeout(250);
    }

    const center = page.locator(".shop-item-card", { hasText: "Centerpiece" }).first();
    if (await center.count()) await center.hover();

    const blood = page.locator(".shop-item-card", { hasText: "Blood Pact" }).first();
    if (await blood.count()) await blood.hover();

    await page.screenshot({ path: path.join(OUT, `shop-states-${vp.tag}.png`) });

    const priceTag = page.locator(".shop-item-card__price-was").first().locator("xpath=ancestor::*[contains(@class,'shop-item-card__price-tag-wrap')]");
    const discountedTag = page.locator(".shop-item-card__price-tag-wrap:has(.shop-item-card__price-was)").first();
    const tag = (await discountedTag.count()) ? discountedTag : page.locator(".shop-item-card__price-tag-wrap").first();
    if (await tag.count()) {
      const box = await tag.boundingBox();
      if (box) {
        const padX = Math.max(18, box.width * 0.75);
        const padY = Math.max(14, box.height * 0.75);
        const clip = {
          x: Math.max(0, box.x - padX),
          y: Math.max(0, box.y - padY),
          width: Math.min(box.width + padX * 2, vp.width),
          height: Math.min(box.height + padY * 2, vp.height),
        };
        await page.screenshot({ path: path.join(OUT, `price-tag-closeup-${vp.tag}.png`), clip });
        await page.screenshot({
          path: path.join(OUT, `price-tag-closeup-3x-${vp.tag}.png`),
          clip: {
            x: Math.max(0, box.x - box.width),
            y: Math.max(0, box.y - box.height),
            width: Math.min(box.width * 3, vp.width),
            height: Math.min(box.height * 3, vp.height),
          },
        });
      }
    }
    const sectionHeader = page.locator(".shop-section-header").first();
    if (await sectionHeader.count()) {
      const box = await sectionHeader.boundingBox();
      if (box) {
        await page.screenshot({
          path: path.join(OUT, `section-header-closeup-${vp.tag}.png`),
          clip: {
            x: Math.max(0, box.x - 8),
            y: Math.max(0, box.y - 6),
            width: Math.min(box.width + 16, vp.width),
            height: Math.min(box.height + 12, vp.height),
          },
        });
      }
    }

    const rareCard = page.locator(".shop-item-card.glow-rare").first();
    if (await rareCard.count()) {
      const box = await rareCard.boundingBox();
      if (box) {
        const clip = {
          x: Math.max(0, box.x - 8),
          y: Math.max(0, box.y - 8),
          width: Math.min(box.width + 16, vp.width),
          height: Math.min(box.height + 16, vp.height),
        };
        await page.screenshot({ path: path.join(OUT, `card-nineslice-2x-${vp.tag}.png`), clip });
      }
    }
    await page.close();
  }

  await browser.close();
  server.close();
  console.log("Wrote screenshots to", OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});