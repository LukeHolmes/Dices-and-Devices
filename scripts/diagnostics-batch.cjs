#!/usr/bin/env node
"use strict";
/**
 * Deterministic diagnostics batch runner (shared harness for R-main vs R78).
 *
 * Usage (examples):
 *   node scripts/diagnostics-batch.cjs --baseline=R-main --rids=0-9 --max-steps=8000
 *   node scripts/diagnostics-batch.cjs --baseline=R78 --rids=60-69 --root=.worktrees/r78
 */

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.join(__dirname, "..");
const TRACKING_DIR = path.join(ROOT, "diagnostics/tracking");
const RUNS_DIR = path.join(TRACKING_DIR, "runs");
const HOLDOUT_LOG = path.join(TRACKING_DIR, "holdout-consumption-log.csv");

const {
  parseRidSpec,
  assertRidsAllowed,
  appendHoldoutConsumptionLog,
} = require(path.join(ROOT, "tests/helpers/holdout-guard.cjs"));
const {
  appendRunRows,
  blankMetricsRow,
  digestRunResult,
} = require(path.join(ROOT, "tests/helpers/run-results-csv.cjs"));

const BASELINES = {
  "R-main": {
    label: "R-main",
    branch: "main",
    rulesCommit: "7d649ef894dda8c3dbad77760e5fd3ecc943b4ba",
    ref: "7d649ef894dda8c3dbad77760e5fd3ecc943b4ba",
  },
  R78: {
    label: "R78",
    branch: "cursor/sim-win-rate-f4c3",
    rulesCommit: "59e11dcf92db3fccba1e44f9ac57f801710577d0",
    ref: "59e11dcf92db3fccba1e44f9ac57f801710577d0",
  },
  "R-main-i": {
    label: "R-main-i",
    branch: "baseline/r-main-instrumented",
    rulesCommit: "81ec337885350491377fa7fbfb222cb87a0d633b",
    ref: "baseline/r-main-instrumented",
    instrumentedFrom: "7d649ef894dda8c3dbad77760e5fd3ecc943b4ba",
  },
  "R78-i": {
    label: "R78-i",
    branch: "baseline/r78-instrumented",
    rulesCommit: "0dffccf7e7d864ab1c9de24d576d3c3c9f0bfd39",
    ref: "baseline/r78-instrumented",
    instrumentedFrom: "59e11dcf92db3fccba1e44f9ac57f801710577d0",
  },
};

const FIXED_POLICY_REVISION = "2026-11-11-phase-b-v1";

function git(cmd) {
  return spawnSync("git", cmd, { cwd: ROOT, encoding: "utf8" });
}

function harnessCommit() {
  const r = git(["rev-parse", "HEAD"]);
  return (r.stdout || "").trim() || "";
}

function policyCommit() {
  const p = path.join(ROOT, "assets/sim-bot-policy.js");
  if (!fs.existsSync(p)) return "";
  const r = git(["hash-object", p]);
  return (r.stdout || "").trim() || "";
}

function parseArgs(argv) {
  const out = {
    baseline: "R-main",
    rids: "0-49,60-109",
    maxSteps: 12_000,
    parallel: 4,
    viewports: "blocking",
    replicate: 1,
    root: "",
    scenario: "pilot-street-rat-safe-cut",
    ruleExperimentArm: "",
    batchId: "",
    experimentId: "EXP-20261118-01-pilot",
    jobId: "",
    holdoutApprovalId: "",
    dryRun: false,
    worktreeAuto: true,
  };
  for (const arg of argv) {
    if (arg.startsWith("--baseline=")) out.baseline = arg.slice(11);
    else if (arg.startsWith("--rids=")) out.rids = arg.slice(7);
    else if (arg.startsWith("--max-steps=")) out.maxSteps = Number(arg.slice(12)) || out.maxSteps;
    else if (arg.startsWith("--parallel=")) out.parallel = Math.max(1, Number(arg.slice(11)) || 1);
    else if (arg.startsWith("--viewports=")) out.viewports = arg.slice(12) || out.viewports;
    else if (arg.startsWith("--replicate=")) out.replicate = Math.max(1, Number(arg.slice(12)) || 1);
    else if (arg.startsWith("--root=")) out.root = path.resolve(arg.slice(7));
    else if (arg.startsWith("--scenario=")) out.scenario = arg.slice(11);
    else if (arg.startsWith("--rule-exp=")) out.ruleExperimentArm = arg.slice(11);
    else if (arg.startsWith("--batch-id=")) out.batchId = arg.slice(11);
    else if (arg.startsWith("--experiment-id=")) out.experimentId = arg.slice(16);
    else if (arg.startsWith("--job-id=")) out.jobId = arg.slice(9);
    else if (arg.startsWith("--holdout-approval-id=")) out.holdoutApprovalId = arg.slice(22);
    else if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--no-worktree") out.worktreeAuto = false;
    else if (arg === "--help" || arg === "-h") out.help = true;
  }
  return out;
}

