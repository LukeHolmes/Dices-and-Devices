"use strict";
/**
 * Same rid/seed/maxSteps must reproduce terminal outcome (controls async suite noise).
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const http = require("node:http");
const fs = require("node:fs");
const { runOneGame, VIEWPORTS_BLOCKING } = require("./run.cjs");

const ROOT = path.join(__dirname, "../..");
const MAX_STEPS = Number(process.env.DETERMINISTIC_REPLAY_STEPS || 5000);
const REPLAY_RIDS = (process.env.DETERMINISTIC_REPLAY_RIDS || "0,7,16,23,42")
  .split(",")
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isFinite(n));
const vp = VIEWPORTS_BLOCKING.find((v) => v.name === "1024x768") || VIEWPORTS_BLOCKING[0];

let server;
let baseUrl;

function fingerprint(r) {
  const links = (r.telem?.hands || []).flatMap((h) =>
    (h.chainLinks || []).map((l) => `${l.from}→${l.to}`),
  );
  return {
    outcome: r.outcome,
    maxRound: r.maxRound,
    stuck: !!r.stuck,
    reason: r.reason || null,
    linkKeys: links.sort().join(","),
    hands: r.telem?.hands?.length || 0,
    inventoryCount: r.telem?.inventoryCount ?? null,
    terminalScore: r.telem?.score ?? null,
  };
}

async function replayRid(rid) {
  const chromium = globalThis.__detChromium;
  const runs = [];
  for (let rep = 0; rep < 2; rep += 1) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      page.__baseUrl = baseUrl;
      const booted = { value: false };
      const r = await runOneGame(page, {
        rid,
        seed: rid * 7919,
        strategy: "builder",
        viewport: vp,
        maxSteps: MAX_STEPS,
        booted,
        stuckThreshold: 48,
        maxFallbacks: 36,
      });
      runs.push(fingerprint(r));
    } finally {
      await browser.close();
    }
  }
  assert.deepEqual(runs[0], runs[1], `rid ${rid} non-deterministic: ${JSON.stringify(runs)}`);
}

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

for (const rid of REPLAY_RIDS) {
  test(`deterministic replay — builder rid ${rid} ×2 identical fingerprint`, { timeout: 600_000 }, async () => {
    await replayRid(rid);
  });
}
