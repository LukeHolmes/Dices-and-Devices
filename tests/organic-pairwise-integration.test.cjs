"use strict";
/**
 * Organic integration: seeded run through shop → carve → roll → executePayout
 * must record a real noteChainLink pair (no prepareCarvedPayout / grants).
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

test(
  "organic integration — shop/carve/roll/payout records pairwise noteChainLink",
  { timeout: 1_800_000 },
  () => {
    const scan = path.join(__dirname, "../scripts/organic-milestone-scan.cjs");
    const r = spawnSync(process.execPath, [scan, "0", "32"], {
      cwd: path.join(__dirname, ".."),
      env: { ...process.env, MILESTONE_STEPS: "40000" },
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
    });
    const summaryPath = "/opt/cursor/artifacts/organic-milestone-scan.json";
    assert.ok(fs.existsSync(summaryPath), `missing scan summary: ${r.stderr?.slice(0, 500)}`);
    const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
    assert.ok(summary.winner, `no organic pairwise link in ${summary.count} seeded runs: ${JSON.stringify(summary)}`);
    assert.ok(summary.winner.report?.organicReady, "expected organic kit ready when link recorded");
    assert.ok(
      (summary.winner.report?.pairwiseLinks || []).length >= 1,
      "expected telem pairwiseLinks",
    );
  },
);
