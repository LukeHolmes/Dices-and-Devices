#!/usr/bin/env node
"use strict";
/** Compare main vs Bp telemetry for shared rids (sanity for F2 revert). */
const path = require("node:path");
const { runRidWindow } = require(path.join(__dirname, "diagnostics-batch.cjs"));

const RIDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const MAX_STEPS = 6000;

async function arm(label, scoringVariant) {
  const prev = { ...process.env };
  Object.assign(process.env, {
    SIM_SEED_GAME: "1",
    SIM_STREET_RAT_PROFILE: "1",
    SIM_POLICY_REVISION: "2026-11-11-phase-b-v1",
    SIM_LINK_OBSERVER: "1",
    SIM_SCORING_VARIANT: scoringVariant || "",
  });
  const results = await runRidWindow({
    rids: RIDS,
    replicate: 1,
    maxSteps: MAX_STEPS,
    parallel: 2,
    viewports: "blocking",
    rulesRoot: path.join(__dirname, ".."),
    ruleExperimentArm: "",
  });
  Object.assign(process.env, prev);
  return { label, results };
}

function summarizeHands(telem) {
  const hands = telem?.hands || [];
  const upper = hands.filter((h) => h.isUpper && h.valid);
  const afterBonus = upper.filter((h) => h.upperBonusActiveBefore);
  return { totalHands: hands.length, upperScored: upper.length, upperAfterBonus: afterBonus.length };
}

function firstDivergentHand(mainHands, bpHands) {
  const byIdx = Math.min(mainHands.length, bpHands.length);
  for (let i = 0; i < byIdx; i += 1) {
    const a = mainHands[i];
    const b = bpHands[i];
    if (a.categoryId !== b.categoryId) continue;
    if (a.round !== b.round) continue;
    if ((a.total || 0) !== (b.total || 0)) {
      return { index: i, main: a, bp: b };
    }
  }
  return null;
}

async function main() {
  const [mainArm, bpArm] = await Promise.all([arm("main", ""), arm("Bp", "F2_REVERT")]);
  const byRidMain = Object.fromEntries(mainArm.results.map((r) => [r.rid, r]));
  const byRidBp = Object.fromEntries(bpArm.results.map((r) => [r.rid, r]));

  let divergent = null;
  const rows = [];
  for (const rid of RIDS) {
    const m = byRidMain[rid];
    const b = byRidBp[rid];
    const ms = summarizeHands(m?.telem);
    const bs = summarizeHands(b?.telem);
    const div = firstDivergentHand(m?.telem?.hands || [], b?.telem?.hands || []);
    if (div && !divergent) divergent = { rid, ...div };
    rows.push({
      rid,
      mainMaxRound: m?.maxRound,
      bpMaxRound: b?.maxRound,
      mainUpperActivation: m?.telem?.upperBonusActivation,
      bpUpperActivation: b?.telem?.upperBonusActivation,
      mainAfterBonus: ms.upperAfterBonus,
      bpAfterBonus: bs.upperAfterBonus,
      firstDiff: div ? { handIndex: div.index, cat: div.main.categoryId, mainTotal: div.main.total, bpTotal: div.bp.total } : null,
    });
  }

  const out = { divergentExample: divergent, rows };
  console.log(JSON.stringify(out, null, 2));
  if (!divergent) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});