"use strict";
/**
 * Round-1 economy sim against production GutterbonesRules (Playtest 5 scoring pass).
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  mulberry32,
  simulateRound,
  loadRoutes,
  loadRulesApi,
  projectRoundTarget,
} = require("../scripts/sim-opening.cjs");

const RUNS = 400;
const SEED = 0x653235;
const OPENING_TARGET = 75;

function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function simulateRound1Cash(rng, { holdStrategy = false } = {}) {
  const heat = simulateRound({
    pills: 3,
    plays: 4,
    rng,
    totalRuns: 3,
    holdStrategy,
  });
  let gold = 25;
  const hustle = heat > 0 ? Math.max(1, Math.min(6, Math.floor(heat / 60))) : 0;
  gold += hustle;
  if (heat >= OPENING_TARGET) {
    const unused = 0;
    const interest = Math.min(5, Math.floor(gold / 5));
    gold += 8 + unused + interest;
  }
  return { cleared: heat >= OPENING_TARGET, gold, heat };
}

test("round 1 — no-hold best row clears quota ≥75% of runs", () => {
  const rng = mulberry32(SEED);
  let cleared = 0;
  for (let i = 0; i < RUNS; i++) {
    if (simulateRound1Cash(rng, { holdStrategy: false }).cleared) cleared += 1;
  }
  const rate = cleared / RUNS;
  assert.ok(rate >= 0.75, `no-hold clear rate ${(rate * 100).toFixed(1)}% expected ≥75%`);
});

test("round 1 — hold strategy clears quota ≥95%", () => {
  const rng = mulberry32(SEED ^ 0xabcd);
  let cleared = 0;
  for (let i = 0; i < RUNS; i++) {
    if (simulateRound1Cash(rng, { holdStrategy: true }).cleared) cleared += 1;
  }
  const rate = cleared / RUNS;
  assert.ok(rate >= 0.95, `hold clear rate ${(rate * 100).toFixed(1)}% expected ≥95%`);
});

test("round 1 — mean cash after round ≥ $10 when cleared", () => {
  const rng = mulberry32(SEED ^ 0x9999);
  const cash = [];
  for (let i = 0; i < RUNS; i++) {
    const out = simulateRound1Cash(rng, { holdStrategy: true });
    if (out.cleared) cash.push(out.gold);
  }
  assert.ok(cash.length > RUNS * 0.9, "expected most runs to clear with hold strategy");
  const mean = cash.reduce((a, b) => a + b, 0) / cash.length;
  assert.ok(mean >= 10, `mean round-1 cash ${mean.toFixed(1)} expected ≥10`);
});

test("multi-round — ~2 shop items affordable by round 3, no runaway quota", () => {
  const routes = loadRoutes();
  const rng = mulberry32(SEED ^ 0x5555);
  const itemsByR3 = [];
  for (let i = 0; i < 120; i++) {
    let round = 1;
    let target = OPENING_TARGET;
    let gold = 25;
    let items = 0;
    const minItemCost = 18;
    while (round <= 3) {
      const heat = simulateRound({ pills: 3, plays: 4, rng, totalRuns: 3, holdStrategy: true });
      gold += heat > 0 ? Math.max(1, Math.min(6, Math.floor(heat / 60))) : 0;
      if (heat < target) break;
      gold += 8 + Math.min(5, Math.floor(gold / 5));
      if (gold >= minItemCost) {
        gold -= minItemCost;
        items += 1;
      }
      if (round >= 3) break;
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
    }
    if (round >= 3) itemsByR3.push(items);
  }
  const medItems = itemsByR3.length ? median(itemsByR3) : 0;
  assert.ok(medItems >= 1.5, `median items by R3 ${medItems} expected ~2`);
  const r6 = projectRoundTarget(routes, 75, 1, 6);
  assert.ok(r6 >= 290 && r6 <= 320, `R6 anchor ${r6} should not run away`);
});

test("synergy — tagged pair can produce chain events on Slop", () => {
  const { dice } = require("./fixtures/runs.cjs");
  const { createGame } = require("./helpers/game.cjs");
  const g = createGame(require("./fixtures/runs.cjs").snapshot());
  const d = dice([2, 2, 3, 4, 5]);
  const r = g.api.GutterbonesRules.calculateScore("C", d, {
    handLevels: {},
    flowStreak: 0,
    inventory: [
      { id: "ENGINE", name: "Engine" },
      { id: "FUSE_BOX", name: "Fuse Box" },
    ],
    hardwareDisabled: false,
    activeBoss: null,
    CATEGORIES: g.api.CATEGORIES,
    HAND_MASTERY_TUNING: { baseLevel: 1, maxLevel: 8, chipPerLevel: 5 },
    getFlowMultiplier: g.api.getFlowMultiplier,
    getHandMasteryBonus: g.api.getHandMasteryBonus,
    synergyTuning: { enabled: true, maxChainPasses: 8 },
    synergyState: { categoryMarks: {}, comboMeter: 2 },
    roundFirstCategories: [],
  });
  assert.ok(r.valid);
  assert.ok((r.synergyEvents || []).length >= 1, "expected at least one synergy chain event");
});

test("upper row scoring — five sixes capped at x2 mult (60 heat)", () => {
  const { dice } = require("./fixtures/runs.cjs");
  const api = loadRulesApi();
  const r = api.calculateScore("SIXES", dice([6, 6, 6, 6, 6]));
  assert.equal(r.total, 60);
});
