"use strict";
/**
 * Same 50 matched seeds (rid 0..49): compare 12k vs 40k maxSteps.
 * Distinguishes step-cap truncation from natural BUST terminal.
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const caps = [12_000, 40_000];
const games = Number(process.argv[2] || 50);
const out = {};

for (const maxSteps of caps) {
  const r = spawnSync(
    process.execPath,
    [
      path.join(ROOT, "tests/sim/run.cjs"),
      `--games=${games}`,
      `--max-steps=${maxSteps}`,
      "--parallel=4",
      "--viewports=blocking",
    ],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  const text = `${r.stderr || ""}\n${r.stdout || ""}`;
  const marker = "\n{\n  \"games\"";
  const start = text.lastIndexOf(marker);
  if (start < 0) {
    console.error("no JSON", text.slice(-500));
    process.exit(1);
  }
  out[maxSteps] = JSON.parse(text.slice(start + 1));
}

const a = out[12_000];
const b = out[40_000];
const summary = {
  games,
  maxStepsCompared: caps,
  truncation_at_12k: {
    stepsMax_12k: a.stepsMax,
    stepsMedian_12k: a.stepsMedian,
    generousStepCap_12k: a.generousStepCap,
    stuck_non_terminal_12k: a.failureCount,
    terminal_12k: a.terminal,
    busts_12k: a.busts,
    wins_12k: a.wins,
    winRate_12k: a.winRate,
    linkCounts_12k: a.synergy.linkCounts,
    cop_12k: a.telemetry.crookedCop,
  },
  same_seeds_higher_cap: {
    stepsMax_40k: b.stepsMax,
    stepsMedian_40k: b.stepsMedian,
    wins_40k: b.wins,
    winRate_40k: b.winRate,
    linkCounts_40k: b.synergy.linkCounts,
    cop_40k: b.telemetry.crookedCop,
  },
  interpretation:
    a.stepsMax < a.generousStepCap * 0.02
      ? "step_cap_not_binding: games end as WIN/BUST well below 12k"
      : "step_cap_may_bind: some games exhaust maxSteps",
};
const fs = require("node:fs");
fs.writeFileSync("/opt/cursor/artifacts/matched-seed-step-compare.json", JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
