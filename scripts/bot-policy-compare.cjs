#!/usr/bin/env node
"use strict";
/**
 * 100-seed bot policy pilot on 6f4dc92-main (rids 0-49,60-109). Compares measurement policies only.
 */
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.join(__dirname, "..");
const RUNS = path.join(ROOT, "diagnostics/tracking/runs");
const OUT_JSON = path.join(RUNS, "EXP-BOT-POLICY-100-main.json");

const { ensureRulesRoot, runRidWindow, harnessCommit } = require("./diagnostics-batch.cjs");

const RIDS = [...Array.from({ length: 50 }, (_, i) => i), ...Array.from({ length: 50 }, (_, i) => 60 + i)];

const VARIANTS = [
  {
    id: "builder-phase-b-v1",
    label: "builder + 2026-11-11-phase-b-v1 (F1 default)",
    strategy: "builder",
    simPolicyRevision: "2026-11-11-phase-b-v1",
    labelNote: "verified baseline",
  },
  {
    id: "builder-wp3-shop",
    label: "builder + 2026-11-12-wp3-shop-v1 (smarter shop/carve)",
    strategy: "builder",
    simPolicyRevision: "2026-11-12-wp3-shop-v1",
    labelNote: "verified policy variant",
  },
  {
    id: "greedy-phase-b-v1",
    label: "greedy + 2026-11-11-phase-b-v1 (weak play heuristic)",
    strategy: "greedy",
    simPolicyRevision: "2026-11-11-phase-b-v1",
    labelNote: "verified contrast",
  },
];

async function runVariant(v) {
  const baseline = "6f4dc92-main";
  const batchId = `EXP-BOT-${v.id}`;
  const rulesRoot = ensureRulesRoot(baseline, "", true);
  const harnessSha = harnessCommit();
  const prev = { ...process.env };
  Object.assign(process.env, {
    SIM_SEED_GAME: "1",
    SIM_STREET_RAT_PROFILE: "1",
    SIM_POLICY_REVISION: v.simPolicyRevision,
    SIM_LINK_OBSERVER: "1",
  });
  const results = await runRidWindow({
    rids: RIDS,
    replicate: 1,
    maxSteps: 6000,
    parallel: 8,
    viewports: "blocking",
    rulesRoot,
    strategyName: v.strategy,
  });
  Object.assign(process.env, prev);
  const wins = results.filter((r) => r.outcome === "WIN").length;
  const natural = results.filter((r) => r.outcome === "WIN" || r.outcome === "BUST");
  return { variant: v, results, wins, n: natural.length, harnessSha, batchId };
}

async function main() {
  const arms = [];
  for (const v of VARIANTS) {
    const row = await runVariant(v);
    arms.push({
      label: row.variant.label,
      labelNote: row.variant.labelNote,
      strategy: row.variant.strategy,
      simPolicyRevision: row.variant.simPolicyRevision,
      n: row.n,
      wins: row.wins,
      harness_commit: row.harnessSha,
    });
    console.log(JSON.stringify({ done: v.id, wins: row.wins, n: row.n }, null, 2));
  }

  const base = arms[0];
  const wp3 = arms.find((a) => a.simPolicyRevision.includes("wp3"));
  const greedy = arms.find((a) => a.strategy === "greedy");
  let verdict = "";
  if (wp3 && wp3.wins > base.wins + 2) {
    verdict = "**Measurement limit (tentative):** Smarter shop policy (`wp3-shop-v1`) wins materially more than F1 default on the same seeds — near-zero F1 win rate partly reflects **bot/policy ceiling**, not only game balance.";
  } else if (greedy && greedy.wins < base.wins) {
    verdict = "**Gameplay-limited (tentative):** Weaker `greedy` play wins less than `builder`+phase-b-v1; near-zero win rate is **not** explained by builder being accidentally weak vs a trivial heuristic.";
  } else {
    verdict = "**Inconclusive (tentative):** No variant wins dramatically more on n=100; near-zero 1k win rate likely **gameplay/quota** not obvious bot bug. Extend n or add wp3 if wp3≈base.";
  }

  const payload = {
    experiment: "EXP-BOT-POLICY-100-main",
    rids: RIDS,
    arms,
    verdict,
    harness_commit: harnessCommit(),
  };
  fs.writeFileSync(OUT_JSON, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(payload, null, 2));
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}