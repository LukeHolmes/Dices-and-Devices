"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const ROOT = path.join(__dirname, "../..");
const { digestRunResult } = require(path.join(ROOT, "tests/helpers/run-results-csv.cjs"));

async function assertHookOffParity(pairs, rids) {
  const batch = require(path.join(ROOT, "scripts/diagnostics-batch.cjs"));
  const { runOneGame, pickViewports, startServer } = require(path.join(ROOT, "tests/sim/run.cjs"));
  const { ensurePlaywrightClock, installDeterministicNetwork } = require(path.join(
    ROOT,
    "tests/sim/run-paced-bot.cjs",
  ));
  const { chromium } = require("playwright");

  const prev = { ...process.env };
  delete process.env.SIM_SEED_GAME;
  process.env.SIM_NODE_PACED = "0";

  const viewports = pickViewports("blocking");
  try {
    for (const [pinLabel, instrLabel] of pairs) {
      const pinRoot = batch.ensureRulesRoot(pinLabel, "", false);
      const instrRoot = batch.ensureRulesRoot(instrLabel, "", true);
      for (const rid of rids) {
        const digestByBaseline = {};
        for (const [label, rulesRoot] of [
          [pinLabel, pinRoot],
          [instrLabel, instrRoot],
        ]) {
          const server = await startServer(0, rulesRoot);
          const baseUrl = `http://127.0.0.1:${server.address().port}`;
          const browser = await chromium.launch({ headless: true });
          const context = await browser.newContext();
          await ensurePlaywrightClock(context);
          await installDeterministicNetwork(context);
          const page = await context.newPage();
          page.__baseUrl = baseUrl;
          const booted = { value: false };
          const r = await runOneGame(page, {
            rid,
            seed: rid * 7919,
            strategy: "builder",
            viewport: viewports[rid % viewports.length],
            maxSteps: 8000,
            booted,
          });
          await browser.close();
          await new Promise((res) => server.close(res));
          digestByBaseline[label] = digestRunResult(r);
        }
        assert.equal(
          digestByBaseline[pinLabel],
          digestByBaseline[instrLabel],
          `${pinLabel} vs ${instrLabel} rid=${rid} digest mismatch (hook off)`,
        );
      }
    }
  } finally {
    Object.assign(process.env, prev);
  }
}

const RIDS = [0, 1, 2, 3, 4];

test(
  "hook-off: R78-i matches R78 digests (seeds 0-4)",
  { timeout: 900_000 },
  async () => assertHookOffParity([["R78", "R78-i"]], RIDS),
);

test(
  "hook-off: R-main-i matches R-main digests (seeds 0-4)",
  {
    timeout: 900_000,
    skip: "R-main-i module-level gbSim call sites still drift from pin at 807d884 (next instrumented bump)",
  },
  async () => assertHookOffParity([["R-main", "R-main-i"]], RIDS),
);