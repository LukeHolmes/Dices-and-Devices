"use strict";
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { analyzePerRidLinks } = require("./rule-experiments-matrix.cjs");
const arm = process.env.BALANCE_ARM || "control";
assert.ok(["control", "e2"].includes(arm), "expected control or e2");
const root = path.resolve(__dirname, "..");
const dir = fs.mkdtempSync(path.resolve(process.env.RUNNER_TEMP || require("node:os").tmpdir(), "balance-pass-"));
console.log("Balance evidence directory", dir);

function run(label, offset, count) {
  const output = path.join(dir, label + ".json");
  const fd = fs.openSync(output, "w");
  try {
    execFileSync(process.execPath, ["tests/sim/run.cjs", "--games=" + count, "--parallel=2", "--max-steps=1000"], {
      cwd: root, stdio: ["ignore", fd, "inherit"], timeout: count === 1 ? 300000 : 2700000,
      env: { ...process.env, SIM_SEED_GAME: "1", SIM_REPLAY_DIGEST: "1", SIM_LINK_OBSERVER: "1", SIM_TRACE_REPLAY: "1",
        SIM_RULE_EXPERIMENTS: arm === "e2" ? "e2" : "", SIM_POLICY_REVISION: "2026-11-12-wp3-shop-v1", WP2_RID_OFFSET: String(offset) },
    });
  } finally { fs.closeSync(fd); }
  const report = JSON.parse(fs.readFileSync(output));
  assert.equal(report.failureCount, 0);
  assert.equal(report.terminal, count);
  for (let id = offset; id < offset + count; id++) {
    assert.ok(report.replayByRid[id]?.hands > 0, "missing hand records for " + id);
    assert.ok(report.linkObserverByRid[id]?.shadow.decisions > 0, "missing observer for " + id);
  }
  return report;
}

const first = run("16-first", 16, 1);
const repeat = run("16-repeat", 16, 1);
function assertReplay(left, right, id) {
  const a = left.replayEventsByRid[id];
  const b = right.replayEventsByRid[id];
  assert.ok(a?.length && b?.length, "missing replay for " + id);
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    if (JSON.stringify(a[index]) !== JSON.stringify(b[index])) {
      console.error("First divergent event", JSON.stringify({ id, index, first: a[index], repeat: b[index] }));
      throw new Error("Replay diverged for run " + id);
    }
  }
  assert.deepEqual(left.replayByRid[id], right.replayByRid[id], "terminal replay diverged for " + id);
}

assertReplay(first, repeat, 16);
const spotChecks = { 16: first };
for (const id of [0, 7, 23]) spotChecks[id] = run("trace-" + id, id, 1);
const probe = run("parallel-0-1", 0, 2);
assertReplay(spotChecks[0], probe, 0);
const baseline = run("development-0-49", 0, 50);
for (const [id, spot] of Object.entries(spotChecks)) assertReplay(baseline, spot, id);
const replicate = run("replicate-0-49", 0, 50);
for (const id of Object.keys(baseline.replayByRid)) assertReplay(baseline, replicate, id);
console.log(JSON.stringify({ arm, wins: baseline.wins, busts: baseline.busts, avgMaxRound: baseline.avgMaxRound,
  ...analyzePerRidLinks(baseline), linkCounts: baseline.synergy.linkCounts }, null, 2));
