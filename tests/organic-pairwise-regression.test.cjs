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

function runTrace(rid, { attempt = 0, diagnostic = false } = {}) {
  const outPath = diagnostic
    ? `/opt/cursor/artifacts/organic-diag-rid${rid}-a${attempt}.json`
    : `/opt/cursor/artifacts/organic-regression-rid${rid}-attempt0.json`;
  const steps = process.env.MILESTONE_STEPS || "40000";
  const r = spawnSync(process.execPath, [trace, String(rid)], {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      MILESTONE_STEPS: steps,
      MILESTONE_OUT: outPath,
      ORGANIC_TRACE_ATTEMPT: String(attempt),
    },
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  const payload = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, "utf8")) : null;
  return { status: r.status, stderr: r.stderr, outPath, payload };
}

test("organic regression — rid16 first attempt records ghost_echo→bookends (2× stable)", { timeout: 900_000 }, () => {
  const first = runTrace(REGRESSION_RID, { attempt: 0, diagnostic: false });
  assert.equal(
    first.status,
    0,
    `rid ${REGRESSION_RID} attempt 0 must record pairwise link (no retry gate): ${first.stderr?.slice(0, 500)}`,
  );
  assert.ok((first.payload?.pairwiseLinks || []).length >= 1, "expected pairwiseLinks attempt 0");
  const a = first.payload;
  const second = runTrace(REGRESSION_RID, { attempt: 0, diagnostic: false });
  assert.equal(second.status, 0, `rid ${REGRESSION_RID} repeat trace failed: ${second.stderr?.slice(0, 400)}`);
  const b = second.payload;
  assert.deepEqual(
    (a.pairwiseLinks || []).map((l) => `${l.from}→${l.to}`).sort(),
    (b.pairwiseLinks || []).map((l) => `${l.from}→${l.to}`).sort(),
  );
  assert.equal(a.handsRecorded, b.handsRecorded, "stable hand count");
});
