"use strict"
/**
 * Matched layouts: compare greedy best-category total vs synergy-picking row on same dice.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createGame } = require("./helpers/game.cjs");
const { snapshot, dice, bone } = require("./fixtures/runs.cjs");

function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bestGreedy(g, lane, ctx, used = []) {
  let best = null;
  for (const catId of ["C", "FH", "SS", "LS", "Y", "TH", "FOK", "TOK"]) {
    if (used.includes(catId)) continue;
    const r = g.api.GutterbonesRules.calculateScore(catId, lane, ctx);
    if (!r.valid) continue;
    if (!best || r.total > best.total) best = { catId, total: r.total };
  }
  return best;
}

function bestWithPairTarget(g, lane, ctx, used = []) {
  const greedy = bestGreedy(g, lane, ctx, used);
  let best = greedy;
  for (const catId of ["C", "FH", "SS", "LS", "Y", "TH", "FOK"]) {
    if (used.includes(catId)) continue;
    const r = g.api.GutterbonesRules.calculateScore(catId, lane, ctx);
    if (!r.valid) continue;
    if ((r.chainLinks || []).some((l) => l.from === "ghost_echo" && l.to === "bookends_retrigger")) {
      if (!best || r.total >= best.total * 0.85) best = { catId, total: r.total, paired: true };
    }
  }
  return best;
}

test("matched seeds: synergy-row vs greedy baseline on same lanes", () => {
  const g = createGame(snapshot());
  const ctx = {
    handLevels: {},
    flowStreak: 0,
    inventory: [{ id: "BOOKENDS" }],
    hardwareDisabled: false,
    activeBoss: null,
    CATEGORIES: g.api.CATEGORIES,
    HAND_MASTERY_TUNING: { baseLevel: 1, maxLevel: 8, chipPerLevel: 5 },
    getFlowMultiplier: g.api.getFlowMultiplier,
    getHandMasteryBonus: g.api.getHandMasteryBonus,
    synergyTuning: { enabled: true, chainLinkingEnabled: true, maxChainPasses: 8 },
  };
  const samples = 400;
  let pairPickHigher = 0;
  let pairPickLower = 0;
  let greedyWins = 0;
  let same = 0;
  let totalDeltaWhenPair = 0;
  let pairCount = 0;
  for (let n = 0; n < samples; n++) {
    const rand = mulberry32(1000 + n);
    const values = Array.from({ length: 5 }, () => 1 + Math.floor(rand() * 6));
    const d = dice(values);
    d[1] = bone(values[1], 1, { faceId: "ECHO_FACE", type: "adjacent" });
    d[2] = bone(values[2], 2, { faceId: "GHOST_FACE", type: "ethereal" });
    const greedy = bestGreedy(g, d, ctx);
    const syn = bestWithPairTarget(g, d, ctx);
    if (!greedy || !syn) continue;
    if (syn.paired) {
      pairCount += 1;
      totalDeltaWhenPair += syn.total - greedy.total;
      if (syn.total > greedy.total) pairPickHigher += 1;
      else if (syn.total < greedy.total) pairPickLower += 1;
    }
    if (greedy.total > syn.total) greedyWins += 1;
    else if (greedy.total === syn.total) same += 1;
  }
  assert.ok(samples > 0);
  const report = {
    samples,
    layouts_with_pair_option: pairCount,
    greedy_higher_than_synergy_pick: greedyWins,
    same_total: same,
    pair_pick_higher: pairPickHigher,
    pair_pick_lower: pairPickLower,
    mean_delta_when_pair: pairCount ? totalDeltaWhenPair / pairCount : 0,
  };
  assert.ok(
    greedyWins + same >= pairPickLower,
    `scoring-first should usually beat or tie link-hunt picks: ${JSON.stringify(report)}`,
  );
});
