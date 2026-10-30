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
    synergyTuning: { enabled: true, maxChainPasses: 8 },
    synergyState: { categoryMarks: {} },
    roundFirstCategories: [],
    ...overrides,
  };
}

test("mirror_rig: swap is scoring-only and match grants +1 mult", () => {
  const g = createGame(snapshot());
  const d = dice([1, 4, 3, 4, 5]);
  const before = JSON.stringify(d);
  const withMirror = g.api.GutterbonesRules.calculateScore(
    "C",
    d,
    scoreContext(g, { inventory: [{ id: "MIRROR_RIG" }] }),
  );
  assert.equal(JSON.stringify(d), before);
  assert.ok(withMirror.explanationSteps.some((s) => String(s.label).includes("MIRROR RIG")));
  const withoutMirror = g.api.GutterbonesRules.calculateScore("C", d, scoreContext(g));
  assert.ok(withMirror.total > withoutMirror.total);
});

test("debt_collector: +0.5 mult per debt; crooked cop disables", () => {
  const g = createGame(snapshot());
  const d = dice([2, 3, 4, 5, 6]);
  const base = g.api.GutterbonesRules.calculateScore(
    "C",
    d,
    scoreContext(g, { debt: 4, inventory: [{ id: "DEBT_COLLECTOR" }] }),
  );
  const plain = g.api.GutterbonesRules.calculateScore("C", d, scoreContext(g, { debt: 4 }));
  assert.ok(base.total > plain.total);
  assert.ok(base.explanationSteps.some((s) => String(s.label).includes("DEBT COLLECTOR")));

  const suppressed = g.api.GutterbonesRules.calculateScore(
    "C",
    d,
    scoreContext(g, {
      debt: 4,
      inventory: [{ id: "DEBT_COLLECTOR" }],
      hardwareDisabled: true,
      activeBoss: { id: "CROOKED_COP", name: "Crooked Cop" },
    }),
  );
  assert.equal(suppressed.total, plain.total);
});

test("hot_streak_coil: retriggers best mult face when flow warm", () => {
  const g = createGame(snapshot());
  const d = dice([2, 3, 4, 5, 6]);
  d[0] = bone(2, 0, { faceId: "GHOST_FACE", type: "ethereal" });
  const cold = g.api.GutterbonesRules.calculateScore(
    "C",
    d,
    scoreContext(g, { flowStreak: 0, inventory: [{ id: "HOT_STREAK_COIL" }] }),
  );
  const hot = g.api.GutterbonesRules.calculateScore(
    "C",
    d,
    scoreContext(g, { flowStreak: 2, inventory: [{ id: "HOT_STREAK_COIL" }] }),
  );
  assert.ok(hot.total > cold.total);
  assert.ok(hot.explanationSteps.some((s) => String(s.label).includes("HOT STREAK COIL")));
});

test("fuse_box: extra chain pass when multiple face types", () => {
  const g = createGame(snapshot());
  const d = dice([6, 0, 2, 3, 4]);
  d[0] = bone(6, 0, { faceId: "BLOOD_6", type: "blood" });
  d[1] = bone(0, 1, { faceId: "MULT_FACE", type: "modifier" });
  const r = g.api.GutterbonesRules.calculateScore(
    "C",
    d,
    scoreContext(g, { inventory: [{ id: "FUSE_BOX" }] }),
  );
  assert.ok(r.explanationSteps.some((s) => String(s.label).includes("FUSE BOX")));
});

test("weighted core: +20 on triad when synergy enabled", () => {
  const g = createGame(snapshot());
  const d = dice([3, 3, 3, 4, 5]);
  const r = g.api.GutterbonesRules.calculateScore(
    "TOK",
    d,
    scoreContext(g, { inventory: [{ id: "LOADED_DIE" }] }),
  );
  assert.equal(r.valid, true);
  assert.equal(r.chips, 40);
});
