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

const VIEWPORTS = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "390x844", width: 390, height: 844 },
];

function shopLayoutRun() {
  const extra = [
    { id: "CENTERPIECE", name: "The Centerpiece", desc: "Slot 3 bone triggers base value and face bonuses twice.", cost: 20, rarity: "rare" },
    { id: "BLOOD_PACT", name: "Blood Pact", desc: "x3 mult, but -$1 per roll.", cost: 20, rarity: "danger" },
    { id: "BLOOD_6", value: 6, label: "BLOOD 6", style: "bg-[#2b0808]", type: "blood", cost: 16, rarity: "danger" },
    { id: "ENGINE", name: "The Engine", desc: "Slot 1 adds mult for each higher-value bone to its right. Max +4.", cost: 25, rarity: "rare" },
    { id: "SHIV_FACE", value: 0, label: "THE SHIV", style: "bg-[#1a0000]", type: "destructive", cost: 22, rarity: "danger" },
    { id: "GOLD_FACE", value: 0, label: "+$2 CASH", style: "bg-[#1a1a00]", type: "modifier", cost: 10, rarity: "common" },
  ];
  return fixtures.run({
    ...fixtures.shop(),
    phase: "SHOP",
    gold: 250,
    shopItems: [...extra, ...(fixtures.shop().shopItems || [])].slice(0, 6),
    routeModifiers: { shopDiscount: 0.12 },
    inventory: [{ id: "LOADED_DIE", name: "The Crowbar", instanceId: "hw-fence-demo" }],
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
  const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(shopLayoutRun()));
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
  await page.waitForTimeout(900);
}

function rectsIntersect(a, b, margin = 1) {
  return !(
    a.right <= b.left + margin
    || b.right <= a.left + margin
    || a.bottom <= b.top + margin
    || b.bottom <= a.top + margin
  );
}

for (const vp of VIEWPORTS) {
  test(`shop layout stack — stock, panel, fence @ ${vp.name}`, async () => {
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
      const intersections = [];
      const badBuy = [];
      let badSold = [];

      for (let p = 0; p < pageCount; p += 1) {
        if (p > 0) {
          await page.getByRole("button", { name: "Next stock page" }).click();
          await page.waitForTimeout(450);
          await page.evaluate(
            () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
          );
        }

        const pageMetrics = await page.evaluate(() => {
          const panel = document.querySelector('[data-layout-key="shop-items-panel"]');
          const shopPanel = document.querySelector('[data-tutorial="shop-panel"]');
          const vw = window.innerWidth;
          const cards = [...panel.querySelectorAll(".shop-item-card")].map((card) => {
            const r = card.getBoundingClientRect();
            return { r, title: card.querySelector(".shop-item-card__title")?.textContent?.slice(0, 20) || "" };
          });

          const intersects = [];
          for (let i = 0; i < cards.length; i += 1) {
            for (let j = i + 1; j < cards.length; j += 1) {
              const a = cards[i].r;
              const b = cards[j].r;
              const hit = !(
                a.right <= b.left + 1
                || b.right <= a.left + 1
                || a.bottom <= b.top + 1
                || b.bottom <= a.top + 1
              );
              if (hit) {
                intersects.push({
                  a: cards[i].title,
                  b: cards[j].title,
                  gapV: b.top - a.bottom,
                });
              }
            }
          }

          const buyInCard = [];
          const soldBad = [];
          for (const card of panel.querySelectorAll(".shop-item-card")) {
            const r = card.getBoundingClientRect();
            const bbtn = card.querySelector('[data-layout-key="shop-buy-button"]');
            const br = bbtn?.getBoundingClientRect();
            if (br) {
              buyInCard.push({
                title: card.querySelector(".shop-item-card__title")?.textContent?.slice(0, 20) || "?",
                ok: br.top >= r.top - 4 && br.bottom <= r.bottom + 6 && br.left >= r.left - 4 && br.right <= r.right + 4,
              });
            }
            const soldOverlay = card.querySelector(".shop-item-card__overlay--sold");
            if (soldOverlay) {
              const sr = soldOverlay.getBoundingClientRect();
              const ok = sr.top >= r.top - 2 && sr.bottom <= r.bottom + 2 && sr.left >= r.left - 2 && sr.right <= r.right + 2;
              if (!ok) soldBad.push({ title: card.querySelector(".shop-item-card__title")?.textContent?.slice(0, 12) });
            }
          }

          const shopPanelW = shopPanel?.getBoundingClientRect().width || 0;
          const panelRatio = vw > 0 ? shopPanelW / vw : 0;
          const minCardW = cards.length ? Math.min(...cards.map((c) => c.r.width)) : 0;
          const scaled = panel ? getComputedStyle(panel).transform : "none";

          const fenceSell = document.querySelectorAll(".shop-options-fence button").length;
          const fenceHeader = [...document.querySelectorAll(".shop-section-header__label")].some(
            (el) => /FENCE HARDWARE/i.test(el.textContent || ""),
          );

          return {
            count: cards.length,
            intersects,
            buyInCard: buyInCard.filter((b) => !b.ok),
            soldBad,
            panelRatio,
            minCardW,
            scaled,
            fenceSell,
            fenceHeader,
          };
        });

        totalSeen += pageMetrics.count;
        intersections.push(...pageMetrics.intersects);
        badBuy.push(...pageMetrics.buyInCard);
        badSold.push(...pageMetrics.soldBad);

        if (vp.width === 1024 && vp.height === 768) {
          assert.ok(pageMetrics.panelRatio >= 0.44, `stock panel width ratio ${pageMetrics.panelRatio}`);
          assert.ok(pageMetrics.minCardW >= 218, `min card width ${pageMetrics.minCardW}`);
        }
      }

      assert.ok(totalSeen >= 5, `expected full stock across pages, saw ${totalSeen}`);
      assert.equal(intersections.length, 0, JSON.stringify(intersections, null, 2));
      assert.equal(badBuy.length, 0, JSON.stringify(badBuy, null, 2));
      assert.equal(badSold.length, 0, JSON.stringify(badSold, null, 2));

      const fence = await page.evaluate(() => {
        const header = [...document.querySelectorAll(".shop-section-header__label")].some((el) =>
          /FENCE HARDWARE/i.test(el.textContent || ""),
        );
        const rows = document.querySelectorAll(".shop-options-fence button").length;
        const fenceBox = document.querySelector(".shop-options-fence")?.getBoundingClientRect();
        const visible =
          fenceBox && fenceBox.height > 8 && fenceBox.width > 40 && getComputedStyle(document.querySelector(".shop-options-fence")).display !== "none";
        return { header, rows, visible };
      });
      assert.ok(fence.header, "FENCE HARDWARE header missing");
      assert.ok(fence.visible, "fence block not visible");
      assert.ok(fence.rows >= 1, "no fence sell row");
    } finally {
      await browser.close();
    }
  });
}