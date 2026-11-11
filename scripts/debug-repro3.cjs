"use strict";
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

async function main() {
  const server = http.createServer((req, res) => {
    const rel = req.url === "/" ? "/index.html" : req.url.split("?")[0];
    const filePath = path.join(ROOT, rel.replace(/^\//, ""));
    res.setHeader("Content-Type", "text/html");
    fs.createReadStream(filePath).pipe(res);
  });
  await new Promise((r) => server.listen(8764, "127.0.0.1", r));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto("http://127.0.0.1:8764/index.html?e2e=1");
  await page.waitForFunction(() => window.__GB_E2E__);
  await page.waitForTimeout(1500);
  for (const t of ["PLAY", "NEW RUN", "SKIP — STRAIGHT TO THE ALLEY"]) {
    try {
      await page.locator(`button:has-text("${t}")`).first().click({ force: true, timeout: 2500 });
    } catch {}
    await page.waitForTimeout(800);
  }
  await page.evaluate(() => window.__GB_E2E__.setPlaysRemaining(1));
  await page.locator("button:has-text(\"ROLL 'EM\")").nth(-1).click({ force: true });
  await page.waitForTimeout(2500);
  const slopCount = await page.locator('button:has-text("Slop")').count();
  console.log("slop buttons", slopCount);
  if (slopCount > 0) await page.locator('button:has-text("Slop")').first().click({ force: true });
  await page.waitForTimeout(200);
  console.log("after slop", await page.evaluate(() => window.__GB_E2E__.getState()));
  const tapCount = await page.locator('button:has-text("TAP TO CONTINUE"), button:has-text("FILED SCORE")').count();
  console.log("tap count", tapCount);
  if (tapCount > 0) {
    await page.locator('button:has-text("TAP TO CONTINUE"), button:has-text("FILED SCORE")').first().click({ force: true });
  }
  for (let i = 0; i < 8; i += 1) {
    await page.waitForTimeout(500);
    console.log(i, await page.evaluate(() => window.__GB_E2E__.getState()));
  }
  await browser.close();
  server.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
