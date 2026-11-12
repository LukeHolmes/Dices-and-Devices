#!/usr/bin/env node
"use strict";
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const runCjs = path.join(ROOT, "tests/sim/run.cjs");
const RID_START = Number(process.env.WP2_RID_START || 0);
const RID_END = Number(process.env.WP2_RID_END || 9);
const games = RID_END - RID_START + 1;
const MAX_STEPS = Number(process.env.WP2_MAX_STEPS || 4000);

const REVISION_MAP = {
  legacy: "2026-11-11-phase-b-v1",
  lane: "2026-11-12-wp2-lane-v1",
  wp3: "2026-11-12-wp3-shop-v1",
};
const POLICIES = (process.env.WP2_POLICY_SET || "legacy,lane,wp3").split(",").map((s) => s.trim());
const STAGES = [
  "offered", "bought", "carved_separate", "rolled_together", "slot_aligned", "scored",
];

function mergeLinkObserver(rows) {
  const acc = {
    families: {},
    sameDieKitCarveCollisions: 0,
    shadow: { decisions: 0, missedLinks: 0, missedClears: 0 },
    cashSqueeze: {
      visits: 0,
      couldAffordAnyKitPiece: 0,
      couldNotAffordKitPiece: 0,
      twoPieceCosts: [],
    },
  };
  for (const lo of rows) {
    if (!lo) continue;
    acc.sameDieKitCarveCollisions += lo.sameDieKitCarveCollisions || 0;
    acc.shadow.decisions += lo.shadow?.decisions || 0;
    acc.shadow.missedLinks += lo.shadow?.missedLinks || 0;
    acc.shadow.missedClears += lo.shadow?.missedClears || 0;
    const cs = lo.cashSqueeze || {};
    acc.cashSqueeze.visits += cs.visits || 0;
    acc.cashSqueeze.couldAffordAnyKitPiece += cs.couldAffordAnyKitPiece || 0;
    acc.cashSqueeze.couldNotAffordKitPiece += cs.couldNotAffordKitPiece || 0;
    acc.cashSqueeze.twoPieceCosts.push(...(cs.twoPieceChainCostSamples || []));
    for (const [fam, stages] of Object.entries(lo.families || {})) {
      acc.families[fam] = acc.families[fam] || Object.fromEntries(STAGES.map((s) => [s, 0]));
      for (const s of STAGES) acc.families[fam][s] += stages[s] || 0;
    }
  }
  const sorted = acc.cashSqueeze.twoPieceCosts.sort((a, b) => a - b);
  acc.cashSqueeze.twoPieceMedian = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  delete acc.cashSqueeze.twoPieceCosts;
  return acc;
}

function funnelDrop(families) {
  const out = {};
  for (const [fam, stages] of Object.entries(families)) {
    const row = { counts: {}, retainPct: {} };
    let prev = null;
    for (const s of STAGES) {
      const v = stages[s] || 0;
      row.counts[s] = v;
      if (prev != null && prev > 0) row.retainPct[`${s}|from:${STAGES[STAGES.indexOf(s) - 1]}`] = Math.round((100 * v) / prev);
      prev = v;
    }
    out[fam] = row;
  }
  return out;
}

function runPolicy(label) {
  const revision = REVISION_MAP[label] || label;
  const r = spawnSync(
    process.execPath,
    [runCjs, `--games=${games}`, `--max-steps=${MAX_STEPS}`, "--parallel=1", "--viewports=blocking"],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        SIM_POLICY_REVISION: revision,
        WP2_RID_OFFSET: String(RID_START),
        SIM_LINK_OBSERVER: "1",
      },
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    },
  );
  const text = (r.stderr || "") + (r.stdout || "");
  const start = text.lastIndexOf('\n{\n  "games"');
  if (start < 0) return { label, revision, error: "no_summary", exit: r.status };
  const summary = JSON.parse(text.slice(start + 1));
  const rows = summary.linkObserverByRid
    ? Object.values(summary.linkObserverByRid)
    : [];
  const merged = mergeLinkObserver(rows);
  const stuck = (summary.failures || []).filter(
    (f) => f.reason === "incomplete" || String(f.detail || "").includes("stuck"),
  ).length;
  return {
    label,
    revision,
    exit: r.status,
    games: summary.completed || games,
    wins: summary.wins || 0,
    busts: summary.busts || 0,
    maxRoundMedian: summary.maxRoundMedian ?? null,
    stuckRuns: stuck,
    funnel: funnelDrop(merged.families),
    families: merged.families,
    shadow: merged.shadow,
    cashSqueeze: merged.cashSqueeze,
    sameDieKitCarveCollisions: merged.sameDieKitCarveCollisions,
  };
}

const policies = {};
for (const label of POLICIES) {
  policies[label] = runPolicy(label);
}

const report = {
  ridRange: `${RID_START}-${RID_END}`,
  maxSteps: MAX_STEPS,
  note: "link observer pass (bot policy active)",
  policies,
};

const outPath = process.env.LINK_OBSERVER_OUT || "/opt/cursor/artifacts/link-observer-measurement.json";
fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
