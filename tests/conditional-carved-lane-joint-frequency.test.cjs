"use strict";
/**
 * Conditional joint rate: independent end pips, ECHO@2 + GHOST@3 visible (1-based slots).
 * Not shop/carve die-pool play — see organic-pairwise-regression for normal play.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createGame } = require("./helpers/game.cjs");
const { snapshot, dice, bone } = require("./fixtures/runs.cjs");

function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("conditional carved lane — ghost_echo→bookends joint rate (labeled denominator)", () => {
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
  let ghostEcho = 0;
  let bookends = 0;
  let endsValueMatch = 0;
  let hauntedBracketOnly = 0;
  const samples = 8000;
  for (let n = 0; n < samples; n++) {
    const rand = mulberry32(n + 90210);
    const values = Array.from({ length: 5 }, () => 1 + Math.floor(rand() * 6));
    const d = dice(values);
    d[1] = bone(values[1], 1, { faceId: "ECHO_FACE", type: "adjacent" });
    d[2] = bone(values[2], 2, { faceId: "GHOST_FACE", type: "ethereal" });
    const gp = values[2];
    const vm = values[0] === values[4];
    const bracket =
      Math.abs(values[0] - gp) <= 1 && Math.abs(values[4] - gp) <= 1;
    if (vm) endsValueMatch += 1;
    if (!vm && bracket) hauntedBracketOnly += 1;
    const r = g.api.GutterbonesRules.calculateScore("C", d, ctx);
    if (r.synergyEvents.some((e) => e.id === "ghost_echo")) ghostEcho += 1;
    if (r.synergyEvents.some((e) => e.id === "bookends_retrigger")) bookends += 1;
    if ((r.chainLinks || []).some((l) => l.from === "ghost_echo" && l.to === "bookends_retrigger")) pair += 1;
  }
  const pairRate = pair / samples;
  assert.equal(ghostEcho, samples, "ghost_echo on fixed ECHO/GHOST lane");
  assert.ok(endsValueMatch < samples * 0.25, `ends vary: valueMatch ${endsValueMatch}/${samples}`);
  assert.ok(
    pairRate >= 0.08,
    `conditional lane joint ≥8%, got ${(pairRate * 100).toFixed(2)}% (${pair}/${samples}); bookends ${bookends}, haunted-only ${hauntedBracketOnly}, valueMatch ${endsValueMatch}`,
  );
});
