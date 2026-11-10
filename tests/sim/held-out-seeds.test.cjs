"use strict";
/** Held-out rids 50–54 (not in standard sim:50 0–49 gate); honest outcomes only. */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const http = require("node:http");
const fs = require("node:fs");
const { runOneGame, VIEWPORTS_BLOCKING } = require("./run.cjs");

const ROOT = path.join(__dirname, "../..");
const HELD_OUT = [50, 51, 52, 53, 54];
const vp = VIEWPORTS_BLOCKING[0];
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

test("held-out seeds 50–54 — terminal outcomes (no pass threshold)", { timeout: 900_000 }, async () => {
  const chromium = globalThis.__detChromium;
  const rows = [];
  for (const rid of HELD_OUT) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      page.__baseUrl = baseUrl;
      const r = await runOneGame(page, {
        rid,
        seed: rid * 7919,
        strategy: "builder",
        viewport: vp,
        maxSteps: 4000,
        booted: { value: false },
        stuckThreshold: 48,
        maxFallbacks: 36,
      });
      rows.push({
        rid,
        outcome: r.outcome,
        maxRound: r.maxRound,
        build: r.telem?.build?.primaryBuild,
      });
    } finally {
      await browser.close();
    }
  }
  const out = "/opt/cursor/artifacts/held-out-seeds-50-54.json";
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ held_out: rows }, null, 2) + "\n");
  assert.equal(rows.length, HELD_OUT.length);
  assert.ok(rows.every((r) => r.outcome === "WIN" || r.outcome === "BUST" || r.stuck));
});
