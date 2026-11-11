"use strict";
/**
 * Fixed-seed builder sim audit for before/after comparisons (rid i → seed i * 7919).
 */
const path = require("node:path");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

const games = Number(process.env.SIM_SEED_GAMES || 10);
const execPath = process.execPath;
const runCjs = path.join(__dirname, "../tests/sim/run.cjs");
const r = spawnSync(
  execPath,
  [runCjs, `--games=${games}`, "--max-steps=12000", "--parallel=1", "--viewports=blocking"],
  {
    cwd: path.join(__dirname, ".."),
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  },
);

const text = (r.stderr || "") + (r.stdout || "");
const marker = '\n{\n  "games"';
const start = text.lastIndexOf(marker);
if (start < 0) {
  console.error(text.slice(0, 2000));
  process.exit(r.status || 1);
}
const summary = JSON.parse(text.slice(start + 1));
const outPath = process.env.SIM_SEED_OUT || path.join(__dirname, "../tests/fixtures/sim-seed-matched-baseline.json");
const linkTotal = Object.values(summary.synergy?.linkCounts || {}).reduce((s, n) => s + n, 0);
const report = {
  capturedAt: new Date().toISOString(),
  games: summary.games,
  winRate: summary.winRate,
  wins: summary.wins,
  failureCount: summary.failureCount,
  maxRoundMedian: summary.maxRoundMedian,
  maxRoundReached: summary.maxRoundReached,
  linkCounts: summary.synergy?.linkCounts,
  linkTotal,
  crookedCop: summary.telemetry?.crookedCop,
  buildOutcomes: summary.buildOutcomes,
};
fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
process.exit(summary.failureCount ? 1 : 0);
