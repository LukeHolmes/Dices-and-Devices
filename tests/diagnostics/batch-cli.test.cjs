"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const batch = require(path.join(__dirname, "../../scripts/diagnostics-batch.cjs"));
const { blankMetricsRow } = require(path.join(__dirname, "../helpers/run-results-csv.cjs"));

describe("diagnostics batch CLI", () => {
  it("defines approved baselines", () => {
    assert.ok(batch.BASELINES["R-main"]);
    assert.ok(batch.BASELINES.R78);
    assert.equal(batch.FIXED_POLICY_REVISION, "2026-11-11-phase-b-v1");
  });

  it("builds replicate windows", () => {
    const jobs = batch.buildRidWindows([0, 1], 2);
    assert.equal(jobs.length, 4);
    assert.deepEqual(
      jobs.map((j) => `${j.rid}:${j.replicateIndex}`).sort(),
      ["0:0", "0:1", "1:0", "1:1"],
    );
  });

  it("leaves unknown CSV metrics blank", () => {
    const row = blankMetricsRow({ rid: 3, outcome: "BUST" });
    assert.equal(row.rid, 3);
    assert.equal(row.legal_coverage_pct, "");
    assert.equal(row.llm_calls, "");
  });
});