"use strict";
/** At least one competent-builder sim lane (rid×7919) must reach VICTORY — proves raid escape is reachable. */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { runOneGame, VIEWPORTS_BLOCKING, startServer } = require("./run.cjs");

const ROOT = path.join(__dirname, "../..");

let server;
let baseUrl;

before(async () => {
  server = await startServer(0, ROOT);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

test("sim — competent builder reaches VICTORY on a seeded lane", { timeout: 900_000 }, async () => {
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ headless: true });
  const vp = VIEWPORTS_BLOCKING.find((v) => v.name === "1920x1080");
  let winner = null;
  try {
    for (let rid = 0; rid < 50; rid += 1) {
      const page = await browser.newPage();
      page.__baseUrl = baseUrl;
      const result = await runOneGame(page, {
        rid,
        seed: rid * 7919,
        strategy: "builder",
        viewport: vp,
        maxSteps: 12_000,
        booted: { value: false },
      });
      await page.close();
      if (result.outcome === "WIN" && (result.maxRound || 0) >= 10) {
        winner = { rid, seed: rid * 7919, steps: result.steps, build: result.telem?.build?.primaryBuild };
        break;
      }
    }
  } finally {
    await browser.close();
  }
  assert.ok(winner, "expected a WIN in builder sim lanes rid 0..49");
});
