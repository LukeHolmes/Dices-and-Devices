#!/usr/bin/env node
"use strict";
/**
 * Per-seed wp3-shop-v1 kit shop diagnosis (seeds 0-9 via rid offset).
 * Bot/sim only — reads __GB_SIM_TELEM__.shopPolicySteps from in-browser runs.
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const runCjs = path.join(ROOT, "tests/sim/run.cjs");
const KIT_IDS = ["BOOKENDS", "GHOST_FACE", "ECHO_FACE"];
const RID_START = Number(process.env.WP2_RID_START || 0);
const RID_END = Number(process.env.WP2_RID_END || 9);
const games = RID_END - RID_START + 1;

const runOnce = spawnSync(
  process.execPath,
  [runCjs, `--games=${games}`, "--max-steps=4000", "--parallel=2", "--viewports=blocking"],
  {
    cwd: ROOT,
    env: {
      ...process.env,
      SIM_POLICY_REVISION: "2026-11-12-wp3-shop-v1",
      WP2_RID_OFFSET: String(RID_START),
      SIM_EXPORT_SHOP_STEPS: "1",
      SIM_SHOP_STEPS_PATH: path.join(ROOT, ".tmp-wp3-kit-shop-steps.json"),
    },
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  },
);

if (runOnce.status !== 0 && runOnce.status !== 1) {
  console.error(runOnce.stderr || runOnce.stdout);
  process.exit(runOnce.status || 1);
}

const text = (runOnce.stderr || "") + (runOnce.stdout || "");
const marker = '\n{\n  "games"';
const start = text.lastIndexOf(marker);
if (start < 0) {
  console.error("missing summary", text.slice(-500));
  process.exit(1);
}
const summary = JSON.parse(text.slice(start + 1));
let shopByRid = {};
if (summary.shopPolicyExportPath && fs.existsSync(summary.shopPolicyExportPath)) {
  shopByRid = JSON.parse(fs.readFileSync(summary.shopPolicyExportPath, "utf8"));
}

function summarizeRid(rid, steps) {
  const offers = { BOOKENDS: 0, GHOST_FACE: 0, ECHO_FACE: 0 };
  const offerWithAfford = { BOOKENDS: 0, GHOST_FACE: 0, ECHO_FACE: 0 };
  const decisions = {};
  let shopVisits = 0;
  let lastRound = null;
  for (const s of steps || []) {
    if (s.round !== lastRound) {
      shopVisits += 1;
      lastRound = s.round;
    }
    for (const st of s.stock || []) {
      offers[st.id] = (offers[st.id] || 0) + 1;
      const need = st.price + (s.reserve || 0);
      if ((s.gold || 0) >= need) offerWithAfford[st.id] = (offerWithAfford[st.id] || 0) + 1;
    }
    const key = `${s.planFamily}:${s.planAction}:${s.planReason}`;
    decisions[key] = (decisions[key] || 0) + 1;
  }
  return { shopVisits, offers, offerWithAfford, topDecisions: decisions };
}

const perSeed = {};
for (let rid = RID_START; rid <= RID_END; rid++) {
  perSeed[rid] = summarizeRid(rid, shopByRid[rid]);
}

const out = { summary: summary.failures, perSeed, aggregate: {} };
for (const id of KIT_IDS) {
  let offers = 0;
  let afford = 0;
  for (const row of Object.values(perSeed)) {
    offers += row.offers[id] || 0;
    afford += row.offerWithAfford[id] || 0;
  }
  out.aggregate[id] = { kitOffersSeen: offers, affordableSnapshots: afford };
}

const outPath = process.env.WP3_KIT_DIAG_OUT || "/opt/cursor/artifacts/wp3-kit-shop-diagnostic.json";
fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify(out, null, 2));
