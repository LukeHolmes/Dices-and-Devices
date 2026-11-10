"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createGame } = require("./helpers/game.cjs");
const { snapshot, dice, bone } = require("./fixtures/runs.cjs");

const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");

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
    synergyTuning: { enabled: true, chainLinkingEnabled: true, maxChainPasses: 8, maxChainBonusMultPerHand: 6, debtCollectorMaxMult: 4 },
    ...overrides,
  };
}

test("SYNERGY_TUNING.chainLinkingEnabled defaults true in shipped tuning", () => {
  assert.match(html, /chainLinkingEnabled:\s*true/);
  assert.match(html, /maxChainBonusMultPerHand:\s*6/);
  assert.match(html, /debtCollectorMaxMult:\s*4/);
});

test("chain linking off — no link markers or links on score result", () => {
  // explicit OFF in synergyTuning override
  const g = createGame(snapshot());
  const d = dice([6, 0, 2, 3, 4]);
  d[0] = bone(6, 0, { faceId: "BLOOD_6", type: "blood" });
  d[1] = bone(0, 1, { faceId: "SHIV_FACE", type: "destructive" });
  const r = g.api.GutterbonesRules.calculateScore(
    "C",
    d,
    synergyContext(g, { synergyTuning: { enabled: true, chainLinkingEnabled: false, maxChainPasses: 8 } }),
  );
  assert.ok(r.synergyEvents.length > 0);
  assert.equal(Array.isArray(r.chainLinks), true);
  assert.equal(r.chainLinks.length, 0);
  assert.equal(Array.isArray(r.chainLinkMarkers), true);
  assert.equal(r.chainLinkMarkers.length, 0);
  assert.equal(r.synergyEvents[0].chainPass, 1);
});

test("chain linking on — markers recorded without changing totals (inert plumbing)", () => {
  const g = createGame(snapshot());
  const d = dice([6, 0, 2, 3, 4]);
  d[0] = bone(6, 0, { faceId: "BLOOD_6", type: "blood" });
  d[1] = bone(0, 1, { faceId: "SHIV_FACE", type: "destructive" });
  const off = g.api.GutterbonesRules.calculateScore("C", d, synergyContext(g));
  const on = g.api.GutterbonesRules.calculateScore(
    "C",
    d,
    synergyContext(g, { synergyTuning: { enabled: true, chainLinkingEnabled: true, maxChainPasses: 8 } }),
  );
  assert.equal(on.total, off.total);
  assert.equal(Array.isArray(on.chainLinks), true);
  assert.equal(on.chainLinks.length, 0);
  assert.ok(Array.isArray(on.chainLinkMarkers) && on.chainLinkMarkers.length >= 1);
  assert.equal(on.chainLinkMarkers[0].chainId, "blood_ripple");
  assert.equal(on.chainLinkMarkers[0].linkedFrom, null);
});

test("later hardware chain uses pass index after face chain pass (not mislabeled as pass 1)", () => {
  const g = createGame(snapshot());
  const d = dice([1, 0, 0, 4, 5]);
  d[1] = bone(2, 1, { faceId: "MULT_FACE", type: "modifier" });
  d[2] = bone(3, 2, { faceId: "MULT_FACE", type: "modifier" });
  d[3] = bone(6, 3, { faceId: "BLOOD_6", type: "blood" });
  d[4] = bone(0, 4, { faceId: "SHIV_FACE", type: "destructive" });
  const r = g.api.GutterbonesRules.calculateScore(
    "C",
    d,
    synergyContext(g, { inventory: [{ id: "ENGINE" }] }),
  );
  const blood = r.synergyEvents.find((e) => e.id === "blood_ripple");
  const engine = r.synergyEvents.find((e) => e.id === "engine_link");
  assert.ok(blood);
  assert.ok(engine);
  assert.equal(blood.chainIndex, 0);
  assert.equal(blood.chainPass, 1);
  assert.ok(engine.chainIndex >= 1, JSON.stringify(r.synergyEvents));
  assert.equal(engine.chainPass, engine.chainIndex + 1);
});

test("chain linking off preserves Slop baseline total with synergy enabled", () => {
  const g = createGame(snapshot());
  const off = g.api.calculateScore("C", dice([1, 2, 3, 4, 5]));
  const on = g.api.GutterbonesRules.calculateScore("C", dice([1, 2, 3, 4, 5]), synergyContext(g));
  assert.equal(on.total, off.total);
});
