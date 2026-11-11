"use strict";
/** Carved special faces must keep numeric pip for category math (reject "carving destroys pip matching"). */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createGame } = require("./helpers/game.cjs");
const { snapshot, dice, bone } = require("./fixtures/runs.cjs");

test("carved faces retain pip in C / FOK / FH category evaluation", () => {
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
  const lane = dice([6, 6, 4, 4, 2]);
  lane[0] = bone(6, 0, { faceId: "GHOST_FACE", type: "ethereal" });
  lane[1] = bone(6, 1, { faceId: "MULT_FACE", type: "modifier" });
  lane[2] = bone(4, 2, { faceId: "ECHO_FACE", type: "adjacent" });
  const c = g.api.GutterbonesRules.calculateScore("C", lane, ctx);
  assert.ok(c.valid && c.total > 0, "C uses numeric pips with carved faces");
  const fok = dice([5, 5, 5, 5, 2]);
  fok[3] = bone(5, 3, { faceId: "WILD_FACE", type: "wildcard" });
  const fokR = g.api.GutterbonesRules.calculateScore("FOK", fok, ctx);
  assert.ok(fokR.valid, "FOK works with carved wild slot");
  const fh = dice([3, 3, 3, 2, 2]);
  fh[4] = bone(2, 4, { faceId: "GOLD_FACE", type: "modifier" });
  const fhR = g.api.GutterbonesRules.calculateScore("FH", fh, ctx);
  assert.ok(fhR.valid, "FH works with carved end face");
});
