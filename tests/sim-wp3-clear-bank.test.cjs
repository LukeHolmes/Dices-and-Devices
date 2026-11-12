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
const WP3 = P.WP3_SHOP_REVISION;

const kitDice = [
  { value: 2, faceId: "GHOST_FACE" },
  { value: 3 },
  { value: 4 },
  { value: 5 },
  { value: 2, faceId: "ECHO_FACE" },
];

test("WP3 — mustBankClear when quota clear available", () => {
  const bank = P.mustBankClear({
    revision: WP3,
    score: 70,
    target: 75,
    bestTotal: 8,
    hands: 3,
    discards: 2,
    dice: kitDice,
    inventory: [{ id: "BOOKENDS" }],
    candidates: [{ catId: "FOURS", valid: true, total: 8, chainLinks: [] }],
  });
  assert.equal(bank, true);
});

test("WP3 — shouldReroll does not defer a live clear for setup", () => {
  const plan = P.shouldReroll({
    revision: WP3,
    score: 70,
    target: 75,
    hands: 3,
    discards: 2,
    bestTotal: 8,
    e2eGreedy: false,
    dice: kitDice,
    inventory: [{ id: "BOOKENDS" }],
    candidates: [{ catId: "FOURS", valid: true, total: 8, chainLinks: [] }],
  });
  assert.equal(plan.reroll, false);
  assert.match(plan.reason, /clear_available/);
});

test("WP3 — pickCategory prefers clearing line when only one clears", () => {
  const pick = P.pickCategory({
    revision: WP3,
    score: 70,
    target: 75,
    candidates: [
      { catId: "HIGH", valid: true, total: 4, chainLinks: [] },
      { catId: "FOURS", valid: true, total: 8, chainLinks: [] },
    ],
    dice: kitDice,
    inventory: [{ id: "BOOKENDS" }],
  });
  assert.equal(pick.catId, "FOURS");
  assert.match(pick.decision, /clear/);
});
