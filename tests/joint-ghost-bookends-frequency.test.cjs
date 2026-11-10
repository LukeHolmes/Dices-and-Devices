"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createGame } = require("./helpers/game.cjs");
const { snapshot, dice, bone } = require("./fixtures/runs.cjs");

test("joint production score: ghost_echo→bookends fires on carved lane at measurable rate", () => {
  const g = createGame(snapshot());
  const ctx = {
    handLevels: {},
    flowStreak: 0,
    inventory: [{ id: "BOOKENDS" }],
    hardwareDisabled: false,
    activeBoss: null,
    CATEGORIES: g.api.CATEGORIES,
    HAND_MASTERY_TUNING: { baseLevel: 1, maxLevel: 8, chipPerLevel: 5 },
    getFlowMultiplier: g.api.getFlowMultiplier,
    getHandMasteryBonus: g.api.getHandMasteryBonus,
    synergyTuning: { enabled: true, chainLinkingEnabled: true, maxChainPasses: 8 },
  };
  let pair = 0;
  const samples = 6000;
  for (let n = 0; n < samples; n++) {
    const d = dice([1, 2, 3, 4, 5].map(() => 1 + (n + samples * 3) % 6));
    d[1] = bone(d[1].value, 1, { faceId: "ECHO_FACE", type: "adjacent" });
    d[2] = bone(d[2].value, 2, { faceId: "GHOST_FACE", type: "ethereal" });
    const r = g.api.GutterbonesRules.calculateScore("C", d, ctx);
    if ((r.chainLinks || []).some((l) => l.from === "ghost_echo" && l.to === "bookends_retrigger")) pair += 1;
  }
  assert.ok(pair / samples >= 0.08, `expected joint pair rate ≥8%, got ${(pair / samples * 100).toFixed(2)}% (${pair}/${samples})`);
});
