#!/usr/bin/env node
"use strict";
/**
 * Reproducibility check: rerun seeds and compare outcomes + replay digest.
 * Default: 10 seeds (0-9) × 2 replicates on R-main (avoid holdouts 55-59).
 */

const path = require("node:path");
const fs = require("node:fs");

const ROOT = path.join(__dirname, "..");
const ARTIFACTS = process.env.DIAG_REPRO_ARTIFACT_DIR || "/opt/cursor/artifacts";
const TRACKING_DIR = path.join(ROOT, "diagnostics/tracking");
const RUNS_DIR = path.join(TRACKING_DIR, "runs");

const { parseRidSpec } = require(path.join(ROOT, "tests/helpers/holdout-guard.cjs"));
const {
  appendRunRows,
  blankMetricsRow,
  digestRunResult,
  isNaturalTermination,
  normalizeRunOutcome,
} = require(path.join(ROOT, "tests/helpers/run-results-csv.cjs"));
const {
  classifyTraceDivergence,
  firstTraceDivergence,
} = require(path.join(ROOT, "tests/helpers/sim-canonical-state.cjs"));

async function runPair({ baseline, rids, maxSteps, parallel }) {
  const batch = require(path.join(ROOT, "scripts/diagnostics-batch.cjs"));
  const prev = { ...process.env };
  process.env.SIM_SEED_GAME = "1";
  process.env.SIM_NODE_PACED = "1";
  process.env.SIM_BOOT_SETTLE_MS = process.env.SIM_BOOT_SETTLE_MS || "0";
  process.env.SIM_STREET_RAT_PROFILE = "1";
  process.env.SIM_POLICY_REVISION = batch.FIXED_POLICY_REVISION;
  process.env.SIM_LINK_OBSERVER = "1";
  process.env.SIM_POLICY_OBSERVER = "0";

  const rulesRoot = batch.ensureRulesRoot(baseline, "", true);
  const { runOneGame, pickViewports, startServer } = require(path.join(ROOT, "tests/sim/run.cjs"));
  const { ensurePlaywrightClock, installDeterministicNetwork } = require(path.join(
    ROOT,
    "tests/sim/run-paced-bot.cjs",
  ));
  const viewportsList = pickViewports("blocking");
  const server = await startServer(0, rulesRoot);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ headless: true });

  const byRid = {};

  async function runRep(repIndex) {
    for (const rid of rids) {
      const isoBrowser = await chromium.launch({ headless: true });
      const context = await isoBrowser.newContext();
      await ensurePlaywrightClock(context);
      await installDeterministicNetwork(context);
      const page = await context.newPage();
      page.__baseUrl = baseUrl;
      const booted = { value: false };
      const viewport = viewportsList[(rid >> 2) % viewportsList.length];
      const seed = rid * 7919;
      process.stderr.write(`repro baseline=${baseline} rep=${repIndex} rid=${rid}\n`);
      const wallStart = Date.now();
      const r = await runOneGame(page, {
        rid,
        seed,
        strategy: "builder",
        viewport,
        maxSteps,
        booted,
      });
      await context.close();
      await isoBrowser.close();
      const norm = normalizeRunOutcome(r, { budgetMaxSteps: maxSteps });
      const key = String(rid);
      byRid[key] = byRid[key] || [];
      byRid[key].push({
        replicateIndex: repIndex,
        wallMs: Date.now() - wallStart,
        outcome: norm.outcome || r.outcome || (r.stuck ? "STUCK" : "ERROR"),
        terminalReason: norm.terminal_reason,
        naturalTermination: isNaturalTermination(norm.outcome),
        budgetExhausted: norm.outcome === "INCOMPLETE:BUDGET",
        rawOutcome: r.outcome,
        reason: r.reason,
        stuck: Boolean(r.stuck || norm.stuck_flag === "1"),
        maxRound: r.maxRound,
        steps: r.steps,
        digest: digestRunResult({ ...r, outcome: norm.outcome }),
        stepTrace: r.stepTrace || [],
        gameDrawLog: r.gameDrawLog || [],
      });
    }
  }

  await runRep(0);
  await runRep(1);
  await browser.close();
  await new Promise((r) => server.close(r));
  Object.assign(process.env, prev);
  return byRid;
}

