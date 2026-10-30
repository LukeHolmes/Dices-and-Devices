"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createGame } = require("./helpers/game.cjs");
const { snapshot, dice, bone, diceWithFaces } = require("./fixtures/runs.cjs");

function synergyContext(g, overrides = {}) {
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
    ...overrides,
  };
}

test("blood_ripple: adjacent blood/destructive adds mult", () => {
  const g = createGame(snapshot());
  const d = dice([6, 0, 2, 3, 4]);
  d[0] = bone(6, 0, { faceId: "BLOOD_6", type: "blood" });
  d[1] = bone(0, 1, { faceId: "SHIV_FACE", type: "destructive" });
  const r = g.api.GutterbonesRules.calculateScore("C", d, synergyContext(g));
  assert.ok(r.synergyEvents.some((e) => e.id === "blood_ripple"));
  assert.equal(r.total, 207);
  assert.equal(r.chainDepth, 1);
});

test("ghost_echo: ghost adjacent to echo adds mult", () => {
  const g = createGame(snapshot());
  const d = dice([3, 0, 0, 4, 5]);
  d[1] = bone(0, 1, { faceId: "ECHO_FACE", type: "adjacent" });
  d[2] = bone(0, 2, { faceId: "GHOST_FACE", type: "ethereal" });
  const r = g.api.GutterbonesRules.calculateScore("C", d, synergyContext(g));
  assert.ok(r.synergyEvents.some((e) => e.id === "ghost_echo"));
  assert.equal(r.total, 112);
});

test("wire_feed: gold and wirebag neighbors add extra cash", () => {
  const g = createGame(snapshot());
  const d = diceWithFaces([
    { value: 0, faceId: "GOLD_FACE", type: "modifier" },
    { value: 0, faceId: "WIREBAG_FACE", type: "parasite" },
    { value: 2 },
    { value: 3 },
    { value: 4 },
  ]);
  const r = g.api.GutterbonesRules.calculateScore("C", d, synergyContext(g));
  assert.ok(r.synergyEvents.some((e) => e.id === "wire_feed"));
  assert.equal(r.gDelta, 8);
  assert.equal(r.total, 9);
});

test("engine_link: engine bonus 2+ adds mult per modifier face", () => {
  const g = createGame(snapshot());
  const d = dice([1, 0, 0, 4, 5]);
  d[1] = bone(2, 1, { faceId: "MULT_FACE", type: "modifier" });
  d[2] = bone(3, 2, { faceId: "MULT_FACE", type: "modifier" });
  const r = g.api.GutterbonesRules.calculateScore(
    "C",
    d,
    synergyContext(g, { inventory: [{ id: "ENGINE" }] }),
  );
  assert.ok(r.synergyEvents.some((e) => e.id === "engine_link"));
  assert.equal(r.total, 237);
});

test("bookends_retrigger: matching ends retrigger face modifiers", () => {
  const g = createGame(snapshot());
  const d = dice([5, 2, 3, 4, 5]);
  d[0] = bone(5, 0, { faceId: "MULT_FACE", type: "modifier" });
  d[4] = bone(5, 4, { faceId: "MULT_FACE", type: "modifier" });
  const r = g.api.GutterbonesRules.calculateScore(
    "C",
    d,
    synergyContext(g, { inventory: [{ id: "BOOKENDS" }] }),
  );
  assert.ok(r.synergyEvents.some((e) => e.id === "bookends_retrigger"));
  assert.equal(r.retriggerCount, 1);
  assert.equal(r.total, 324);
});

test("crowbar_cascade: destroyed blood slot adds chips after crowbar", () => {
  const g = createGame(snapshot());
  const d = dice([6, 0, 0, 0, 5]);
  d[0] = bone(6, 0, { faceId: "BLOOD_6", type: "blood" });
  d[2] = bone(0, 2, { faceId: "SHIV_FACE", type: "destructive" });
  d[3] = bone(4, 3, { faceId: "BLOOD_6", type: "blood" });
  const r = g.api.GutterbonesRules.calculateScore(
    "C",
    d,
    synergyContext(g, { inventory: [{ id: "CROWBAR" }] }),
  );
  assert.ok(r.synergyEvents.some((e) => e.id === "crowbar_cascade"));
  assert.equal(r.total, 301);
});

test("synergy enabled with no triggers matches disabled baseline", () => {
  const g = createGame(snapshot());
  const d = dice([1, 2, 3, 4, 5]);
  const off = g.api.calculateScore("C", d);
  const on = g.api.GutterbonesRules.calculateScore(
    "C",
    d,
    synergyContext(g),
  );
  assert.equal(on.total, off.total);
  assert.equal(on.chainDepth, 0);
});

test("maxChainPasses bounds loop without error", () => {
  const g = createGame(snapshot());
  const d = dice([6, 0, 2, 3, 4]);
  d[0] = bone(6, 0, { faceId: "BLOOD_6", type: "blood" });
  d[1] = bone(0, 1, { faceId: "SHIV_FACE", type: "destructive" });
  const r = g.api.GutterbonesRules.calculateScore(
    "C",
    d,
    synergyContext(g, { synergyTuning: { enabled: true, maxChainPasses: 1 } }),
  );
  assert.ok(r.valid);
  assert.ok(r.synergyEvents.length >= 1);
});

test("Crooked Cop: face chains run, hardware chains skipped", () => {
  const g = createGame(snapshot());
  const d = dice([6, 0, 2, 3, 4]);
  d[0] = bone(6, 0, { faceId: "BLOOD_6", type: "blood" });
  d[1] = bone(0, 1, { faceId: "SHIV_FACE", type: "destructive" });
  const r = g.api.GutterbonesRules.calculateScore(
    "C",
    d,
    synergyContext(g, {
      inventory: [{ id: "ENGINE" }],
      hardwareDisabled: true,
      activeBoss: { id: "CROOKED_COP" },
    }),
  );
  assert.ok(r.synergyEvents.some((e) => e.id === "blood_ripple"));
  assert.equal(r.synergyEvents.some((e) => e.id === "engine_link"), false);
});
