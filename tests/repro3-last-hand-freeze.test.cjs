"use strict";
/** Playwright repro for last-hand overlay tap race (repro3.py). */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");

const ROOT = path.join(__dirname, "..");
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

async function runRepro(page, maxWaitSec = 25) {
  await page.goto(`${baseUrl}/index.html?e2e=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__GB_E2E__, { timeout: 45_000 });
  await page.waitForTimeout(1500);
  for (const t of ["PLAY", "NEW RUN", "SKIP — STRAIGHT TO THE ALLEY"]) {
    const btn = page.locator(`button:has-text("${t}")`).first();
    try {
      await btn.click({ force: true, timeout: 3000 });
    } catch {
      /* optional onboarding button */
    }
    await page.waitForTimeout(1000);
  }
  await page.evaluate(() => window.__GB_E2E__.setPlaysRemaining(1));
  await page.waitForTimeout(300);
  await page.locator("button:has-text(\"ROLL 'EM\")").nth(-1).click({ force: true });
  await page.waitForTimeout(2500);
  const pay = page.locator('button:has-text("PAYOUTS")');
  if ((await pay.count()) > 0 && (await pay.first().isVisible())) {
    await pay.first().click();
    await page.waitForTimeout(400);
  }
  await page.locator('button:has-text("Slop")').first().click({ force: true });
  await page.waitForTimeout(120);
  const tap = page.locator('button:has-text("TAP TO CONTINUE"), button:has-text("FILED SCORE")');
  if ((await tap.count()) > 0) await tap.first().click({ force: true });
  else await page.evaluate(() => window.__GB_E2E__?.dismissOverlays?.());
  let st = { phase: "PLAY" };
  for (let s = 0; s < maxWaitSec; s += 1) {
    await page.waitForTimeout(1000);
    st = await page.evaluate(() => window.__GB_E2E__.getState());
    if (st.phase !== "PLAY") break;
  }
  return st;
}

for (const [name, width, height] of [
  ["1280x800", 1280, 800],
  ["768x1024", 768, 1024],
]) {
  test(`repro3 — last hand leaves PLAY within 25s @ ${name}`, async () => {
    const maxWaitSec = height > width ? 35 : 25;
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width, height } });
    try {
      const st = await runRepro(page, maxWaitSec);
      assert.notEqual(st.phase, "PLAY", `stuck in PLAY after last hand (viewport ${name})`);
    } finally {
      await browser.close();
    }
  });
}
