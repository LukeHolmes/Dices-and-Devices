"use strict";
/**
 * Regression: builder sim must not leave shop under-geared (rid 0 was inventoryCount 1 @ round 9).
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const http = require("node:http");
const fs = require("node:fs");
const { runOneGame, VIEWPORTS_BLOCKING } = require("./run.cjs");

const ROOT = path.join(__dirname, "../..");
const RID = Number(process.env.BUILDER_CONSISTENCY_RID || 0);
const vp = VIEWPORTS_BLOCKING.find((v) => v.name === "1024x768") || VIEWPORTS_BLOCKING[0];

let server;
let baseUrl;

before(async () => {
  const { chromium } = require("playwright");
  globalThis.__detChromium = chromium;
  server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    const rel = urlPath === "/" ? "/index.html" : urlPath;
    const filePath = path.join(ROOT, rel.replace(/^\//, ""));
    if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.statusCode = 404;
      return res.end("Not found");
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

test(
  `builder consistency — rid ${RID} shops ≥2 hardware before terminal`,
  { timeout: 120_000 },
  async () => {
    const chromium = globalThis.__detChromium;
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      page.__baseUrl = baseUrl;
      const booted = { value: false };
      const r = await runOneGame(page, {
        rid: RID,
        seed: RID * 7919,
        strategy: "builder",
        viewport: vp,
        maxSteps: 6000,
        booted,
        stuckThreshold: 48,
        maxFallbacks: 36,
      });
      assert.ok(r.outcome === "WIN" || r.outcome === "BUST", r);
      const observed = Math.max(
        Number(r.maxInventoryObserved) || 0,
        Number(r.telem?.inventoryCount) || 0,
      );
      if (r.maxRound >= 6) {
        assert.ok(
          observed >= 2 || r.outcome === "WIN",
          `deep run under-geared: inventory peak ${observed}, outcome=${r.outcome}, round=${r.maxRound}`,
        );
      }
      assert.ok(r.maxRound >= 1, "expected terminal run");
    } finally {
      await browser.close();
    }
  },
);