function usage() {
  console.log(`Usage: node scripts/diagnostics-batch.cjs [options]

Options:
  --baseline=R-main|R78     Rules baseline (default R-main)
  --rids=0-49,60-109        Rid list/ranges (default pilot window)
  --max-steps=N             Step budget per run (default 12000)
  --parallel=N              Playwright parallelism (default 4)
  --viewports=blocking|all  Viewport set (default blocking)
  --replicate=N             Repeat each rid N times (default 1)
  --root=PATH               Rules root (index.html tree); auto worktree if omitted
  --scenario=NAME           Recorded scenario label
  --rule-exp=ARM            SIM_RULE_EXPERIMENTS arm (optional)
  --batch-id=ID             CSV batch id (default generated)
  --experiment-id=ID        Experiment registry id
  --job-id=ID               Bridge job id (optional)
  --holdout-approval-id=ID  Required to run holdout rids 55-59
  --dry-run                 Validate plan only
  --no-worktree             Do not auto-create git worktrees for baselines
`);
}

function ensureRulesRoot(baseline, explicitRoot, worktreeAuto) {
  if (explicitRoot) return explicitRoot;
  if (!worktreeAuto) return ROOT;
  const meta = BASELINES[baseline];
  if (!meta) throw new Error(`Unknown baseline ${baseline}`);
  const wtDir = path.join(ROOT, ".worktrees", baseline.replace(/[^a-zA-Z0-9_-]/g, "_"));
  if (!fs.existsSync(path.join(wtDir, "index.html"))) {
    fs.mkdirSync(path.dirname(wtDir), { recursive: true });
    const add = git(["worktree", "add", "--detach", wtDir, meta.ref]);
    if (add.status !== 0) {
      throw new Error(`git worktree add failed: ${add.stderr || add.stdout}`);
    }
  }
  return wtDir;
}

function buildRidWindows(rids, replicate) {
  const unique = [...new Set(rids)];
  const jobs = [];
  for (const rid of unique) {
    for (let rep = 0; rep < replicate; rep += 1) {
      jobs.push({ rid, replicateIndex: rep, seed: rid * 7919 });
    }
  }
  return jobs;
}

async function runRidWindow({
  rids,
  replicate,
  maxSteps,
  parallel,
  viewports,
  rulesRoot,
  ruleExperimentArm,
}) {
  const { runOneGame, pickViewports, startServer } = require(path.join(ROOT, "tests/sim/run.cjs"));
  const viewportsList = pickViewports(viewports);
  const server = await startServer(0, rulesRoot);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ headless: true });

  const jobs = buildRidWindows(rids, replicate).map((j) => ({
    ...j,
    strategy: "builder",
    viewport: viewportsList[(j.rid >> 2) % viewportsList.length],
  }));

  const results = [];
  let cursor = 0;
  const workers = Math.min(parallel, jobs.length);

  async function worker() {
    while (true) {
      const job = jobs[cursor++];
      if (!job) break;
      const started = Date.now();
      const context = await browser.newContext();
      const page = await context.newPage();
      page.__baseUrl = baseUrl;
      const booted = { value: false };
      try {
        const r = await runOneGame(page, {
          rid: job.rid,
          seed: job.seed,
          strategy: job.strategy,
          viewport: job.viewport,
          maxSteps,
          booted,
        });
        results.push({ ...r, replicateIndex: job.replicateIndex, wallMs: Date.now() - started });
      } catch (e) {
        results.push({
          rid: job.rid,
          seed: job.seed,
          replicateIndex: job.replicateIndex,
          stuck: true,
          reason: "exception",
          detail: String(e).slice(0, 240),
          steps: 0,
          maxRound: 0,
          wallMs: Date.now() - started,
        });
      } finally {
        await context.close();
      }
    }
  }

  await Promise.all(Array.from({ length: workers }, () => worker()));
  await browser.close();
  await new Promise((r) => server.close(r));
  return results;
}

