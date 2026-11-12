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

test("WP2 banks clear — mustBankClear when best line clears quota", () => {
  assert.equal(P.mustBankClear({
    revision: P.WP2_REVISION,
    score: 70,
    target: 75,
    bestTotal: 8,
    hands: 2,
  }), true);
  assert.equal(P.mustBankClear({
    revision: P.LEGACY_REVISION,
    score: 70,
    target: 75,
    bestTotal: 8,
    hands: 2,
  }), false);
});

test("WP2 organic-aware category — prefers pairwise links over raw chips", () => {
  const picked = P.pickCategory({
    revision: P.WP2_REVISION,
    score: 0,
    target: 200,
    candidates: [
      { catId: "FOURS", valid: true, total: 90, chainLinks: [] },
      { catId: "C", valid: true, total: 40, chainLinks: [{ from: "ghost_echo", to: "bookends_retrigger" }] },
    ],
  });
  assert.equal(picked.catId, "C");
  assert.equal(picked.organicPairs, 1);
});

test("WP2 clear-quota category — still scores clearing line when available", () => {
  const picked = P.pickCategory({
    revision: P.WP2_REVISION,
    score: 60,
    target: 75,
    candidates: [
      { catId: "FOURS", valid: true, total: 20, chainLinks: [{ from: "ghost_echo", to: "bookends_retrigger" }] },
      { catId: "B", valid: true, total: 18, chainLinks: [] },
    ],
  });
  assert.equal(picked.catId, "FOURS");
  assert.equal(picked.decision, "clear_quota");
});

test("legacy category pick — max chips only", () => {
  const picked = P.pickCategory({
    revision: P.LEGACY_REVISION,
    score: 0,
    target: 75,
    candidates: [
      { catId: "C", valid: true, total: 10, chainLinks: [{ from: "ghost_echo", to: "bookends_retrigger" }] },
      { catId: "FOURS", valid: true, total: 50, chainLinks: [] },
    ],
  });
  assert.equal(picked.catId, "FOURS");
});

test("WP2 reroll discipline — ghost/echo out of reach with discards", () => {
  const dice = [
    { value: 1, faceId: "GHOST_FACE" },
    { value: 2, faceId: null },
    { value: 3, faceId: null },
    { value: 4, faceId: null },
    { value: 6, faceId: "ECHO_FACE" },
  ];
  const plan = P.shouldReroll({
    revision: P.WP2_REVISION,
    score: 0,
    target: 75,
    hands: 3,
    discards: 2,
    bestTotal: 12,
    e2eGreedy: false,
    dice,
  });
  assert.equal(plan.reroll, true);
  assert.match(plan.reason, /reach|weak/);
});

test("WP2 keep slots — lone ghost and echo on indices 0 and 4", () => {
  const dice = [
    { value: 3, faceId: "GHOST_FACE" },
    { value: 2, faceId: null },
    { value: 5, faceId: null },
    { value: 4, faceId: null },
    { value: 1, faceId: "ECHO_FACE" },
  ];
  const sel = P.selectKeptSlots({ revision: P.WP2_REVISION, dice });
  assert.deepEqual(sel.kept, [true, false, false, false, true]);
});

test("index.html wires sim policy script and quota bank guard", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(html, /assets\/sim-bot-policy\.js/);
  assert.match(html, /mustBankClear/);
  assert.match(html, /recordSimBotDecision/);
  assert.match(html, /evaluateCategoryCandidates/);
});
