"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createGame } = require("../helpers/game.cjs");
const { dice } = require("../fixtures/runs.cjs");

function baseContext(g) {
  return {
    handLevels: {},
    flowStreak: 0,
    debt: 0,
    inventory: [],
    hardwareDisabled: false,
    bossHardwareDampen: 1,
    activeBoss: null,
    CATEGORIES: g.api.CATEGORIES,
    HAND_MASTERY_TUNING: { baseLevel: 1, maxLevel: 5, bonusPerLevel: 0.05 },
    getFlowMultiplier: () => 1,
    getHandMasteryBonus: () => 0,
    synergyTuning: { enabled: false },
    synergyState: {},
    roundFirstCategories: [],
    blueprintIds: [],
    blueprintRound: {},
    runUpperHeat: 70,
  };
}

test("F2_REVERT lowers upper-bonus SIXES total vs main fixture", () => {
  const gMain = createGame({});
  const gBp = createGame({}, { scoringVariant: "F2_REVERT" });
  const ctx = baseContext(gMain);
  const d = dice([6, 6, 6, 1, 2]);
  const main = gMain.api.GutterbonesRules.calculateScore("SIXES", d, ctx);
  const bp = gBp.api.GutterbonesRules.calculateScore("SIXES", d, ctx);
  assert.ok(main.valid && bp.valid);
  assert.ok(main.total > bp.total, `expected main ${main.total} > bp ${bp.total}`);
  assert.equal(main.mult > bp.mult, true);
});