function rowsFromResults({
  results,
  args,
  baselineMeta,
  rulesRoot,
  batchId,
  harnessSha,
  policySha,
}) {
  const diagnosticsSha = harnessSha;
  return results.map((r) => {
    const outcome = r.outcome || (r.stuck ? "STUCK" : "ERROR");
    const digest = digestRunResult(r);
    const linkObs = r.telem?.linkObserver;
    return blankMetricsRow({
      run_id: `${batchId}-${r.rid}-r${r.replicateIndex ?? 0}`,
      batch_id: batchId,
      experiment_id: args.experimentId,
      job_id: args.jobId,
      baseline_label: baselineMeta.label,
      branch: baselineMeta.branch,
      rules_commit: baselineMeta.rulesCommit,
      policy_commit: policySha,
      policy_revision: FIXED_POLICY_REVISION,
      diagnostics_commit: diagnosticsSha,
      harness_commit: harnessSha,
      scenario: args.scenario,
      rule_experiment_arm: args.ruleExperimentArm,
      profile: "street-rat-safe-cut",
      persona_id: "STREET_RAT",
      strategy: r.strategy || "builder",
      gamble_policy: "safe_cut",
      viewport: r.viewport,
      rid: r.rid,
      seed: r.seed ?? r.rid * 7919,
      budget_max_steps: args.maxSteps,
      replicate_index: r.replicateIndex ?? 0,
      holdout_flag: [55, 56, 57, 58, 59].includes(r.rid) ? "Y" : "N",
      holdout_approval_id: args.holdoutApprovalId || "",
      ended_at: new Date().toISOString(),
      wall_ms: r.wallMs ?? "",
      outcome,
      terminal_reason: r.reason || "",
      max_round: r.maxRound ?? "",
      steps: r.steps ?? "",
      final_score: r.telem?.score ?? "",
      final_gold: r.telem?.gold ?? "",
      wins_flag: outcome === "WIN" ? "1" : "0",
      stuck_flag: r.stuck ? "1" : "0",
      organic_link_count: linkObs?.organicLinkCount ?? "",
      chain_depth_peak: linkObs?.chainDepthPeak ?? "",
      replay_digest: digest,
      measurement_valid: "",
      measurement_notes: "",
      evidence_path: rulesRoot,
      runner_host: os.hostname(),
      os: `${os.platform()}-${os.release()}`,
      node_version: process.version,
      llm_calls: "0",
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exit(0);
  }
  if (!BASELINES[args.baseline]) {
    console.error(`Unknown baseline ${args.baseline}. Use R-main or R78.`);
    process.exit(1);
  }

  const rids = parseRidSpec(args.rids);
  if (!rids.length) {
    console.error("No rids in --rids spec.");
    process.exit(1);
  }

  const holdoutCheck = assertRidsAllowed(rids, { approvalId: args.holdoutApprovalId });
  if (!holdoutCheck.ok) {
    console.error(JSON.stringify(holdoutCheck, null, 2));
    process.exit(1);
  }
  if (holdoutCheck.holdouts?.length && holdoutCheck.approved) {
    for (const rid of holdoutCheck.holdouts) {
      appendHoldoutConsumptionLog(HOLDOUT_LOG, {
        ts: new Date().toISOString(),
        rid,
        seed: rid * 7919,
        context: "diagnostics-batch",
        commit: harnessCommit(),
        approved: "Y",
        approval_id: args.holdoutApprovalId || process.env.HOLDOUT_APPROVAL_ID || "",
        outcome_visible: "N",
        notes: "approved holdout execution",
      });
    }
  }

  const baselineMeta = BASELINES[args.baseline];
  const rulesRoot = ensureRulesRoot(args.baseline, args.root, args.worktreeAuto);
  const batchId = args.batchId
    || `batch-${args.baseline}-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const harnessSha = harnessCommit();
  const policySha = policyCommit();

  const plan = {
    batchId,
    baseline: args.baseline,
    rulesCommit: baselineMeta.rulesCommit,
    harnessCommit: harnessSha,
    policyRevision: FIXED_POLICY_REVISION,
    policyCommit: policySha,
    rulesRoot,
    rids,
    replicate: args.replicate,
    totalRuns: rids.length * args.replicate,
    maxSteps: args.maxSteps,
    parallel: args.parallel,
    viewports: args.viewports,
    profile: "street-rat-safe-cut",
    simEnv: {
      SIM_SEED_GAME: "1",
      SIM_STREET_RAT_PROFILE: "1",
      SIM_POLICY_REVISION: FIXED_POLICY_REVISION,
      SIM_LINK_OBSERVER: "1",
      ...(args.ruleExperimentArm ? { SIM_RULE_EXPERIMENTS: args.ruleExperimentArm } : {}),
    },
  };

  console.log(JSON.stringify({ plan }, null, 2));
  if (args.dryRun) process.exit(0);

  const prevEnv = { ...process.env };
  Object.assign(process.env, plan.simEnv);

  const allResults = await runRidWindow({
    rids,
    replicate: args.replicate,
    maxSteps: args.maxSteps,
    parallel: args.parallel,
    viewports: args.viewports,
    rulesRoot,
    ruleExperimentArm: args.ruleExperimentArm,
  });

  Object.assign(process.env, prevEnv);

  const csvPath = path.join(RUNS_DIR, `${batchId}.csv`);
  const rows = rowsFromResults({
    results: allResults,
    args,
    baselineMeta,
    rulesRoot,
    batchId,
    harnessSha,
    policySha,
  });
  appendRunRows(csvPath, rows);

  const summary = {
    batchId,
    csvPath,
    completed: allResults.length,
    wins: allResults.filter((r) => r.outcome === "WIN").length,
    busts: allResults.filter((r) => r.outcome === "BUST").length,
    stuck: allResults.filter((r) => r.stuck && r.outcome !== "WIN" && r.outcome !== "BUST").length,
    denominator: allResults.length,
  };
  console.log(JSON.stringify({ summary }, null, 2));
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = {
  BASELINES,
  FIXED_POLICY_REVISION,
  parseArgs,
  ensureRulesRoot,
  buildRidWindows,
  harnessCommit,
  policyCommit,
};