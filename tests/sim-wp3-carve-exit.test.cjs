"use strict";

/**
 * Regression: WP3 seed 0 previously stalled in CARVING until maxSteps (phase=CARVING).
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const runCjs = path.join(ROOT, "tests/sim/run.cjs");

function parseSummary(text) {
  const marker = '\n{\n  "games"';
  const start = text.lastIndexOf(marker);
  assert.ok(start >= 0, "sim summary JSON missing");
  return JSON.parse(text.slice(start + 1));
}

test("WP3 seed 0 — does not stall in CARVING through maxSteps", { timeout: 600_000 }, () => {
  const r = spawnSync(
    process.execPath,
    [runCjs, "--games=1", "--max-steps=4000", "--parallel=1", "--viewports=blocking"],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        SIM_POLICY_REVISION: "2026-11-12-wp3-shop-v1",
        WP2_RID_OFFSET: "0",
      },
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  const text = (r.stderr || "") + (r.stdout || "");
  const summary = parseSummary(text);
  const failures = summary.failures || [];
  const carvingIncomplete = failures.filter(
    (f) => f.reason === "incomplete" && String(f.detail || "").includes("CARVING"),
  );
  assert.equal(
    carvingIncomplete.length,
    0,
    `expected no CARVING max_steps stall; got ${JSON.stringify(carvingIncomplete)}`,
  );
  assert.ok(summary.completed >= 1);
});
