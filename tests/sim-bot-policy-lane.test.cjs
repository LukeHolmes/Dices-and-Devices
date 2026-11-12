"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const policySrc = fs.readFileSync(path.join(ROOT, "assets/sim-bot-policy.js"), "utf8");

function loadPolicy() {
  const sandbox = { globalThis: {}, module: { exports: {} } };
  vm.createContext(sandbox);
  vm.runInContext(policySrc, sandbox);
  return sandbox.globalThis.GutterbonesSimBotPolicy;
}

const P = loadPolicy();
const LANE = P.WP2_LANE_REVISION;

const bookendsDice = [
  { value: 3, faceId: "GHOST_FACE" },
  { value: 2, faceId: null },
  { value: 5, faceId: null },
  { value: 4, faceId: null },
  { value: 3, faceId: "ECHO_FACE" },
];

const kitInv = [{ id: "BOOKENDS" }];

test("lane — evaluateOrganicPredicates reports unfulfilled ghost_echo distance", () => {
  const preds = P.evaluateOrganicPredicates({ dice: bookendsDice, inventory: kitInv });
  assert.ok(preds.linkKitEligible);
  assert.ok(
    preds.unfulfilled.some((u) => u.startsWith("ghost_echo:")),
    preds.unfulfilled,
  );
  assert.equal(preds.sameHandLowRisk, false);
});

test("lane — setup reroll when kit present and predicates unfulfilled", () => {
  const plan = P.shouldReroll({
    revision: LANE,
    score: 10,
    target: 75,
    hands: 3,
    discards: 2,
    bestTotal: 20,
    e2eGreedy: false,
    dice: bookendsDice,
    inventory: kitInv,
  });
  assert.equal(plan.reroll, true);
  assert.match(plan.reason, /lane_setup|lane_bring|bookend/);
  assert.ok(plan.unfulfilled?.length || plan.predicates?.unfulfilled?.length);
});

test("lane — banking override defers mustBankClear when setup reroll remains", () => {
  const bank = P.mustBankClear({
    revision: LANE,
    score: 70,
    target: 75,
    bestTotal: 8,
    hands: 3,
    discards: 2,
    dice: bookendsDice,
    inventory: kitInv,
    candidates: [
      { catId: "FOURS", valid: true, total: 8, chainLinks: [] },
    ],
  });
  assert.equal(bank, false, "should defer banking to finish lane setup");
});

test("lane — mustBankClear when clear line already has organic link", () => {
  const bank = P.mustBankClear({
    revision: LANE,
    score: 70,
    target: 75,
    bestTotal: 8,
    hands: 3,
    discards: 2,
    dice: bookendsDice,
    inventory: kitInv,
    candidates: [
      { catId: "C", valid: true, total: 8, chainLinks: [{ from: "ghost_echo", to: "bookends_retrigger" }] },
    ],
  });
  assert.equal(bank, true);
});

test("lane — keep bookend ends and ghost/echo on reroll", () => {
  const sel = P.selectKeptSlots({
    revision: LANE,
    dice: bookendsDice,
    inventory: kitInv,
  });
  assert.equal(sel.kept[0], true);
  assert.equal(sel.kept[4], true);
  assert.equal(sel.kept.filter(Boolean).length, 2);
});

test("WP2_REVISION unchanged — still selectable", () => {
  assert.equal(P.WP2_REVISION, "2026-11-12-wp2-v1");
  assert.equal(P.LEGACY_REVISION, "2026-11-11-phase-b-v1");
  assert.notEqual(P.WP2_LANE_REVISION, P.WP2_REVISION);
});
