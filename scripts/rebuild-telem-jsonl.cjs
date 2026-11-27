#!/usr/bin/env node
"use strict";
/**
 * Re-run sims for an existing batch CSV and write *.telem-v2.jsonl (does not touch CSV).
 */
const fs = require("node:fs");
const path = require("node:path");
const {
  BASELINES,
  FIXED_POLICY_REVISION,
  ensureRulesRoot,
  runRidWindow,
  harnessCommit,
} = require("./diagnostics-batch.cjs");
const { buildTelemSidecarLine } = require("./telem-sidecar.cjs");

const ROOT = path.join(__dirname, "..");
const RUNS_DIR = path.join(ROOT, "diagnostics/tracking/runs");

function parseArgs(argv) {
  const out = { maxSteps: 6000, parallel: 8, viewports: "blocking", telemVersion: "v2" };
  for (const raw of argv) {
    if (raw === "--help") out.help = true;
    else if (raw.startsWith("--baseline=")) out.baseline = raw.slice("--baseline=".length);
    else if (raw.startsWith("--batch-id=")) out.batchId = raw.slice("--batch-id=".length);
    else if (raw.startsWith("--max-steps=")) out.maxSteps = Number(raw.slice("--max-steps=".length));
    else if (raw.startsWith("--parallel=")) out.parallel = Number(raw.slice("--parallel=".length));
    else if (raw.startsWith("--telem-version=")) out.telemVersion = raw.slice("--telem-version=".length);
  }
  return out;
}

function parseCsvRids(csvPath) {
  const text = fs.readFileSync(csvPath, "utf8").trim();
  const lines = text.split(/\r?\n/);
  const headers = lines[0].split(",");
  const ridIdx = headers.indexOf("rid");
  const out = new Set();
  for (const line of lines.slice(1)) {
    const cols = line.split(",");
    out.add(Number(cols[ridIdx]));
  }
  return [...out].filter(Number.isFinite).sort((a, b) => a - b);
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
  const hSha = harnessCommit();
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
  const telemPath = path.join(RUNS_DIR, `${args.batchId}.telem-${args.telemVersion}.jsonl`);
  const lines = results
    .sort((a, b) => a.rid - b.rid)
    .map((r) =>
      JSON.stringify(
        buildTelemSidecarLine(r, {
          capDefault,
          harnessCommit: hSha,
          telemVersion: args.telemVersion,
        }),
      ),
    );
  fs.writeFileSync(telemPath, `${lines.join("\n")}\n`, "utf8");
  const withUb = lines.filter((l) => l.includes('"upper_bonus_activation":{')).length;
  const withHands = results.filter((r) => (r.telem?.hands || []).length > 0).length;
  console.log(
    JSON.stringify(
      { telemPath, harnessCommit: hSha, rows: lines.length, upperBonusActivations: withUb, runsWithHands: withHands },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});