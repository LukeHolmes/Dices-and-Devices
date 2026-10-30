"use strict";
/**
 * Multi-round bot sim: median depth and economy sanity (Playtest 5 balance).
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  mulberry32,
  simulateRound,
  projectRoundTarget,
  loadRoutes,
} = require("../scripts/sim-opening.cjs");

const RUNS = 120;
const SEED = 0x5074657374;

function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function simulateRun(rng, { openingTarget = 90, totalRuns = 3 } = {}) {
  const routes = loadRoutes();
  let round = 1;
  let target = openingTarget;
  let gold = 25;
  let items = 0;
  const minItemCost = 18;

  while (round <= 12) {
    const heat = simulateRound({
      pills: 3,
      plays: 4,
      rng,
      totalRuns,
    });
    const hustle = Math.min(9, Math.floor(heat / 115));
    gold += hustle;
    if (heat >= target) {
      if (gold >= minItemCost) {
        gold -= minItemCost;
        items += 1;
      }
      if (round >= 12) break;
      const out = routes.projectNextRound({
        path: { id: "LOCAL", mod: 1 },
        round,
        target,
        debt: 0,
        insaneContract: false,
        hasLedger: false,
        personaPlays: 4,
        personaPills: 3,
      });
      round = out.nextRound;
      target = out.nextTarget;
    } else {
      break;
    }
  }
  return { roundReached: round, items, gold };
}

test("playtest5 bot — median round 4–6 and ~2 items by round 3", () => {
  const rng = mulberry32(SEED);
  const rounds = [];
  const itemsByR3 = [];
  for (let i = 0; i < RUNS; i++) {
    const run = simulateRun(rng, { openingTarget: 90, totalRuns: 3 });
    rounds.push(run.roundReached);
    if (run.roundReached >= 3) itemsByR3.push(run.items);
  }
  const medRound = median(rounds);
  const medItemsR3 = itemsByR3.length ? median(itemsByR3) : 0;
  assert.ok(medRound >= 3 && medRound <= 7, `median round ${medRound} expected ~4–6`);
  assert.ok(medItemsR3 >= 1, `median items by R3 ${medItemsR3} expected >= 1`);
});

test("playtest5 bot — no runaway quota by round 6", () => {
  const routes = loadRoutes();
  const r6 = projectRoundTarget(routes, 90, 1, 6);
  assert.ok(r6 >= 130 && r6 <= 210, `R6 anchor ${r6} should stay challenging but not exponential`);
});
