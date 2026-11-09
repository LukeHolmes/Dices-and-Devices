"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createGame } = require("./helpers/game.cjs");
const { snapshot, dice, bone } = require("./fixtures/runs.cjs");

function linkContext(g, overrides = {}) {
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
    synergyTuning: { enabled: true, chainLinkingEnabled: true, maxChainPasses: 8 },
    ...overrides,
  };
}

test("link: blood ripple charges slots → fuse spark via charged neighbor", () => {
  const g = createGame(snapshot());
  const d = dice([6, 6, 0, 3, 4]);
  d[0] = bone(6, 0, { faceId: "BLOOD_6", type: "blood" });
  d[1] = bone(6, 1, { faceId: "BLOOD_6", type: "blood" });
  d[2] = bone(0, 2, { faceId: "FUSE_FACE", type: "modifier" });
  const off = g.api.GutterbonesRules.calculateScore(
    "C",
    d,
    linkContext(g, { synergyTuning: { enabled: true, chainLinkingEnabled: false, maxChainPasses: 8 } }),
  );
  const on = g.api.GutterbonesRules.calculateScore("C", d, linkContext(g));
  assert.equal(off.synergyEvents.some((e) => e.id === "fuse_spark"), false);
  assert.ok(on.synergyEvents.some((e) => e.id === "blood_ripple"));
  assert.ok(on.synergyEvents.some((e) => e.id === "fuse_spark"));
  assert.ok(on.chainLinks.some((l) => l.from === "blood_ripple" && l.to === "fuse_spark"));
});

test("link: sparked slots count toward engine link (fuse_spark → engine_link)", () => {
  const g = createGame(snapshot());
  const d = dice([1, 4, 0, 6, 6]);
  d[2] = bone(0, 2, { faceId: "FUSE_FACE", type: "modifier" });
  d[3] = bone(6, 3, { faceId: "BLOOD_6", type: "blood" });
  d[4] = bone(6, 4, { faceId: "BLOOD_6", type: "blood" });
  const rOff = g.api.GutterbonesRules.calculateScore(
    "C",
    d,
    linkContext(g, {
      synergyTuning: { enabled: true, chainLinkingEnabled: false, maxChainPasses: 8 },
      inventory: [{ id: "ENGINE" }],
    }),
  );
  const rOn = g.api.GutterbonesRules.calculateScore(
    "C",
    d,
    linkContext(g, { inventory: [{ id: "ENGINE" }] }),
  );
  assert.ok(rOn.synergyEvents.some((e) => e.id === "fuse_spark"));
  assert.ok(rOn.synergyEvents.some((e) => e.id === "engine_link"));
  assert.ok(rOn.chainLinks.some((l) => l.from === "fuse_spark" && l.to === "engine_link"));
  assert.ok(rOn.total >= rOff.total);
});
