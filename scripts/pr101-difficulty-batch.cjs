#!/usr/bin/env node
"use strict";
/**
 * PR #101 difficulty comparison batch (plain rules commits, no instrumented baselines).
 *
 *   node scripts/pr101-difficulty-batch.cjs --arm=old|new
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const RUNS_DIR = path.join(ROOT, "diagnostics/tracking/runs");

const {
  parseRidSpec,
  assertRidsAllowed,
} = require(path.join(ROOT, "tests/helpers/holdout-guard.cjs"));
const {
  appendRunRows,
  blankMetricsRow,
  digestRunResult,
  normalizeRunOutcome,
} = require(path.join(ROOT, "tests/helpers/run-results-csv.cjs"));
const batch = require(path.join(ROOT, "scripts/diagnostics-batch.cjs"));

const ARMS = {
  old: {
    label: "PR101-OLD",
    rules_commit: "7d649ef894dda8c3dbad77760e5fd3ecc943b4ba",
    branch: "main-pre-pr101",
    worktree: path.join(ROOT, ".worktrees/pr101-old"),
  },
  new: {
    label: "PR101-NEW",
    rules_commit: "df7b4e2",
    branch: "main-post-pr101",
    worktree: path.join(ROOT, ".worktrees/pr101-new"),
  },
};

const RIDS = "0-49,60-109";
const MAX_STEPS = 12_000;
const PARALLEL = 6;
const SCENARIO = "pr101-difficulty-street-rat-safe-cut";
const EXPERIMENT_ID = "EXP-PR101-difficulty-20261119";

function git(args) {
  return spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
}

function resolveCommit(sha) {
  const full = git(["rev-parse", sha]);
  if (full.status !== 0) throw new Error(`Unknown commit ${sha}: ${full.stderr}`);
  return full.stdout.trim();
}

function ensureWorktree(arm, fullSha) {
  const wt = arm.worktree;
  const html = path.join(wt, "index.html");
  if (fs.existsSync(html)) {
    const head = git(["-C", wt, "rev-parse", "HEAD"]).stdout.trim();
    if (head.startsWith(fullSha.slice(0, 7)) || head === fullSha) return wt;
  }
  fs.mkdirSync(path.dirname(wt), { recursive: true });
  const fetch = git(["fetch", "origin", fullSha]);
  if (fetch.status !== 0) git(["fetch", "origin", "main"]);
  const add = git(["worktree", "add", "--detach", wt, fullSha]);
  if (add.status !== 0) throw new Error(`worktree add failed: ${add.stderr || add.stdout}`);
  return wt;
}

function summarizeRun(result) {
  const events = result.telem?.roundEvents || [];
  const shopSteps = result.telem?.shopPolicySteps || [];
  const boss = {};
  let highwirePicks = 0;
  let highwireShopRefreshes = 0;
  let saltsOfferedR14 = "";
  let shopVisitsR14 = 0;

  for (const ev of events) {
    if (ev.kind === "round_play_start" && ev.bossId) {
      boss[ev.bossId] = boss[ev.bossId] || { entered: 0, cleared: 0 };
      boss[ev.bossId].entered += 1;
    }
    if (ev.kind === "round_cleared" && ev.bossId) {
      boss[ev.bossId] = boss[ev.bossId] || { entered: 0, cleared: 0 };
      boss[ev.bossId].cleared += 1;
    }
    if (ev.kind === "shop_advance_sink" && ev.pathId === "HIGHWIRE") highwirePicks += 1;
  }
  for (const s of shopSteps) {
    const r = Number(s.round);
    if (r >= 1 && r <= 4) {
      shopVisitsR14 += 1;
      const stock = s.stock;
      if (Array.isArray(stock) && stock.some((x) => (x.id || x.itemId) === "SMELLING_SALTS")) {
        saltsOfferedR14 = saltsOfferedR14 === "" ? 1 : Number(saltsOfferedR14) + 1;
      }
    }
    if (s.selectedShopPathId === "HIGHWIRE" || s.planReason?.includes?.("HIGHWIRE")) {
      highwirePicks += 0;
    }
    if (Number(s.shopRefreshes) > 0) highwireShopRefreshes += Number(s.shopRefreshes);
  }

  if (saltsOfferedR14 === "") saltsOfferedR14 = "";

  return {
    boss_stats_json: JSON.stringify(boss),
    final_cash: result.telem?.gold ?? "",
    highwire_path_picks: highwirePicks,
    highwire_shop_refreshes: highwireShopRefreshes,
    salts_offered_r1_4: saltsOfferedR14,
    shop_visits_r1_4: shopVisitsR14,
    bust_round: result.outcome === "BUST" ? (result.maxRound ?? "") : "",
  };
}

function extraCsvLine(row, extra) {
  const base = Object.values(row).map((v) => {
    if (v == null || v === "") return "";
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  });
  const extraVals = [
    extra.boss_stats_json,
    extra.final_cash,
    extra.highwire_path_picks,
    extra.highwire_shop_refreshes,
    extra.salts_offered_r1_4,
    extra.shop_visits_r1_4,
    extra.bust_round,
  ].map((v) => {
    if (v == null || v === "") return "";
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  });
  return `${[...base, ...extraVals].join(",")}\n`;
}

function ensureCsvWithExtraHeader(filePath) {
  const { CSV_COLUMNS } = require(path.join(ROOT, "tests/helpers/run-results-csv.cjs"));
  const extra = [
    "boss_stats_json",
    "final_cash",
    "highwire_path_picks",
    "highwire_shop_refreshes",
    "salts_offered_r1_4",
    "shop_visits_r1_4",
    "bust_round",
  ];
  if (fs.existsSync(filePath)) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${[...CSV_COLUMNS, ...extra].join(",")}\n`, "utf8");
}

async function main() {
  const armKey = (process.argv.find((a) => a.startsWith("--arm=")) || "").slice(6);
  if (!ARMS[armKey]) {
    console.error("Usage: node scripts/pr101-difficulty-batch.cjs --arm=old|new");
    process.exit(1);
  }
  const arm = ARMS[armKey];
  const fullSha = resolveCommit(arm.rules_commit);
  arm.rules_commit = fullSha;
  const rids = parseRidSpec(RIDS);
  const hold = assertRidsAllowed(rids, { approvalId: "" });
  if (!hold.ok) {
    console.error(JSON.stringify(hold));
    process.exit(1);
  }
  const rulesRoot = ensureWorktree(arm, fullSha);
  const batchId = `DIFF-PR101-20261119-${armKey}`;
  const csvPath = path.join(RUNS_DIR, `${batchId}.csv`);
  ensureCsvWithExtraHeader(csvPath);

  const harnessSha = batch.harnessCommit();
  const policySha = batch.policyCommit();
  const prev = { ...process.env };
  process.env.SIM_SEED_GAME = "1";
  process.env.SIM_STREET_RAT_PROFILE = "1";
  process.env.SIM_POLICY_REVISION = batch.FIXED_POLICY_REVISION;
  process.env.SIM_LINK_OBSERVER = "1";
  delete process.env.SIM_NODE_PACED;

  console.error(`pr101 ${armKey}: rules=${fullSha.slice(0, 12)} rids=${rids.length} parallel=${PARALLEL}`);

  const results = await batch.runRidWindow({
    rids,
    replicate: 1,
    maxSteps: MAX_STEPS,
    parallel: PARALLEL,
    viewports: "blocking",
    rulesRoot,
    ruleExperimentArm: "",
  });
  Object.assign(process.env, prev);

  for (const r of results) {
    const norm = normalizeRunOutcome(r, { budgetMaxSteps: MAX_STEPS });
    const outcome = norm.outcome || r.outcome || (r.stuck ? "STUCK" : "ERROR");
    const digest = digestRunResult({ ...r, outcome });
    const extra = summarizeRun({ ...r, outcome });
    const row = blankMetricsRow({
      run_id: `${batchId}-${r.rid}`,
      batch_id: batchId,
      experiment_id: EXPERIMENT_ID,
      baseline_label: arm.label,
      branch: arm.branch,
      rules_commit: fullSha,
      policy_commit: policySha,
      policy_revision: batch.FIXED_POLICY_REVISION,
      diagnostics_commit: harnessSha,
      harness_commit: harnessSha,
      scenario: SCENARIO,
      profile: "street-rat-safe-cut",
      persona_id: "STREET_RAT",
      strategy: r.strategy || "builder",
      gamble_policy: "safe_cut",
      viewport: r.viewport,
      rid: r.rid,
      seed: r.seed ?? r.rid * 7919,
      budget_max_steps: MAX_STEPS,
      replicate_index: 0,
      holdout_flag: "N",
      ended_at: new Date().toISOString(),
      wall_ms: r.wallMs ?? "",
      outcome,
      terminal_reason: norm.terminal_reason,
      max_round: r.maxRound ?? "",
      steps: r.steps ?? "",
      final_score: r.telem?.score ?? "",
      final_gold: r.telem?.gold ?? "",
      wins_flag: outcome === "WIN" ? "1" : "0",
      stuck_flag: norm.stuck_flag || (r.stuck ? "1" : "0"),
      measurement_valid: norm.measurement_valid,
      measurement_notes: norm.measurement_notes || "",
      organic_link_count: r.telem?.linkObserver?.organicLinkCount ?? "",
      chain_depth_peak: r.telem?.linkObserver?.chainDepthPeak ?? "",
      replay_digest: digest,
      evidence_path: rulesRoot,
      runner_host: os.hostname(),
      os: `${os.platform()}-${os.release()}`,
      node_version: process.version,
      llm_calls: "0",
    });
    fs.appendFileSync(csvPath, extraCsvLine(row, extra));
    process.stderr.write(`pr101 ${armKey} rid=${r.rid} outcome=${outcome} maxRound=${r.maxRound}\n`);
  }

  console.log(JSON.stringify({ arm: armKey, csvPath, completed: results.length }, null, 2));
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { ARMS, summarizeRun };