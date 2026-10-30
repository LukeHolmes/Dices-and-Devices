"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createGame } = require("./helpers/game.cjs");
const { snapshot, dice } = require("./fixtures/runs.cjs");

const STANDARD_PAYOUTS = [
  ["C", [1, 2, 3, 4, 5], 37],
  ["TOK", [2, 2, 2, 4, 5], 40],
  ["FOK", [3, 3, 3, 3, 5], 105],
  ["FH", [2, 2, 3, 3, 3], 90],
  ["SS", [1, 2, 3, 4, 6], 60],
  ["LS", [1, 2, 3, 4, 5], 120],
  ["Y", [6, 6, 6, 6, 6], 250],
  ["SIXES", [6, 6, 1, 2, 3], 24],
];

for (const [cat, values, total] of STANDARD_PAYOUTS) {
  test(`synergy off: ${cat} baseline ${total}`, () => {
    const r = createGame(snapshot()).api.calculateScore(cat, dice(values));
    assert.equal(r.total, total);
    assert.ok(Array.isArray(r.synergyEvents));
    assert.equal(r.synergyEvents.length, 0);
    assert.equal(r.chainDepth, 0);
  });
}

test("synergy flag on with no chain triggers matches baseline (Slop)", () => {
  const g = createGame(snapshot());
  const ctx = {
    handLevels: {},
    flowStreak: 0,
    inventory: [],
    hardwareDisabled: false,
    activeBoss: null,
    CATEGORIES: g.api.CATEGORIES,
    HAND_MASTERY_TUNING: { baseLevel: 1, maxLevel: 8, chipPerLevel: 5 },
    getFlowMultiplier: g.api.getFlowMultiplier,
    getHandMasteryBonus: g.api.getHandMasteryBonus,
    synergyTuning: { enabled: true, maxChainPasses: 8 },
  };
  const r = g.api.GutterbonesRules.calculateScore("C", dice([1, 2, 3, 4, 5]), ctx);
  assert.equal(r.total, 37);
  assert.equal(r.chainDepth, 0);
});
