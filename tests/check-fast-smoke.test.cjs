"use strict";
/**
 * Playwright smoke: 2 seeded bot games per viewport (16 runs), capped steps.
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const http = require("node:http");
const fs = require("node:fs");
const { runOneGame, VIEWPORTS } = require("./sim/run.cjs");

const ROOT = path.join(__dirname, "..");
const SEEDS = [13, 61];

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

for (const vp of VIEWPORTS) {
  for (const rid of SEEDS) {
    test(`check-fast smoke — rid ${rid} @ ${vp.name}`, async () => {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      try {
        const strategy = ["random", "greedy", "edge", "rapid"][rid % 4];
        page.__baseUrl = baseUrl;
        const result = await runOneGame(page, {
          rid,
          seed: rid * 7919,
          strategy,
          viewport: vp,
          maxSteps: 180,
        });
        assert.equal(result.stuck, false, JSON.stringify(result));
      } finally {
        await browser.close();
      }
    });
  }
}