function categorizeDivergence(diverge) {
  if (!diverge || !diverge.a || !diverge.b) return "timer";
  const keys = ["phase", "round", "score", "gold", "hands", "target", "rngDraws", "gameRngDraws", "cosmeticRngDraws"];
  const changed = keys.filter((k) => JSON.stringify(diverge.a[k]) !== JSON.stringify(diverge.b[k]));
  if (changed.includes("rngDraws") || changed.includes("gameRngDraws")) return "RNG";
  if (changed.includes("cosmeticRngDraws") && !changed.some((k) => ["score", "gold", "hands", "target"].includes(k))) {
    return "cosmetic-timing";
  }
  if (changed.includes("cosmeticRngDraws")) return "cosmetic-timing";
  if (changed.some((k) => ["score", "gold", "hands", "target"].includes(k))) {
    if (diverge.a.rngDraws !== diverge.b.rngDraws) return "RNG";
    return "timer";
  }
  if (changed.includes("phase") && diverge.index < 2) return "load";
  if (changed.includes("round") && diverge.index < 3) return "storage";
  if (changed.includes("phase") && diverge.index < 5) return "animation";
  return "timer";
}

function firstDivergingGameDraw(logA, logB, diverge) {
  const a = logA || [];
  const b = logB || [];
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const ea = a[i];
    const eb = b[i];
    if (ea.n !== eb.n || ea.site !== eb.site || ea.v !== eb.v || ea.phase !== eb.phase || ea.drawIndex !== eb.drawIndex) {
      return { drawIndex: i + 1, a: ea, b: eb };
    }
  }
  if (a.length !== b.length) {
    const extra = a.length > b.length ? a[len] : b[len];
    return {
      drawIndex: len + 1,
      a: a[len] || null,
      b: b[len] || null,
      reason: "log_length_mismatch",
      stepDivergence: diverge?.index ?? null,
    };
  }
  if (diverge && diverge.a && diverge.b) {
    const ga = diverge.a.gameRngDraws ?? diverge.a.rngDraws ?? 0;
    const gb = diverge.b.gameRngDraws ?? diverge.b.rngDraws ?? 0;
    if (ga !== gb) {
      const n = Math.min(ga, gb);
      return {
        drawIndex: n + 1,
        a: a[n] || null,
        b: b[n] || null,
        reason: "count_mismatch_at_step",
        stepDivergence: diverge.index,
      };
    }
  }
  return null;
}

function firstDivergingStep(traceA, traceB) {
  const traceDiv = firstTraceDivergence(traceA, traceB);
  if (traceDiv) return traceDiv;
  const a = traceA || [];
  const b = traceB || [];
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const sa = JSON.stringify(a[i]);
    const sb = JSON.stringify(b[i]);
    if (sa !== sb) return { index: i, a: a[i], b: b[i] };
  }
  if (a.length !== b.length) {
    return {
      index: len,
      a: a[len] || null,
      b: b[len] || null,
      reason: "trace_length_mismatch",
      lengths: { a: a.length, b: b.length },
    };
  }
  return null;
}

function summarizeBudget(byRid) {
  let runs = 0;
  let budgetHits = 0;
  for (const reps of Object.values(byRid)) {
    for (const rep of reps) {
      runs += 1;
      if (rep.budgetExhausted) budgetHits += 1;
    }
  }
  return { runs, budgetHits };
}

