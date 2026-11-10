"use strict";
/**
 * Normal-play organic frequency denominators (builder traces, no grants).
 * Aggregates post-kit hands across seeds.
 */
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const script = path.join(__dirname, "organic-milestone-trace.cjs");
const count = Number(process.argv[2] || 24);
const steps = process.env.MILESTONE_STEPS || "40000";
const parallel = Math.min(4, count);

function trace(rid) {
  return new Promise((resolve) => {
    const out = `/opt/cursor/artifacts/organic-freq-rid${rid}.json`;
    const ch = spawn(process.execPath, [script, String(rid)], {
      env: { ...process.env, MILESTONE_STEPS: steps, MILESTONE_OUT: out },
      stdio: "ignore",
    });
    ch.on("close", () => {
      if (!fs.existsSync(out)) return resolve(null);
      resolve(JSON.parse(fs.readFileSync(out, "utf8")));
    });
  });
}

async function main() {
  const reports = [];
  for (let b = 0; b < count; b += parallel) {
    const batch = [];
    for (let i = 0; i < parallel && b + i < count; i++) batch.push(trace(b + i));
    reports.push(...(await Promise.all(batch)).filter(Boolean));
  }
  let seeds = 0;
  let organicReadyEver = 0;
  let handsTotal = 0;
  let handsPostKit = 0;
  let ghostEchoHands = 0;
  let bookendsHands = 0;
  let pairHands = 0;
  let purchasesKit = 0;
  for (const r of reports) {
    seeds += 1;
    if (r.organicReady) organicReadyEver += 1;
    handsTotal += r.handsRecorded || 0;
    const hist = r.synergyHist || {};
    if (r.organicReady || hist.ghost_echo || hist.bookends_retrigger) {
      handsPostKit += r.handsRecorded || 0;
      ghostEchoHands += hist.ghost_echo || 0;
      bookendsHands += hist.bookends_retrigger || 0;
    }
    pairHands += (r.handsWithLinks || []).length;
    if ((r.purchaseEvents || []).some((p) => p.id === "BOOKENDS")) purchasesKit += 1;
  }
  const summary = {
    seeds_traced: seeds,
    step_budget: steps,
    denominator_kit_acquired: `${purchasesKit}/${seeds} runs bought BOOKENDS`,
    denominator_organic_ready_at_end: `${organicReadyEver}/${seeds} runs ended organicReady`,
    hands_all_runs: handsTotal,
    hands_runs_with_kit_activity: handsPostKit,
    synergy_hand_counts_post_kit_proxy: {
      ghost_echo: ghostEchoHands,
      bookends_retrigger: bookendsHands,
      note: "counts synergy firings across run, not unique hands",
    },
    hands_with_production_pair: pairHands,
    joint_rate_vs_kit_ready_runs:
      organicReadyEver > 0
        ? `${pairHands}/${organicReadyEver} runs with ≥1 pairwise hand`
        : `0/${seeds}`,
    joint_rate_vs_synergy_opportunity: `pair_synergy_events not uniquely paired — see hands_with_production_pair`,
  };
  fs.writeFileSync("/opt/cursor/artifacts/organic-normal-frequency.json", JSON.stringify(summary, null, 2) + "\n");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
