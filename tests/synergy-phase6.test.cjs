"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const { createGame } = require("./helpers/game.cjs");
const { snapshot, dice, bone } = require("./fixtures/runs.cjs");

const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
function block(open) {
  const start = html.indexOf(open) + open.length;
  const end = html.indexOf("</script>", start);
  return html.slice(start, end);
}

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
    synergyState: { categoryMarks: {}, comboMeter: 0, heatSpikeNextHand: 0 },
    roundFirstCategories: [],
    blueprintIds: [],
    blueprintRound: {},
    ...overrides,
  };
}

test("advanceComboMeter spikes at threshold 3", () => {
  const g = createGame(snapshot());
  const next = g.api.GutterbonesRules.advanceComboMeter(
    { categoryMarks: {}, comboMeter: 2, heatSpikeNextHand: 0 },
    true,
    { comboMeterSpikeThresholds: [3, 6, 9], heatSpikeMult: 0.25 },
  );
  assert.equal(next.comboMeter, 3);
  assert.equal(next.heatSpikeNextHand, 0.25);
});

test("mult_engine blueprint retriggers first MULT once per round flag", () => {
  const g = createGame(snapshot());
  const d = dice([1, 0, 3, 4, 5]);
  d[1] = bone(0, 1, { faceId: "MULT_FACE", type: "modifier" });
  const first = g.api.GutterbonesRules.calculateScore(
    "C",
    d,
    scoreContext(g, {
      blueprintIds: ["MULT_ENGINE_START"],
      blueprintRound: { multEngineUsed: false },
    }),
  );
  const second = g.api.GutterbonesRules.calculateScore(
    "C",
    d,
    scoreContext(g, {
      blueprintIds: ["MULT_ENGINE_START"],
      blueprintRound: { multEngineUsed: true },
    }),
  );
  assert.ok(first.blueprintMultEngineTriggered);
  assert.ok(first.total > second.total);
});

test("heat spike mult applies and reports consumption flag", () => {
  const g = createGame(snapshot());
  const d = dice([2, 3, 4, 5, 6]);
  const r = g.api.GutterbonesRules.calculateScore(
    "C",
    d,
    scoreContext(g, { synergyState: { categoryMarks: {}, comboMeter: 3, heatSpikeNextHand: 0.25 } }),
  );
  assert.equal(r.heatSpikeApplied, true);
  assert.ok(r.total > 15);
});

test("blood ripple cap increases with blood debt blueprint", () => {
  const g = createGame(snapshot());
  assert.equal(g.api.GutterbonesRules.bloodRippleCap([]), 3);
  assert.equal(g.api.GutterbonesRules.bloodRippleCap(["BLOOD_DEBT_START"]), 4);
});

test("normalizeSavedRun defaults blueprints and combo meter", () => {
  const g = createGame(snapshot());
  const raw = require("./fixtures/runs.cjs").run({
    blueprints: [{ id: "FLOW_SAVE_ONCE", consumed: false }, { id: "INVALID", consumed: false }],
    synergyState: { categoryMarks: { C: 1 }, comboMeter: 2.7, heatSpikeNextHand: 0.25 },
  });
  const normalized = g.api.normalizeSavedRun(raw);
  assert.equal(normalized.blueprints.length, 1);
  assert.equal(normalized.blueprints[0].id, "FLOW_SAVE_ONCE");
  assert.equal(normalized.synergyState.comboMeter, 2);
  assert.equal(normalized.synergyState.heatSpikeNextHand, 0.25);
});

test("resolveBlueprintFlip uses FAIR tier and returns blueprint on win", () => {
  const gambleSource = block('<script id="gutterbones-gamble">');
  const sandbox = {};
  vm.createContext(sandbox);
  new vm.Script(`${gambleSource}\nglobalThis.g = GutterbonesGamble;`).runInContext(sandbox);
  const g = sandbox.g;
  const win = g.resolveBlueprintFlip({
    flowStreak: 0,
    gold: 100,
    random: 0.1,
    pickBlueprintId: () => "MULT_ENGINE_START",
  });
  assert.equal(win.won, true);
  assert.equal(win.blueprintId, "MULT_ENGINE_START");
  const loss = g.resolveBlueprintFlip({
    flowStreak: 0,
    gold: 100,
    random: 0.9,
    pickBlueprintId: () => "MULT_ENGINE_START",
  });
  assert.equal(loss.won, false);
  assert.equal(loss.blueprintId, null);
});
