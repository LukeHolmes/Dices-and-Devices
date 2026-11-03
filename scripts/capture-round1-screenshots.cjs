"use strict";
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = "/opt/cursor/artifacts/screenshots";

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent((req.url || "/").split("?")[0]);
    const filePath = path.join(ROOT, rel === "/" ? "index.html" : rel.replace(/^\//, ""));
    if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath)) {
      res.statusCode = 404;
      res.end("not found");
      return;
    }
    const ext = path.extname(filePath);
    const types = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png" };
    res.setHeader("Content-Type", types[ext] || "application/octet-stream");
    fs.createReadStream(filePath).pipe(res);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });

  async function boot(page) {
    await page.goto(`${baseUrl}/index.html?e2e=1`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__GB_E2E__, { timeout: 45_000 });
    await page.waitForTimeout(1200);
  }

  for (const vp of [
    { name: "360x640", width: 360, height: 640 },
    { name: "844x390", width: 844, height: 390 },
  ]) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await boot(page);
    await page.screenshot({ path: path.join(OUT, `round1-title-${vp.name}.png`), fullPage: false });
    await page.locator('button:has-text("PLAY")').first().click({ force: true, timeout: 5000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, `round1-lineup-${vp.name}.png`) });
    await page.locator('button:has-text("NEW RUN")').first().click({ force: true });
    await page.waitForTimeout(1500);
    try {
      await page.locator('button:has-text("SKIP")').first().click({ force: true, timeout: 2000 });
    } catch {}
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUT, `round1-inplay-${vp.name}.png`) });
    await page.evaluate(() => window.__GB_E2E__.forceRoundWin());
    await page.waitForTimeout(2500);
    try {
      await page.locator('button:has-text("TAP TO CONTINUE")').first().click({ force: true, timeout: 1500 });
    } catch {}
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUT, `round1-shop-${vp.name}.png`) });
    await page.evaluate(() => window.__GB_E2E__.goLineup());
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      window.__GB_E2E__.startNewRun();
    });
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.__GB_E2E__.forceRoundWin());
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.__GB_E2E__.goLineup());
    await page.waitForTimeout(500);
    await page.close();
  }

  await browser.close();
  server.close();
  console.log("saved to", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
