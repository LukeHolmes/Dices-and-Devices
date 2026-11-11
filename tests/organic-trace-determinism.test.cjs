"use strict";
/**
 * Organic trace rid16 must be deterministic (attempt 0). Pairwise link is a separate gate.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

const REGRESSION_RID = Number(process.env.ORGANIC_REGRESSION_RID || 16);
const trace = path.join(__dirname, "../scripts/organic-milestone-trace.cjs");

function traceOnce(rid) {
  const outPath = `/opt/cursor/artifacts/organic-determinism-rid${rid}.json`;
  const r = spawnSync(process.execPath, [trace, String(rid)], {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      MILESTONE_STEPS: process.env.MILESTONE_STEPS || "40000",
      MILESTONE_OUT: outPath,
      ORGANIC_TRACE_ATTEMPT: "0",
    },
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  assert.ok(fs.existsSync(outPath), "missing trace artifact");
  return { status: r.status, payload: JSON.parse(fs.readFileSync(outPath, "utf8")) };
}

test("organic trace — rid16 attempt 0 deterministic across 2 runs", { timeout: 600_000 }, () => {
  const a = traceOnce(REGRESSION_RID);
  const b = traceOnce(REGRESSION_RID);
  assert.equal(a.payload.handsRecorded, b.payload.handsRecorded, "handsRecorded");
  assert.equal(a.payload.result?.steps, b.payload.result?.steps, "bot steps");
  assert.equal(a.payload.pairwiseLinkHands, b.payload.pairwiseLinkHands, "pairwiseLinkHands");
  assert.equal(a.payload.organicReady, b.payload.organicReady, "organicReady");
});
