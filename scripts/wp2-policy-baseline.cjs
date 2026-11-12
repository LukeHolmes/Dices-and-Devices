#!/usr/bin/env node
"use strict";
/**
 * Compare legacy vs WP2 vs WP2-lane sim policies on a bounded seed window.
 * Usage: WP2_RID_END=9 WP2_MAX_STEPS=4000 node scripts/wp2-policy-baseline.cjs
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const ROOT = path.join(__dirname, "..");
const runCjs = path.join(ROOT, "tests/sim/run.cjs");
const RID_START = Number(process.env.WP2_RID_START || 0);
const RID_END = Number(process.env.WP2_RID_END || 9);
const MAX_STEPS = Number(process.env.WP2_MAX_STEPS || 4000);
const games = RID_END - RID_START + 1;

const ORGANIC_PAIR = "ghost_echo→bookends_retrigger";
const REVISIONS = [
  "2026-11-11-phase-b-v1",
  "2026-11-12-wp2-v1",
  "2026-11-12-wp2-lane-v1",
];

function runPolicy(revision) {
  const r = spawnSync(
    process.execPath,
    [
      runCjs,
      `--games=${games}`,
      `--max-steps=${MAX_STEPS}`,
      "--parallel=2",
      "--viewports=blocking",
    ],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        SIM_POLICY_REVISION: revision,
        WP2_RID_OFFSET: String(RID_START),
      },
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  const text = (r.stderr || "") + (r.stdout || "");
  const marker = '\n{\n  "games"';
  const start = text.lastIndexOf(marker);
  if (start < 0) {
    return { revision, error: "no_summary_json", exit: r.status, tail: text.slice(-800) };
  }
  const summary = JSON.parse(text.slice(start + 1));
  return { revision, exit: r.status, summary };
}

function aggregate(summary) {
  const linkCounts = summary.synergy?.linkCounts || {};
  const lane = summary.laneTelemetry || {};
  return {
    wins: summary.wins || 0,
    busts: summary.busts || 0,
    stuck: summary.failureCount || 0,
    medianRound: summary.maxRoundMedian || 0,
    avgMaxRound: summary.avgMaxRound || 0,
    games: summary.completed || summary.games || 0,
    pairwiseLinkActivations: linkCounts[ORGANIC_PAIR] || 0,
    linkCounts,
    winRate: summary.winRate || 0,
    kitEligibleRuns: lane.kitEligibleRuns || 0,
    laneSetupAttempts: lane.setupAttempts || 0,
    laneSetupUnfulfilled: lane.setupUnfulfilled || {},
  };
}

const policies = {};
for (const rev of REVISIONS) {
  policies[rev] = runPolicy(rev);
}

const report = {
  frozenRuleCommit: "main @ 89210e3+",
  viewport: "blocking (includes 1024×768)",
  ridRange: `${RID_START}-${RID_END}`,
  maxSteps: MAX_STEPS,
  note: "Bounded seeds 0–9 per Luke WP2 lane measurement",
  policies: Object.fromEntries(
    REVISIONS.map((rev) => {
      const run = policies[rev];
      if (run.error) return [rev, run];
      return [rev, { ...aggregate(run.summary), exit: run.exit }];
    }),
  ),
};

const out = "/opt/cursor/artifacts/wp2-lane-policy-baseline.json";
fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ out, report }, null, 2));
