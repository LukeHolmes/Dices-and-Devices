#!/usr/bin/env node
"use strict";
/**
 * Compare legacy vs WP2 sim policy on a bounded seed window (default 0-19).
 * Usage: node scripts/wp2-policy-baseline.cjs
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const ROOT = path.join(__dirname, "..");
const runCjs = path.join(ROOT, "tests/sim/run.cjs");
const RID_START = Number(process.env.WP2_RID_START || 0);
const RID_END = Number(process.env.WP2_RID_END || 19);
const MAX_STEPS = Number(process.env.WP2_MAX_STEPS || 6000);
const games = RID_END - RID_START + 1;

const ORGANIC_PAIR = "ghost_echo→bookends_retrigger";

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

// run.cjs uses rid 0..games-1; offset via starting games count only — document subset as first N seeds
function aggregate(summary) {
  const linkCounts = summary.synergy?.linkCounts || {};
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
  };
}

const legacy = runPolicy("2026-11-11-phase-b-v1");
const wp2 = runPolicy("2026-11-12-wp2-v1");

const report = {
  frozenRuleCommit: "main @ 89210e3+",
  viewport: "blocking (includes 1024×768)",
  ridRange: `${RID_START}-${RID_END}`,
  maxSteps: MAX_STEPS,
  note: "Full 0-49×2 would exceed agent budget; expand with WP2_RID_END=49 if needed",
  legacy: legacy.error ? legacy : { ...aggregate(legacy.summary), exit: legacy.exit },
  wp2: wp2.error ? wp2 : { ...aggregate(wp2.summary), exit: wp2.exit },
};

const out = "/opt/cursor/artifacts/wp2-policy-baseline.json";
fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ out, report }, null, 2));
