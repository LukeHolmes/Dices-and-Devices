"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const http = require("node:http");
const fs = require("node:fs");
const { createGame, plain } = require("./helpers/game.cjs");
const fixtures = require("./fixtures/runs.cjs");

const ROOT = path.join(__dirname, "..");
const RUN_KEY = "gutterbones1977:run:v1";
const VIEWPORTS = [
  { name: "320x568", width: 320, height: 568 },
  { name: "390x844", width: 390, height: 844 },
  { name: "412x915", width: 412, height: 915 },
  { name: "844x390", width: 844, height: 390 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1920x1080", width: 1920, height: 1080 },
];

let server;
let baseUrl;
let browser;

before(async () => {
  const chromium = require("playwright").chromium;
  server = http.createServer((req, res) => {
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
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  if (browser) await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
});

async function bootShop(page, { debt = 0 } = {}) {
  const payload = plain(
    createGame(fixtures.snapshot()).api.normalizeSavedRun({
      ...fixtures.shopBusy(),
      debt,
    }),
  );
  await page.evaluate(
    ({ key, data }) => {
      localStorage.setItem(
        "gutterbones1977:settings:v1",
        JSON.stringify({ pacing: "fast", reducedMotion: false, tutorialCompleted: true, skippedAlleyIntro: true }),
      );
      localStorage.setItem(key, JSON.stringify(data));
    },
    { key: RUN_KEY, data: payload },
  );
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 90_000 });
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
  await page.waitForSelector('[data-layout-key="shop-layout"]', { timeout: 60_000 });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    const screen = document.querySelector("#root-gutterbones[data-phase=\"SHOP\"] .gb-screen");
    if (screen instanceof HTMLElement) screen.scrollTop = 0;
  });
}

for (const vp of VIEWPORTS) {
  test(`shop footer overlap @ ${vp.name}`, async () => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    const needDebtRow = vp.name === "1366x768";
    await bootShop(page, { debt: needDebtRow ? 24 : 0 });
    const audit = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.auditShopFooterOverlap());
    assert.ok(audit.ok, `${vp.name}: ${JSON.stringify(audit)}`);
    if (vp.name === "1366x768" || vp.name === "768x1024") {
      const column = await page.evaluate(() => {
        const auditApi = window.__GB_LAYOUT_AUDIT__;
        if (!auditApi || typeof auditApi.auditShopRoutesColumnReachable !== "function") {
          return { ok: false, bad: [{ kind: "missing-audit", hasAudit: !!auditApi }] };
        }
        return auditApi.auditShopRoutesColumnReachable();
      });
      assert.ok(column.ok, `${vp.name} column: ${JSON.stringify(column)}`);
    }
    await page.close();
  });
}