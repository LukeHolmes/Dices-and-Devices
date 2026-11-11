"use strict";
/** Reject claim: holding 2 dice cannot prevent FOK/FH (only 5-kind needs all five). */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createGame } = require("./helpers/game.cjs");
const { snapshot, dice, bone } = require("./fixtures/runs.cjs");

test("FOK achievable with 3 rerolled dice after holding a pair", () => {
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
    synergyTuning: { enabled: false },
  };
  const heldPair = dice([4, 4, 1, 2, 3]);
  const bestReroll = dice([4, 4, 4, 4, 2]);
  const rHeld = g.api.GutterbonesRules.calculateScore("FOK", bestReroll, ctx);
  assert.ok(rHeld.valid, "four 4s is valid FOK after conceptual hold-pair reroll");
  const fhLane = dice([2, 2, 2, 5, 5]);
  const rFh = g.api.GutterbonesRules.calculateScore("FH", fhLane, ctx);
  assert.ok(rFh.valid, "full house remains valid on five numeric pips");
});