function comparePairs(byRid, { naturalOnly = false } = {}) {
  let matched = 0;
  let total = 0;
  let skippedNonNatural = 0;
  const mismatches = [];
  for (const [rid, reps] of Object.entries(byRid)) {
    if (reps.length < 2) continue;
    const a = reps[0];
    const b = reps[1];
    if (naturalOnly && (!a.naturalTermination || !b.naturalTermination)) {
      skippedNonNatural += 1;
      continue;
    }
    total += 1;
    const ok =
      a.outcome === b.outcome
      && a.maxRound === b.maxRound
      && a.steps === b.steps
      && a.digest === b.digest;
    if (ok) matched += 1;
    else {
      const diverge = firstDivergingStep(a.stepTrace, b.stepTrace);
      const causeCategory = categorizeDivergence(diverge);
      const causeClassV7 = classifyTraceDivergence(diverge, {
        gameDrawLogA: a.gameDrawLog,
        gameDrawLogB: b.gameDrawLog,
      });
      const firstGameDraw = firstDivergingGameDraw(a.gameDrawLog, b.gameDrawLog, diverge);
      mismatches.push({
        rid,
        causeCategory,
        causeClassV7,
        firstDivergingGameDraw: firstGameDraw,
        a: {
          outcome: a.outcome,
          maxRound: a.maxRound,
          steps: a.steps,
          digest: a.digest,
        },
        b: {
          outcome: b.outcome,
          maxRound: b.maxRound,
          steps: b.steps,
          digest: b.digest,
        },
        firstDivergingStep: diverge,
      });
    }
  }
  return { matched, total, mismatches, skippedNonNatural };
}

function buildMismatchCauseTable(reportBaselines) {
  const rows = [];
  for (const [baseline, data] of Object.entries(reportBaselines)) {
    for (const mm of data.naturalTerminationRepro?.mismatches || data.mismatches || []) {
      const div = mm.firstDivergingStep;
      rows.push({
        baseline,
        rid: mm.rid,
        causeClassV7: mm.causeClassV7 || "unknown",
        causeCategory: mm.causeCategory,
        firstStep: div?.index ?? null,
        stateHashA: div?.a?.stateHash ?? null,
        stateHashB: div?.b?.stateHash ?? null,
        actionA: div?.a?.action ?? null,
        actionB: div?.b?.action ?? null,
        gameRngDrawsA: div?.a?.gameRngDraws ?? null,
        gameRngDrawsB: div?.b?.gameRngDraws ?? null,
        firstDivergingGameDraw: mm.firstDivergingGameDraw ?? null,
      });
    }
  }
  return rows;
}

function parseArgs(argv) {
  const out = {
    baselines: "R-main,R78",
    seeds: "0-9",
    maxSteps: 8000,
    parallel: 2,
  };
  for (const arg of argv) {
    if (arg.startsWith("--baselines=")) out.baselines = arg.slice(12);
    else if (arg.startsWith("--seeds=")) out.seeds = arg.slice(8);
    else if (arg.startsWith("--max-steps=")) out.maxSteps = Number(arg.slice(12)) || out.maxSteps;
    else if (arg.startsWith("--parallel=")) out.parallel = Number(arg.slice(11)) || out.parallel;
    else if (arg === "--help" || arg === "-h") out.help = true;
  }
  return out;
}

function writeTrackingCsv({ report, batchId, maxSteps }) {
  const batch = require(path.join(ROOT, "scripts/diagnostics-batch.cjs"));
  const harnessSha = batch.harnessCommit();
  const policySha = batch.policyCommit();
  const csvPath = path.join(RUNS_DIR, `${batchId}.csv`);
  const rows = [];
  for (const [baseline, data] of Object.entries(report.baselines)) {
    const meta = batch.BASELINES[baseline] || {};
    for (const [rid, reps] of Object.entries(data.byRid || {})) {
      for (const rep of reps) {
        const norm = normalizeRunOutcome(
          { outcome: rep.outcome, reason: rep.reason, steps: rep.steps, terminalReason: rep.terminalReason },
          { budgetMaxSteps: maxSteps },
        );
        rows.push(
          blankMetricsRow({
            run_id: `${batchId}-${baseline}-rid${rid}-r${rep.replicateIndex}`,
            batch_id: batchId,
            experiment_id: "DEF-M-005",
            baseline_label: baseline,
            branch: meta.branch || "",
            rules_commit: meta.rulesCommit || "",
            policy_commit: policySha,
            policy_revision: batch.FIXED_POLICY_REVISION,
            harness_commit: harnessSha,
            scenario: "repro-gate-seeds-0-9-x2",
            profile: "street-rat-safe-cut",
            strategy: "builder",
            rid,
            seed: Number(rid) * 7919,
            budget_max_steps: maxSteps,
            replicate_index: rep.replicateIndex,
            holdout_flag: 0,
            outcome: norm.outcome || rep.outcome,
            terminal_reason: norm.terminal_reason || rep.terminalReason || "",
            max_round: rep.maxRound,
            steps: rep.steps,
            wall_ms: rep.wallMs ?? "",
            replay_digest: rep.digest,
            stuck_flag: norm.stuck_flag || (rep.stuck ? "1" : "0"),
            replay_match: rep.replicateIndex === 0 ? "" : rep.matchPair === true ? 1 : 0,
            measurement_valid:
              norm.measurement_valid !== ""
                ? norm.measurement_valid
                : rep.matchPair === true
                  ? 1
                  : 0,
            measurement_notes:
              norm.measurement_notes
              || (rep.matchPair === true ? "repro_pair_match" : "repro_pair_mismatch"),
            evidence_path: path.join(ARTIFACTS, "diagnostics-repro-report.json"),
            llm_calls: 0,
          }),
        );
      }
    }
  }
  if (rows.length) appendRunRows(csvPath, rows);
  return csvPath;
}

