"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createGame } = require("./helpers/game.cjs");
const { snapshot, dice, bone } = require("./fixtures/runs.cjs");

function scoreContext(g, overrides = {}) {
  return {
    handLevels: {},
    flowStreak: 0,
    debt: 0,
    inventory: [],
    hardwareDisabled: false,
    activeBoss: null,
    CATEGORIES: g.api.CATEGORIES,
    HAND_MASTERY_TUNING: { baseLevel: 1, maxLevel: 8, chipPerLevel: 5 },
    getFlowMultiplier: g.api.getFlowMultiplier,
    getHandMasteryBonus: g.api.getHandMasteryBonus,
    synergyTuning: {
      enabled: true,
      chainLinkingEnabled: true,
      maxChainPasses: 8,
      maxChainBonusMultPerHand: 6,
      debtCollectorMaxMult: 4,
    },
    ...overrides,
  };
}

test("DEBT COLLECTOR mult is capped at debtCollectorMaxMult", () => {
  const g = createGame(snapshot());
  const d = dice([2, 3, 4, 5, 6]);
  const r = g.api.GutterbonesRules.calculateScore(
    "C",
    d,
    scoreContext(g, { debt: 20, inventory: [{ id: "DEBT_COLLECTOR" }] }),
  );
  assert.ok(r.explanationSteps.some((s) => String(s.label).includes("DEBT COLLECTOR")));
  assert.ok(r.mult <= 6 + 1.22 + 0.01);
  const step = r.explanationSteps.find((s) => String(s.label).includes("DEBT COLLECTOR"));
  assert.match(String(step.impact), /\+4x/);
});

test("synergy chain mult bonuses stop after maxChainBonusMultPerHand", () => {
  const g = createGame(snapshot());
  const d = dice([6, 6, 0, 6, 6]);
  d[0] = bone(6, 0, { faceId: "BLOOD_6", type: "blood" });
  d[1] = bone(6, 1, { faceId: "BLOOD_6", type: "blood" });
  d[2] = bone(0, 2, { faceId: "FUSE_FACE", type: "modifier" });
  d[3] = bone(6, 3, { faceId: "BLOOD_6", type: "blood" });
  d[4] = bone(6, 4, { faceId: "BLOOD_6", type: "blood" });
  const r = g.api.GutterbonesRules.calculateScore(
    "C",
    d,
    scoreContext(g, { inventory: [{ id: "ENGINE" }, { id: "FUSE_BOX" }] }),
  );
  const chainMultSteps = (r.explanationSteps || []).filter((s) => String(s.label).startsWith("CHAIN:"));
  const multAdds = chainMultSteps
    .map((s) => String(s.impact).match(/\+(\d+)x/))
    .filter(Boolean)
    .reduce((sum, m) => sum + Number(m[1]), 0);
  assert.ok(multAdds <= 6, `chain mult adds ${multAdds}`);
});
