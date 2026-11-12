#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const runCjs = path.join(ROOT, "tests/sim/run.cjs");

const GAMES = Number(process.env.EXP_MATRIX_GAMES || 50);
const MAX_STEPS = Number(process.env.EXP_MATRIX_MAX_STEPS || 4000);
const PARALLEL = Number(process.env.EXP_MATRIX_PARALLEL || 6);

const POLICY_MAP = {
  wp3: "2026-11-12-wp3-shop-v1",
  legacy: "2026-11-11-phase-b-v1",
};

const ARMS = [
  { id: "baseline", ruleExp: "" },
  { id: "e1", ruleExp: "e1" },
  { id: "e2", ruleExp: "e2" },
  { id: "e3", ruleExp: "e3" },
  { id: "all", ruleExp: "e1,e2,e3" },
];

function parseSummary(text) {
  const marker = '\n{\n  "games"';
  const start = text.lastIndexOf(marker);
  if (start < 0) return null;
  return JSON.parse(text.slice(start + 1));
}

function mergeObserver(rows) {
  const shadow = { decisions: 0, missedLinks: 0, missedClears: 0 };
  const families = {};
  for (const lo of rows) {
    if (!lo?.shadow) continue;
    shadow.decisions += lo.shadow.decisions || 0;
    shadow.missedLinks += lo.shadow.missedLinks || 0;
    shadow.missedClears += lo.shadow.missedClears || 0;
    for (const [fam, stages] of Object.entries(lo.families || {})) {
      families[fam] = families[fam] || {};
      for (const [k, v] of Object.entries(stages || {})) {
        families[fam][k] = (families[fam][k] || 0) + v;
      }
    }
  }
  return { shadow, families };
}

function analyzePerRidLinks(summary) {
  const out = { runsWithLink: 0, runs2Families: 0 };
  const rows = summary.linkObserverByRid || {};
  for (const lo of Object.values(rows)) {
    if (!lo) continue;
    const famHits = new Set();
    let anyActivity = false;
    for (const [fam, stages] of Object.entries(lo.families || {})) {
      const scored = stages.scored || 0;
      const rolled = stages.rolled_together || 0;
      const carved = stages.carved_separate || 0;
      if (scored > 0 || rolled > 0 || carved > 0) {
        famHits.add(fam);
        anyActivity = true;
      }
    }
    if (anyActivity) out.runsWithLink += 1;
    if (famHits.size >= 2) out.runs2Families += 1;
  }
  return out;
}

function runSim(policyLabel, arm) {
  const revision = POLICY_MAP[policyLabel];
  const r = spawnSync(
    process.execPath,
    [
      runCjs,
      `--games=${GAMES}`,
      `--max-steps=${MAX_STEPS}`,
      `--parallel=${PARALLEL}`,
      "--viewports=blocking",
    ],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        SIM_POLICY_REVISION: revision,
        SIM_LINK_OBSERVER: "1",
        SIM_RULE_EXPERIMENTS: arm.ruleExp,
      },
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  const text = (r.stderr || "") + (r.stdout || "");
  const summary = parseSummary(text);
  if (!summary) {
    return { error: "no_summary", exit: r.status, policy: policyLabel, arm: arm.id };
  }
  const linkRows = summary.linkObserverByRid
    ? Object.values(summary.linkObserverByRid)
    : [];
  const obs = mergeObserver(linkRows);
  const linkStats = analyzePerRidLinks(summary);
  const ge = summary.laneTelemetry || {};
  const fam = obs.families["ghost_echo→bookends_retrigger"] || {};
  const stuck = (summary.failures || []).filter((f) => f.reason === "incomplete").length;

  return {
    exit: r.status,
    policy: policyLabel,
    arm: arm.id,
    ruleExp: arm.ruleExp,
    games: summary.completed,
    wins: summary.wins || 0,
    winRate: summary.winRate ?? 0,
    busts: summary.busts || 0,
    maxRoundMedian: summary.maxRoundMedian,
    avgMaxRound: summary.avgMaxRound,
    fullKits: ge.fullKitRuns || 0,
    runsWithLink: linkStats.runsWithLink,
    runs2Families: linkStats.runs2Families,
    funnel: {
      offered: fam.offered || 0,
      bought: fam.bought || 0,
      carved: fam.carved_separate || 0,
      rolled: fam.rolled_together || 0,
      aligned: fam.slot_aligned || 0,
      scored: fam.scored || 0,
    },
    missedClears: obs.shadow.missedClears,
    missedLinks: obs.shadow.missedLinks,
    stuckRuns: stuck,
  };
}

const results = [];
for (const arm of ARMS) {
  for (const policy of ["wp3", "legacy"]) {
    process.stderr.write(`matrix arm=${arm.id} policy=${policy} n=${GAMES}\n`);
    results.push(runSim(policy, arm));
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  games: GAMES,
  maxSteps: MAX_STEPS,
  seedRids: `0-${GAMES - 1}`,
  holdout: "55-59 excluded",
  e3Applied: "+$5 starting gold (chosen over −$6 first sink; see GutterbonesRuleExperiments.TUNING)",
  gates: {
    runs2Families: "≥13/50",
    meanMaxRound: "≥6.8",
    winRate: "10–30%",
    missedClears: 0,
  },
  rows: results,
};

const out = process.env.EXP_MATRIX_OUT || "/opt/cursor/artifacts/rule-experiments-matrix.json";
fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
