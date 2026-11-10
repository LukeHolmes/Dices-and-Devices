"use strict";
const { spawnSync } = require("node:child_process");

const r = spawnSync(
  process.execPath,
  ["tests/sim/run.cjs", "--games=30", "--max-steps=12000", "--parallel=2", "--viewports=blocking"],
  { cwd: require("node:path").join(__dirname, ".."), encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
);

const jsonLine = (r.stdout || "").trim().split("\n").find((l) => l.startsWith("{"));
if (!jsonLine) {
  console.error(r.stdout, r.stderr);
  process.exit(1);
}
const summary = JSON.parse(jsonLine);
const wins = summary.buildOutcomes?.wins || {};
const entries = Object.entries(wins);
const totalWins = entries.reduce((s, [, n]) => s + n, 0);
if (totalWins < 2) {
  console.log(JSON.stringify({ ok: true, reason: "too_few_wins", totalWins, wins }, null, 2));
  process.exit(0);
}
const avg = totalWins / Math.max(1, entries.length);
let dominant = null;
for (const [k, n] of entries) {
  if (n > avg * 2 && n >= 2) dominant = { archetype: k, wins: n, avg };
}
const report = { ok: !dominant, totalWins, wins, avg, dominant, winRate: summary.winRate };
console.log(JSON.stringify(report, null, 2));
process.exit(dominant ? 1 : 0);
