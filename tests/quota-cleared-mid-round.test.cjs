"use strict";
/** Quota cleared with plays remaining must show round-clear (not PLAY softlock / negative hands). */
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

async function bootToPlay(page) {
  await page.goto(`${baseUrl}/index.html?e2e=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__GB_E2E__, { timeout: 45_000 });
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__GB_E2E__.startNewRun());
  await page.waitForFunction(() => window.__GB_E2E__.getState().phase === "PLAY", { timeout: 20_000 });
}

for (const [label, width, height] of [
  ["1280x800", 1280, 800],
  ["390x844", 390, 844],
]) {
  test(`quota cleared mid-round shows round-clear (${label})`, async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width, height } });
    try {
      await bootToPlay(page);
      await page.evaluate(() => {
        window.__GB_E2E__.setQuotaTarget(10);
        window.__GB_E2E__.setScore(0);
        window.__GB_E2E__.setPlaysRemaining(2);
        window.__GB_E2E__.prepareScore("TWOS", [2, 2, 2, 2, 2]);
      });
      const deadline = Date.now() + 4000;
      let st = await page.evaluate(() => window.__GB_E2E__.getState());
      while (Date.now() < deadline) {
        const tap = page.locator('button:has-text("TAP TO CONTINUE"), button:has-text("FILED SCORE")');
        if ((await tap.count()) > 0) {
          try {
            await tap.first().click({ force: true, timeout: 400 });
          } catch {
            /* animating */
          }
        } else {
          await page.evaluate(() => window.__GB_E2E__?.dismissOverlays?.());
        }
        await page.waitForTimeout(120);
        st = await page.evaluate(() => ({
          ...window.__GB_E2E__.getState(),
          debug: window.__GB_E2E__.debugStuck?.(),
        }));
        if (st.roundClearVisible) break;
      }
      assert.ok(st.roundClearVisible, `expected round-clear card: ${JSON.stringify(st)}`);
      assert.ok(st.hands >= 0, `hands must not go negative: ${st.hands}`);
      assert.equal(st.phase, "PLAY");
    } finally {
      await browser.close();
    }
  });
}
