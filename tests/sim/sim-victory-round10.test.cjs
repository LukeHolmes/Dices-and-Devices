"use strict";
/**
 * Builder sim plays real quotas (no e2e boss relief): lanes must finish cleanly and
 * at least one seeded lane reaches late-run depth — not full VICTORY (follow-up PR).
 */
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

test("sim — builder reaches late depth without softlock (real quotas)", { timeout: 600_000 }, async () => {
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ headless: true });
  const vp = VIEWPORTS_BLOCKING.find((v) => v.name === "1920x1080");
  const rounds = [];
  const LANE_COUNT = 20;
  try {
    for (let rid = 0; rid < LANE_COUNT; rid += 1) {
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
      assert.equal(result.stuck, false, JSON.stringify(result));
      assert.ok(
        result.outcome === "WIN" || result.outcome === "BUST",
        `expected terminal outcome, got ${JSON.stringify(result)}`,
      );
      assert.ok((result.steps || 0) > 0, JSON.stringify(result));
      rounds.push(result.maxRound || 0);
    }
  } finally {
    await browser.close();
  }
  const bestDepth = Math.max(...rounds);
  assert.ok(
    bestDepth >= 7,
    `expected at least one builder lane to reach round 7+ on real quotas; depths=${rounds.join(",")}`,
  );
});
