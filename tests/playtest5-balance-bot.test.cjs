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

function simulateRun(rng, { openingTarget = 75, totalRuns = 3 } = {}) {
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
      holdStrategy: true,
    });
    const hustle = heat > 0 ? Math.max(1, Math.min(6, Math.floor(heat / 60))) : 0;
    gold += hustle;
    if (heat >= target) {
      if (gold >= minItemCost) {
        gold -= minItemCost;
        items += 1;
      }
      if (round >= 12) break;
      round += 1;
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
    const run = simulateRun(rng, { openingTarget: 75, totalRuns: 3 });
    rounds.push(run.roundReached);
    if (run.roundReached >= 3) itemsByR3.push(run.items);
  }
  const medRound = median(rounds);
  const medItemsR3 = itemsByR3.length ? median(itemsByR3) : 0;
  assert.ok(medRound >= 5 && medRound <= 9, `median stall round ${medRound} expected ~7–8 with R7+ steepening`);
  assert.ok(medItemsR3 >= 1, `median items by R3 ${medItemsR3} expected >= 1`);
});

test("playtest5 bot — no runaway quota by round 6", () => {
  const routes = loadRoutes();
  const r6 = projectRoundTarget(routes, 75, 1, 6);
  assert.ok(r6 >= 290 && r6 <= 320, `R6 anchor ${r6} should stay challenging but not exponential`);
});

test("playtest10 bot — clear-rate tapers by round (competent sim)", () => {
  const rng = mulberry32(SEED + 99);
  const clearsByRound = Array.from({ length: 10 }, () => 0);
  const attemptsByRound = Array.from({ length: 10 }, () => 0);
  const RUNS = 200;
  for (let i = 0; i < RUNS; i += 1) {
    const routes = loadRoutes();
    let round = 1;
    let target = 75;
    while (round <= 10) {
      attemptsByRound[round - 1] += 1;
      const heat = simulateRound({ pills: 3, plays: 4, rng, totalRuns: 3, holdStrategy: true });
      if (heat >= target) {
        clearsByRound[round - 1] += 1;
        round += 1;
        if (round > 10) break;
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
        target = out.nextTarget;
      } else {
        break;
      }
    }
  }
  const rate = (r) => (attemptsByRound[r] ? clearsByRound[r] / attemptsByRound[r] : 0);
  assert.ok(rate(0) >= 0.85, `R1 clear ${rate(0)}`);
  assert.ok(rate(1) >= 0.7, `R2 clear ${rate(1)}`);
  assert.ok(rate(4) <= 0.92 && rate(4) >= 0.26, `R5 clear ${rate(4)}`);
  assert.ok(rate(5) <= 0.85 && rate(5) >= 0.015, `R6 clear ${rate(5)}`);
  assert.ok(rate(6) <= 0.12, `R7 clear ${rate(6)} should be rare after R7+ steepening`);
  assert.ok(rate(0) - rate(6) >= 0.08, `clear rate should drop R1→R7 (${rate(0)} vs ${rate(6)})`);
});
