"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const http = require("node:http");
const { createGame, plain } = require("./helpers/game.cjs");
const fixtures = require("./fixtures/runs.cjs");

const ROOT = path.join(__dirname, "..");
const RUN_KEY = "gutterbones1977:run:v1";
const SETTINGS_KEY = "gutterbones1977:settings:v1";

const FULL_STOCK_VPS = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "390x844", width: 390, height: 844 },
];

function shopSixItems(base) {
  const extra = [
    { id: "CENTERPIECE", name: "The Centerpiece", desc: "Slot 3 bone triggers base value and face bonuses twice.", cost: 20, rarity: "rare" },
    { id: "BLOOD_PACT", name: "Blood Pact", desc: "x3 mult, but -$1 per roll.", cost: 20, rarity: "danger" },
    { id: "BLOOD_6", value: 6, label: "BLOOD 6", style: "bg-[#2b0808]", type: "blood", cost: 16, rarity: "danger" },
    { id: "ENGINE", name: "The Engine", desc: "Slot 1 adds mult for each higher-value bone to its right. Max +4.", cost: 25, rarity: "rare" },
    { id: "SHIV_FACE", value: 0, label: "THE SHIV", style: "bg-[#1a0000]", type: "destructive", cost: 22, rarity: "danger" },
    { id: "GOLD_FACE", value: 0, label: "+$2 CASH", style: "bg-[#1a1a00]", type: "modifier", cost: 10, rarity: "common" },
  ];
  return fixtures.run({
    ...base,
    phase: "SHOP",
    gold: 250,
    shopItems: [...extra, ...(base.shopItems || [])].slice(0, 6),
    routeModifiers: { shopDiscount: 0.1 },
  });
}

let server;
let baseUrl;

before(async () => {
  server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    const rel = urlPath === "/" ? "/index.html" : urlPath;
    const filePath = path.join(ROOT, rel.replace(/^\//, ""));
    if (!filePath.startsWith(ROOT) || !require("node:fs").existsSync(filePath)) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    const types = { ".html": "text/html", ".js": "text/javascript", ".webp": "image/webp", ".png": "image/png" };
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
    require("node:fs").createReadStream(filePath).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

async function enterShop(page) {
  const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(shopSixItems(fixtures.shop())));
  await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForFunction(
    () => document.getElementById("root-gutterbones")?.innerText && !document.getElementById("root-gutterbones").innerText.includes("LOADING"),
    { timeout: 90_000 },
  );
  await page.evaluate(
    ({ key, data, settingsKey }) => {
      localStorage.setItem(key, JSON.stringify(data));
      localStorage.setItem(
        settingsKey,
        JSON.stringify({ tutorialCompleted: true, tipSeenShop: true, skippedAlleyIntro: true }),
      );
    },
    { key: RUN_KEY, data: payload, settingsKey: SETTINGS_KEY },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector('[data-layout-key="lineup-resume"]')?.offsetWidth > 0,
    { timeout: 60_000 },
  );
  await page.click('[data-layout-key="lineup-resume"]');
  await page.waitForFunction(
    () => document.getElementById("root-gutterbones")?.getAttribute("data-phase") === "SHOP",
    { timeout: 60_000 },
  );
  await page.waitForSelector('[data-layout-key="shop-items-panel"] .shop-item-card', { timeout: 20_000 });
  await page.waitForTimeout(800);
}

for (const vp of FULL_STOCK_VPS) {
  test(`shop cards — no vertical overlap, BUY inside card @ ${vp.name}`, async () => {
    const { chromium } = require("playwright");
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    try {
      await enterShop(page);
      const pageCount = await page.evaluate(() => {
        const span = document.querySelector(".shop-item-pagination span");
        const m = (span?.textContent || "").match(/STOCK\s+\d+\/(\d+)/);
        return m ? Number(m[1]) : 1;
      });
      let totalSeen = 0;
      const allOverlap = [];
      const badBuy = [];
      for (let p = 0; p < pageCount; p += 1) {
        if (p > 0) {
          await page.getByRole("button", { name: "Next stock page" }).click();
          await page.waitForTimeout(400);
          await page.evaluate(
            () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
          );
        }
        const metrics = await page.evaluate(() => {
        const panel = document.querySelector('[data-layout-key="shop-items-panel"]');
        const cards = [...panel.querySelectorAll(".shop-item-card")];
        const colRects = [];
        const gaps = [];
        const buyInCard = [];
        const sorted = cards
          .map((card) => {
            const r = card.getBoundingClientRect();
            return { card, r, col: Math.round(r.left) };
          })
          .sort((a, b) => a.r.top - b.r.top || a.r.left - b.r.left);
        for (const { card, r } of sorted) {
          const btn = card.querySelector('[data-layout-key="shop-buy-button"]');
          const br = btn?.getBoundingClientRect();
          if (br) {
            buyInCard.push({
              id: (card.querySelector(".shop-item-card__title")?.textContent || card.innerText || "").slice(0, 24),
              ok: br.top >= r.top - 4 && br.bottom <= r.bottom + 8 && br.left >= r.left - 4 && br.right <= r.right + 4,
              card: { top: r.top, bottom: r.bottom, height: r.height },
              btn: { top: br.top, bottom: br.bottom },
            });
          }
        }
        const shell = panel.closest(".shop-items-shell");
        const panelTransform = getComputedStyle(panel).transform;
        const scaled =
          !!(shell && shell.dataset.intelScaled) ||
          (panelTransform && panelTransform !== "none");
        const byCol = new Map();
        sorted.forEach(({ r }) => {
          const key = Math.round((r.left + r.width / 2) / 24);
          if (!byCol.has(key)) byCol.set(key, []);
          byCol.get(key).push(r);
        });
        if (!scaled) {
          byCol.forEach((rects) => {
            rects.sort((a, b) => a.top - b.top);
            for (let i = 0; i < rects.length - 1; i += 1) {
              const gap = rects[i + 1].top - rects[i].bottom;
              gaps.push(gap);
              if (gap < -2) colRects.push({ gap, upper: rects[i].bottom, lower: rects[i + 1].top });
            }
          });
        }
        return {
          count: cards.length,
          overlap: colRects,
          gaps,
          buyInCard,
          scaled,
          minGap: gaps.length ? Math.min(...gaps) : null,
        };
      });
        totalSeen += metrics.count;
        allOverlap.push(...metrics.overlap);
        badBuy.push(...metrics.buyInCard.filter((b) => !b.ok));
      }
      assert.ok(totalSeen >= 5, `expected full stock across pages, saw ${totalSeen}`);
      assert.equal(allOverlap.length, 0, JSON.stringify(allOverlap, null, 2));
      assert.equal(badBuy.length, 0, JSON.stringify(badBuy, null, 2));
    } finally {
      await browser.close();
    }
  });
}