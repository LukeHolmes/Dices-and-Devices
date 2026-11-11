"use strict";
/** Normal-play denominators: exact hand + link counts across attempted traces (no grants). */
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
  let attemptedRuns = reports.length;
  let runsWithBookendsPurchase = 0;
  let runsOrganicReadyAtEnd = 0;
  let runsWithAnyPairwiseHand = 0;
  let totalHands = 0;
  let handsWithGhostEcho = 0;
  let handsWithBookends = 0;
  let handsWithPairwise = 0;
  let linkEventsGhostBookends = 0;

  for (const r of reports) {
    if ((r.purchaseEvents || []).some((p) => p.id === "BOOKENDS")) runsWithBookendsPurchase += 1;
    if (r.organicReady) runsOrganicReadyAtEnd += 1;
    const hands = r.handsWithLinks?.length
      ? r.handsWithLinks
      : [];
    totalHands += r.handsRecorded || 0;
    handsWithGhostEcho += r.handsWithGhostEcho || 0;
    handsWithPairwise += r.pairwiseLinkHands || 0;
    const hist = r.synergyHist || {};
    handsWithBookends += hist.bookends_retrigger || 0;
    linkEventsGhostBookends += (r.pairwiseLinks || []).filter(
      (l) => l.from === "ghost_echo" && l.to === "bookends_retrigger",
    ).length;
    if ((r.pairwiseLinkHands || 0) > 0) runsWithAnyPairwiseHand += 1;
  }

  const summary = {
    attempted_runs: attemptedRuns,
    runs_with_bookends_purchase: runsWithBookendsPurchase,
    runs_organic_ready_at_end: runsOrganicReadyAtEnd,
    runs_with_any_pairwise_hand: runsWithAnyPairwiseHand,
    total_hands_recorded: totalHands,
    hands_with_ghost_echo_synergy: handsWithGhostEcho,
    hands_with_bookends_synergy: handsWithBookends,
    hands_with_ghost_bookends_pair: handsWithPairwise,
    production_link_events_ghost_bookends: linkEventsGhostBookends,
    rates: {
      pairwise_run_rate: `${runsWithAnyPairwiseHand}/${attemptedRuns}`,
      pairwise_among_organic_ready_finishes: runsOrganicReadyAtEnd
        ? `${runsWithAnyPairwiseHand}/${runsOrganicReadyAtEnd}`
        : `0/${attemptedRuns} (no organicReady finishes)`,
      joint_per_total_hands: totalHands ? `${handsWithPairwise}/${totalHands}` : "n/a",
    },
    note: "attempted_runs = traces completed; bookends_synergy uses per-run synergyHist sums (fire count, not unique hands)",
  };
  fs.writeFileSync("/opt/cursor/artifacts/organic-normal-frequency.json", JSON.stringify(summary, null, 2) + "\n");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
