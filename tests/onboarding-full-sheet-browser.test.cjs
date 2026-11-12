"use strict";
/**
 * Phase 3 WP-F — lineup full payout sheet opt-in (browser smoke).
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");

const ROOT = path.join(__dirname, "..");
const META_KEY = "gutterbones1977:meta:v1";
const SETTINGS_KEY = "gutterbones1977:settings:v1";

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

async function freshLineup(page, { pacing = "fast" } = {}) {
  await page.goto(`${baseUrl}/index.html?layoutAudit=1&pacing=${pacing}&e2e=1`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.removeItem("gutterbones1977:meta:v1");
    localStorage.removeItem("gutterbones1977:run:v1");
    localStorage.removeItem("gutterbones1977:settings:v1");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openLineup());
  await page.waitForSelector('[data-layout-key="lineup-title"]', { timeout: 12_000 });
}

test("e2e — full sheet checkbox visible on lineup (fresh profile)", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1280, height: 690 });
    await freshLineup(page);
    const box = await page.locator('[data-layout-key="lineup-full-sheet-opt"]').boundingBox();
    assert.ok(box && box.height >= 44, `checkbox row height ${box?.height}`);
    const checked = await page.locator('[data-layout-key="lineup-full-sheet-checkbox"]').isChecked();
    assert.equal(checked, false);
  } finally {
    await browser.close();
  }
});

test("e2e — ticking full sheet unlocks gated payout rows on run 0", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1280, height: 690 });
    await freshLineup(page);
    await page.locator('[data-layout-key="lineup-full-sheet-checkbox"]').click({ force: true });
    const seeded = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.seedPlayBlood6());
    assert.equal(seeded, true);
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__.getPhase() === "PLAY", { timeout: 12_000 });

    const rows = await page.evaluate(() => {
      const want = ["FOK", "SS", "LS", "Y"];
      return want.map((id) => {
        const row = document.querySelector(`[data-payout-row="${id}"]`);
        const locked = row?.classList?.contains("locked-payout-row");
        return { id, present: !!row, locked: !!locked };
      });
    });
    for (const row of rows) {
      assert.ok(row.present, `${row.id} row missing`);
      assert.equal(row.locked, false, `${row.id} still locked`);
    }
    const lockedBtn = await page.locator('[data-layout-key="payout-unlock-open"]').count();
    assert.equal(lockedBtn, 0);
  } finally {
    await browser.close();
  }
});
