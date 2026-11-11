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

test("ordinary shop flow — resume, tap ?, read Blood 6, Escape closes", async () => {
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
  ];
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 768, height: 1024 });
    const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(base));
    const SETTINGS_KEY = "gutterbones1977:settings:v1";
    await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForFunction(
      () => {
        const root = document.getElementById("root-gutterbones");
        return root && root.innerText && !root.innerText.includes("LOADING");
      },
      { timeout: 90_000 },
    );
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
            tipSeenCarving: true,
            tipSeenRoute: true,
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
      { timeout: 90_000 },
    );
    await page.getByRole("button", { name: "PLAY", exact: true }).click();
    await page.waitForFunction(
      () => document.getElementById("root-gutterbones")?.getAttribute("data-phase") === "LINEUP",
      { timeout: 45_000 },
    );
    await page.waitForFunction(
      () => {
        const btn = document.querySelector('[data-layout-key="lineup-resume"]');
        return btn && btn.getAttribute("aria-hidden") !== "true" && btn.offsetWidth > 0;
      },
      { timeout: 45_000 },
    );
    await page.click('[data-layout-key="lineup-resume"]');
    await page.waitForFunction(
      () => document.getElementById("root-gutterbones")?.getAttribute("data-phase") === "SHOP",
      { timeout: 45_000 },
    );
    await page.waitForSelector('[data-layout-key="shop-layout"]', { timeout: 45_000 });
    await page.waitForSelector('[data-layout-key="shop-intel-button"]', { timeout: 45_000 });
    const intelBtn = page.locator('[data-layout-key="shop-intel-button"]').first();
    await intelBtn.focus();
    await intelBtn.click();
    await page.waitForSelector('[data-layout-key="upgrade-intel-panel"]');
    const text = await page.locator('[data-layout-key="upgrade-intel-panel"]').innerText();
    assert.match(text, /\+20 chips/i);
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () => !document.querySelector('[data-layout-key="upgrade-intel-panel"]'),
      { timeout: 8000 },
    );
  } finally {
    await browser.close();
  }
});
