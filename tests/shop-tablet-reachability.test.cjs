"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const { createGame, plain } = require("./helpers/game.cjs");
const fixtures = require("./fixtures/runs.cjs");

const ROOT = path.join(__dirname, "..");
const RUN_KEY = "gutterbones1977:run:v1";
const SETTINGS_KEY = "gutterbones1977:settings:v1";

function shopSixItems(base) {
  const extra = [
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
      id: "GOLD_FACE",
      value: 0,
      label: "+$2 CASH",
      style: "bg-[#1a1a00] text-[#d6b85c] border-[#d6b85c]",
      type: "modifier",
      cost: 10,
      rarity: "common",
    },
  ];
  base.shopItems = [...extra, ...base.shopItems].slice(0, 6);
  return base;
}

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
    const ext = path.extname(filePath);
    const types = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png" };
    res.setHeader("Content-Type", types[ext] || "application/octet-stream");
    fs.createReadStream(filePath).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

const BLOCKING_SHOP_VPS = [
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1920x1080", width: 1920, height: 1080 },
];

for (const vp of BLOCKING_SHOP_VPS) {
  test(`shop six offers — buy buttons reachable, no overlap @ ${vp.name}`, async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    try {
      const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(shopSixItems(plain(fixtures.shop()))));
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
            JSON.stringify({
              tutorialCompleted: true,
              tipSeenShop: true,
              skippedAlleyIntro: true,
            }),
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
      await page.waitForSelector('[data-layout-key="shop-items-panel"]', { timeout: 20_000 });

      const pageCount = await page.evaluate(() => {
        const span = document.querySelector(".shop-item-pagination span");
        const m = (span?.textContent || "").match(/STOCK\s+\d+\/(\d+)/);
        return m ? Number(m[1]) : 1;
      });
      const checkVisibleStockPage = () => page.evaluate(() => {
        const panel = document.querySelector('[data-layout-key="shop-items-panel"]');
        if (!panel) return { ok: false, reason: "missing panel" };
        const cards = [...panel.querySelectorAll(".shop-item-card")];

        const panelRect = panel.getBoundingClientRect();
        const buyRects = cards.map((c) => {
          const btn = c.querySelector('[data-layout-key="shop-buy-button"]');
          return btn ? btn.getBoundingClientRect() : null;
        });
        if (buyRects.some((r) => !r || r.height < 28 || r.width < 28)) {
          return { ok: false, reason: "buy button missing or too small", buyRects };
        }

        const overlaps = [];
        for (let i = 0; i < buyRects.length; i += 1) {
          for (let j = i + 1; j < buyRects.length; j += 1) {
            const a = buyRects[i];
            const b = buyRects[j];
            const hit = !(a.right <= b.left + 2 || a.left >= b.right - 2 || a.bottom <= b.top + 2 || a.top >= b.bottom - 2);
            if (hit) overlaps.push([i, j]);
          }
        }
        if (overlaps.length) return { ok: false, reason: "buy buttons overlap", overlaps };

        const reachRows = cards.map((c, idx) => {
          const btn = c.querySelector('[data-layout-key="shop-buy-button"]');
          if (!btn) return { idx, ok: false, reason: "no buy" };
          try {
            btn.scrollIntoView({ block: "nearest", inline: "nearest" });
          } catch {
            panel.scrollTop = Math.max(0, c.offsetTop - 4);
          }
          const panelNow = panel.getBoundingClientRect();
          const br = btn.getBoundingClientRect();
          const inPanel = br.top >= panelNow.top - 1 && br.bottom <= panelNow.bottom + 1;
          const intel = c.querySelector('[data-layout-key="shop-intel-button"]');
          const intelOk = !intel || intel.getBoundingClientRect().height >= 28;
          const risk = [...c.querySelectorAll("*")].some((el) => /HIGH RISK/i.test(el.textContent || ""));
          const bloodCard = /BLOOD 6/i.test(c.innerText || "");
          const riskOk = !bloodCard || risk;
          return {
            idx,
            ok: inPanel && br.height >= 28 && intelOk && riskOk,
            inPanel,
            intelOk,
            riskOk,
            btnH: br.height,
            clientH: panel.clientHeight,
          };
        });
        const allReachable = reachRows.every((r) => r.ok);
        const bloodTop = cards.findIndex((c) => /BLOOD 6/i.test(c.innerText || ""));
        const bloodIntel = bloodTop >= 0 ? !!cards[bloodTop].querySelector('[data-layout-key="shop-intel-button"]') : true;

        return {
          ok: allReachable && bloodIntel,
          allReachable,
          scrollH: panel.scrollHeight,
          clientH: panel.clientHeight,
          reachRows,
          bloodIntel,
        };
      });

      const cardSnapshots = [];
      const pageMetrics = [];
      for (let p = 0; p < pageCount; p += 1) {
        if (p > 0) {
          await page.getByRole("button", { name: "Next stock page" }).click();
          await page.waitForTimeout(200);
        }
        const part = await page.evaluate(() => {
          const panel = document.querySelector('[data-layout-key="shop-items-panel"]');
          const cards = [...panel.querySelectorAll(".shop-item-card")];
          return cards.map((c) => ({
            text: (c.innerText || "").slice(0, 80),
            blood: /BLOOD 6/i.test(c.innerText || ""),
          }));
        });
        cardSnapshots.push(...part);
        pageMetrics.push(await checkVisibleStockPage());
      }
      assert.equal(cardSnapshots.length, 6, JSON.stringify(cardSnapshots));
      assert.ok(cardSnapshots.some((c) => c.blood), "Blood 6 offer missing");
      assert.ok(pageMetrics.every((m) => m.ok), JSON.stringify(pageMetrics, null, 2));
    } finally {
      await browser.close();
    }
  });
}
