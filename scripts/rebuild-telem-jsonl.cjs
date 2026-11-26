#!/usr/bin/env node
"use strict";
/**
 * Re-run sims for an existing batch CSV and overwrite *.telem.jsonl only (no CSV append).
 * Usage:
 *   node scripts/rebuild-telem-jsonl.cjs --baseline=6f4dc92-main --batch-id=F1F2-PILOT-6f4dc92-main --max-steps=6000
 */
const fs = require("node:fs");
const path = require("node:path");
const {
  BASELINES,
  FIXED_POLICY_REVISION,
  ensureRulesRoot,
  runRidWindow,
} = require("./diagnostics-batch.cjs");

const ROOT = path.join(__dirname, "..");
const RUNS_DIR = path.join(ROOT, "diagnostics/tracking/runs");

function parseArgs(argv) {
  const out = { maxSteps: 6000, parallel: 4, viewports: "blocking" };
  for (const raw of argv) {
  if (raw === "--help") out.help = true;
  else if (raw.startsWith("--baseline=")) out.baseline = raw.slice("--baseline=".length);
  else if (raw.startsWith("--batch-id=")) out.batchId = raw.slice("--batch-id=".length);
  else if (raw.startsWith("--max-steps=")) out.maxSteps = Number(raw.slice("--max-steps=".length));
  else if (raw.startsWith("--parallel=")) out.parallel = Number(raw.slice("--parallel=".length));
  }
  return out;
}

function parseCsvRids(csvPath) {
  const text = fs.readFileSync(csvPath, "utf8").trim();
  const lines = text.split(/\r?\n/);
  const hdr = lines[0].split(",");
  const ridIdx = hdr.indexOf("rid");
  const seeds = new Map();
  for (const line of lines.slice(1)) {
    const cols = line.split(",");
    const rid = Number(cols[ridIdx]);
    const seedIdx = hdr.indexOf("seed");
    seeds.set(rid, Number(cols[seedIdx]));
  }
  return [...seeds.keys()].sort((a, b) => a - b);
}

function telemLine(r, capDefault) {
  const t = r.telem || {};
  const hands = t.hands || [];
  const validHands = hands.filter((h) => h.valid);
  const upperAfter = hands.filter((h) => h.isUpper && h.valid && h.upperBonusActiveBefore);
  const upperAtCap = upperAfter.filter((h) => Number(h.categoryMult) >= capDefault - 0.01);
  const round1Cleared = (t.roundEvents || []).some((e) => e.kind === "round_cleared" && e.round === 1);
  return JSON.stringify({
    rid: r.rid,
    seed: r.seed,
    outcome: r.outcome,
    max_round: r.maxRound,
    round1_cleared: round1Cleared,
    upper_bonus_activation: t.upperBonusActivation || null,
    upper_at_cap_share: upperAfter.length ? upperAtCap.length / upperAfter.length : null,
    upper_after_bonus_hands: upperAfter.length,
    slop_pick_share: validHands.length
      ? validHands.filter((h) => h.isSlop).length / validHands.length
      : null,
    boss_clears: t.bossClears || {},
    boss_enters: t.bossEnters || {},
    gamble_choices: (t.gambleChoices || []).length,
    early_debt_events: (t.earlyDebtEvents || []).length,
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.baseline || !args.batchId) {
    console.error("Usage: --baseline=... --batch-id=...");
    process.exit(1);
  }
  const baselineMeta = BASELINES[args.baseline];
  if (!baselineMeta) throw new Error(`Unknown baseline ${args.baseline}`);
  const csvPath = path.join(RUNS_DIR, `${args.batchId}.csv`);
  if (!fs.existsSync(csvPath)) throw new Error(`Missing ${csvPath}`);
  const rids = parseCsvRids(csvPath);
  const rulesRoot = ensureRulesRoot(args.baseline, "", true);
  const capDefault = baselineMeta.scoringVariant === "F2_REVERT" ? 2.5 : 3;
  const prev = { ...process.env };
  Object.assign(process.env, {
    SIM_SEED_GAME: "1",
    SIM_STREET_RAT_PROFILE: "1",
    SIM_POLICY_REVISION: FIXED_POLICY_REVISION,
    SIM_LINK_OBSERVER: "1",
    ...(baselineMeta.scoringVariant ? { SIM_SCORING_VARIANT: baselineMeta.scoringVariant } : {}),
  });
  const results = await runRidWindow({
    rids,
    replicate: 1,
    maxSteps: args.maxSteps,
    parallel: args.parallel,
    viewports: args.viewports,
    rulesRoot,
    ruleExperimentArm: "",
  });
  Object.assign(process.env, prev);
  const telemPath = path.join(RUNS_DIR, `${args.batchId}.telem.jsonl`);
  const lines = results
    .sort((a, b) => a.rid - b.rid)
    .map((r) => telemLine(r, capDefault));
  fs.writeFileSync(telemPath, `${lines.join("\n")}\n`, "utf8");
  const withUb = lines.filter((l) => l.includes('"upper_bonus_activation":{')).length;
  console.log(JSON.stringify({ telemPath, rows: lines.length, upperBonusActivations: withUb }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});