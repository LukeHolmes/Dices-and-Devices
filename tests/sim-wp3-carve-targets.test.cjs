"use strict";

/**
 * Seeded sim: WP3 should carve multiple kit faces across a short run (not buy-only).
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
  if (start < 0) return null;
  return JSON.parse(text.slice(start + 1));
}

test("WP3 seed 3 — sim regression carves kit offer onto end slot", { timeout: 120_000 }, () => {
  const policySrc = require("node:fs").readFileSync(
    path.join(ROOT, "assets/sim-bot-policy.js"),
    "utf8",
  );
  const vm = require("node:vm");
  const sandbox = { globalThis: {}, module: { exports: {} } };
  vm.createContext(sandbox);
  vm.runInContext(policySrc, sandbox);
  const P = sandbox.globalThis.GutterbonesSimBotPolicy;
  const plan = P.planCarveAction({
    revision: P.WP3_SHOP_REVISION,
    inventory: [{ id: "BOOKENDS" }],
    dice: [{ value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }, { value: 5 }],
    diceFaceIds: [null, null, null, null, null],
    carveOfferId: "GHOST_FACE",
  });
  assert.equal(plan.action, "carve");
  assert.equal(plan.dieIdx, 0);
  assert.equal(plan.faceIdx, 0);
});

test("WP3 seed 0 — completes without CARVING stall", { timeout: 600_000 }, () => {
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
  assert.ok(summary, "sim summary missing");
  const failures = summary.failures || [];
  const carvingIncomplete = failures.filter(
    (f) => f.reason === "incomplete" && String(f.detail || "").includes("CARVING"),
  );
  assert.equal(carvingIncomplete.length, 0);
});