function annotatePairMatches(byRid) {
  for (const reps of Object.values(byRid)) {
    if (reps.length < 2) continue;
    const a = reps[0];
    const b = reps[1];
    const ok =
      a.outcome === b.outcome
      && a.maxRound === b.maxRound
      && a.steps === b.steps
      && a.digest === b.digest;
    a.matchPair = ok;
    b.matchPair = ok;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: node scripts/diagnostics-repro-check.cjs [--baselines=R-main,R78] [--seeds=0-9]");
    process.exit(0);
  }
  const rids = parseRidSpec(args.seeds);
  const baselines = args.baselines.split(",").map((s) => s.trim()).filter(Boolean);
  const report = { rids, baselines: {}, generatedAt: new Date().toISOString() };

  function slimByRid(byRid) {
    const out = {};
    for (const [rid, reps] of Object.entries(byRid)) {
      out[rid] = reps.map((rep) => {
        const { stepTrace, ...rest } = rep;
        return { ...rest, stepTraceSteps: stepTrace?.length || 0 };
      });
    }
    return out;
  }

  for (const baseline of baselines) {
    const byRid = await runPair({ baseline, rids, maxSteps: args.maxSteps, parallel: args.parallel });
    annotatePairMatches(byRid);
    const cmpAll = comparePairs(byRid, { naturalOnly: false });
    const cmpNatural = comparePairs(byRid, { naturalOnly: true });
    const budget = summarizeBudget(byRid);
    report.baselines[baseline] = {
      ...cmpAll,
      naturalTerminationRepro: cmpNatural,
      budgetExhaustion: budget,
      byRid: slimByRid(byRid),
    };
  }

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const instrumentedGate = baselines.some((b) => String(b).endsWith("-i"));
  const batchId = instrumentedGate
    ? process.env.DEFM005_BATCH_ID || "REPRO-DEFM005-20261119-instrumented-v7"
    : `REPRO-DEFM005-${stamp}-vclock-boot`;
  report.batchId = batchId;
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  fs.mkdirSync(RUNS_DIR, { recursive: true });
  const outPath = path.join(ARTIFACTS, "diagnostics-repro-report.json");
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const trackingCsv = writeTrackingCsv({ report, batchId, maxSteps: args.maxSteps });
  report.trackingCsv = trackingCsv;
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const gateSummaryPath = path.join(
    TRACKING_DIR,
    "defects/measurement",
    instrumentedGate
      ? `DEF-M-005-gate-20261119-instrumented-v7.json`
      : `DEF-M-005-gate-${stamp}-vclock-boot.json`,
  );
  const totals = Object.values(report.baselines).reduce(
    (acc, b) => ({
      matched: acc.matched + b.matched,
      total: acc.total + b.total,
      naturalMatched: acc.naturalMatched + (b.naturalTerminationRepro?.matched || 0),
      naturalTotal: acc.naturalTotal + (b.naturalTerminationRepro?.total || 0),
      budgetRuns: acc.budgetRuns + (b.budgetExhaustion?.runs || 0),
      budgetHits: acc.budgetHits + (b.budgetExhaustion?.budgetHits || 0),
    }),
    { matched: 0, total: 0, naturalMatched: 0, naturalTotal: 0, budgetRuns: 0, budgetHits: 0 },
  );
  const divergenceCatalog = [];
  for (const [baseline, data] of Object.entries(report.baselines)) {
    for (const mm of data.mismatches || []) {
      divergenceCatalog.push({
        baseline,
        rid: mm.rid,
        causeCategory: mm.causeCategory || "timer",
        firstDivergingStep: mm.firstDivergingStep || null,
        firstDivergingGameDraw: mm.firstDivergingGameDraw || null,
        tuple: { a: mm.a, b: mm.b },
      });
    }
  }
  const catalogPath = path.join(
    TRACKING_DIR,
    "defects/measurement",
    `DEF-M-005-divergence-${stamp}.json`,
  );
  fs.writeFileSync(catalogPath, `${JSON.stringify({ catalog: divergenceCatalog }, null, 2)}\n`, "utf8");
  const causeTable = buildMismatchCauseTable(report.baselines);
  const causeTablePath = path.join(ARTIFACTS, "v7-mismatch-cause-table.json");
  fs.writeFileSync(causeTablePath, `${JSON.stringify({ batchId, causeTable }, null, 2)}\n`, "utf8");
  report.causeTablePath = causeTablePath;
  report.causeTable = causeTable;

  fs.writeFileSync(
    gateSummaryPath,
    `${JSON.stringify(
      {
        id: "DEF-M-005",
        gate_batch_id: batchId,
        harness_mode: "node_paced_playwright_clock_boot",
        harness_shim_rev: "2026-11-19-harness-clock-v7",
        prior_gate_records: instrumentedGate
          ? [
              { batch: "REPRO-DEFM005-20261119-instrumented-v6", matched: 9, total: 20, note: "natural-only" },
              { batch: "REPRO-DEFM005-20261119-instrumented-v5b", matched: 6, total: 20, note: "natural-only" },
              { batch: "REPRO-DEFM005-20261119", matched: 0, total: 20 },
              { batch: "REPRO-DEFM005-20261119-vclock", matched: 3, total: 20 },
              { batch: "REPRO-DEFM005-20261119-vclock-boot", matched: 2, total: 20, baselines: "R-main,R78" },
              { batch: "REPRO-DEFM005-20261119-instrumented", matched: 3, total: 20, baselines: "R-main-i,R78-i" },
              { batch: "REPRO-DEFM005-20261119-instrumented-v4", note: "interim af8ef9a", matched: 15, total: 20 },
              { batch: "REPRO-DEFM005-20261119-instrumented-v4", note: "f0f79cf", matched: 14, total: 20 },
              { batch: "REPRO-DEFM005-20261119-instrumented-v4b", note: "19de179 opening sniff sync", matched: 12, total: 20 },
              { batch: "REPRO-DEFM005-20261119-instrumented-v4c", note: "81ec337", matched: 14, total: 20 },
            ]
          : [
              { batch: "REPRO-DEFM005-20261119", matched: 0, total: 20 },
              { batch: "REPRO-DEFM005-20261119-vclock", matched: 3, total: 20 },
              { batch: "REPRO-DEFM005-20261119-vclock-boot", matched: 2, total: 20 },
            ],
        generatedAt: report.generatedAt,
        denominators: totals,
        perBaseline: Object.fromEntries(
          Object.entries(report.baselines).map(([k, v]) => [
            k,
            {
              matched: v.matched,
              total: v.total,
              naturalTerminationRepro: v.naturalTerminationRepro,
              budgetExhaustion: v.budgetExhaustion,
            },
          ]),
        ),
        tracking_csv: trackingCsv,
        artifact: outPath,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  console.log(JSON.stringify({
    artifact: outPath,
    results: Object.fromEntries(
      Object.entries(report.baselines).map(([k, v]) => [
        k,
        {
          matched: v.matched,
          total: v.total,
          naturalTerminationRepro: v.naturalTerminationRepro,
          budgetExhaustion: v.budgetExhaustion,
        },
      ]),
    ),
    denominators: totals,
  }, null, 2));

  const failedNatural = Object.values(report.baselines).some(
    (v) => (v.naturalTerminationRepro?.total || 0) > 0
      && v.naturalTerminationRepro.matched !== v.naturalTerminationRepro.total,
  );
  process.exit(failedNatural ? 1 : 0);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { comparePairs, runPair };