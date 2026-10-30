"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createGame } = require("./helpers/game.cjs");
const { snapshot, dice, bone } = require("./fixtures/runs.cjs");

function scoreContext(g, overrides = {}) {
  return {
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
    synergyState: { categoryMarks: {} },
    roundFirstCategories: [],
    ...overrides,
  };
}

test("magnet_face: copies left face for scoring", () => {
  const g = createGame(snapshot());
  const d = dice([1, 0, 3, 4, 5]);
  d[0] = bone(1, 0, { faceId: "MULT_FACE", type: "modifier" });
  d[1] = bone(0, 1, { faceId: "MAGNET_FACE", type: "adjacent" });
  const r = g.api.GutterbonesRules.calculateScore("C", d, scoreContext(g));
  assert.equal(r.valid, true);
  assert.ok(r.total > 15);
  assert.ok(r.triggers.some((t) => t.name === "+MULT"));
});

test("fuse_spark: neighbor modifier adds chips", () => {
  const g = createGame(snapshot());
  const d = dice([0, 0, 2, 3, 4]);
  d[0] = bone(0, 0, { faceId: "MULT_FACE", type: "modifier" });
  d[1] = bone(0, 1, { faceId: "FUSE_FACE", type: "modifier" });
  const r = g.api.GutterbonesRules.calculateScore("C", d, scoreContext(g));
  assert.ok(r.synergyEvents.some((e) => e.id === "fuse_spark"));
  assert.equal(r.total, 72);
});

test("double_down_face: x1.25 when category mult >= 3", () => {
  const g = createGame(snapshot());
  const d = dice([5, 5, 5, 5, 2]);
  d[4] = bone(2, 4, { faceId: "DOUBLE_DOWN_FACE", type: "modifier" });
  const r = g.api.GutterbonesRules.calculateScore("FOK", d, scoreContext(g));
  assert.equal(r.valid, true);
  assert.ok(r.explanationSteps.some((s) => String(s.label).includes("DOUBLE DOWN")));
  assert.equal(r.total, 131);
});

test("mark_face: earns mark and applies on later scores", () => {
  const g = createGame(snapshot());
  const d = dice([2, 3, 4, 5, 6]);
  d[0] = bone(2, 0, { faceId: "MARK_FACE", type: "modifier" });
  const first = g.api.GutterbonesRules.calculateScore("C", d, scoreContext(g));
  assert.equal(first.categoryMarkEarned, true);
  const second = g.api.GutterbonesRules.calculateScore(
    "C",
    d,
    scoreContext(g, {
      synergyState: { categoryMarks: { C: 1 } },
      roundFirstCategories: ["C"],
    }),
  );
  assert.equal(second.categoryMarkEarned, false);
  assert.ok(second.total > first.total);
});

test("categoryMarks persist through normalizeSavedRun", () => {
  const g = createGame(snapshot());
  const raw = require("./fixtures/runs.cjs").run({
    synergyState: { categoryMarks: { TOK: 2, C: 1 } },
    categoryMarkedThisRound: ["TOK"],
  });
  const normalized = g.api.normalizeSavedRun(raw);
  assert.equal(normalized.synergyState.categoryMarks.TOK, 2);
  assert.equal(normalized.synergyState.categoryMarks.C, 1);
  assert.deepEqual(normalized.categoryMarkedThisRound, ["TOK"]);
});
