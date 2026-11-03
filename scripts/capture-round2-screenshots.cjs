"use strict";
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const { chromium } = require("playwright");
const { createGame, plain } = require("../tests/helpers/game.cjs");
const fixtures = require("../tests/fixtures/runs.cjs");

const ROOT = path.join(__dirname, "..");
const OUT = "/opt/cursor/artifacts";
const RUN_KEY = "gutterbones1977:run:v1";

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const server = http.createServer((req, res) => {
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
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  const shopPayload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(fixtures.shopBusy()));

  for (const [tag, width, height] of [
    ["844x390", 844, 390],
    ["360x640", 360, 640],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
    await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), {
      key: RUN_KEY,
      data: shopPayload,
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__.getPhase() === "SHOP", { timeout: 12_000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, `shop_${tag}.png`), fullPage: false });

    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openRapSheet());
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, `rap-sheet_${tag}.png`), fullPage: false });

    await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, `title_${tag}.png`), fullPage: false });
    await page.close();
  }

  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  console.log("Saved screenshots to", OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
