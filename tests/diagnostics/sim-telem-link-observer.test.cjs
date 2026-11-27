"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { runRidWindow } = require(path.join(__dirname, "../../scripts/diagnostics-batch.cjs"));

test("SIM_LINK_OBSERVER=1 still records sim telem hands", { timeout: 240_000 }, async () => {
  const prev = { ...process.env };
  Object.assign(process.env, {
    SIM_SEED_GAME: "1",
    SIM_STREET_RAT_PROFILE: "1",
    SIM_POLICY_REVISION: "2026-11-11-phase-b-v1",
    SIM_LINK_OBSERVER: "1",
  });
  const rulesRoot = path.join(__dirname, "../..");
  const [r] = await runRidWindow({
    rids: [3],
    replicate: 1,
    maxSteps: 4000,
    parallel: 1,
    viewports: "blocking",
    rulesRoot,
    ruleExperimentArm: "",
  });
  Object.assign(process.env, prev);
  assert.ok((r.telem?.hands || []).length > 0, "expected scored hands in telem");
  assert.ok((r.telem?.roundEvents || []).length > 0, "expected roundEvents");
});