"use strict";
/**
 * Fixed organic regression seed (not a population search).
 * Same rid traced twice must match pairwise telem.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

const REGRESSION_RID = Number(process.env.ORGANIC_REGRESSION_RID || 16);
const trace = path.join(__dirname, "../scripts/organic-milestone-trace.cjs");

function runTrace(rid) {
  const outPath = `/opt/cursor/artifacts/organic-regression-rid${rid}.json`;
  const r = spawnSync(process.execPath, [trace, String(rid)], {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      MILESTONE_STEPS: process.env.MILESTONE_STEPS || "40000",
      MILESTONE_OUT: outPath,
    },
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  assert.equal(r.status, 0, `rid ${rid} must record pairwise link: ${r.stderr?.slice(0, 400)}`);
  assert.ok(fs.existsSync(outPath), "missing trace artifact");
  return JSON.parse(fs.readFileSync(outPath, "utf8"));
}

test("organic regression — fixed rid records ghost_echo→bookends (2× stable)", { timeout: 900_000 }, () => {
  const a = runTrace(REGRESSION_RID);
  const b = runTrace(REGRESSION_RID);
  assert.ok((a.pairwiseLinks || []).length >= 1, "expected pairwiseLinks");
  assert.ok((b.pairwiseLinks || []).length >= 1, "expected pairwiseLinks repeat");
  assert.deepEqual(
    (a.pairwiseLinks || []).map((l) => `${l.from}→${l.to}`).sort(),
    (b.pairwiseLinks || []).map((l) => `${l.from}→${l.to}`).sort(),
  );
  assert.ok(a.organicReady, "kit ready at trace end");
  assert.equal(a.handsRecorded, b.handsRecorded, "stable hand count");
});
