"use strict";

const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const vm = require("node:vm");

const shimSource = fs.readFileSync(
  path.join(__dirname, "../../tests/sim/harness-determinism-shim.js"),
  "utf8",
);

function runShim(seed) {
  const sandbox = { window: {}, console, Math };
  vm.createContext(sandbox);
  sandbox.window.Math = Math;
  vm.runInContext(shimSource, sandbox);
  vm.runInContext(`window.__GB_SIM_INSTALL_GAME_SEED__(${seed}); window.__GB_SIM_RNG_BOOT_LOCKED__ = false;`, sandbox);
  return sandbox.window;
}

test("harness v5 splits cosmetic Math.random from gameplay substreams", () => {
  const w = runShim(42);
  const cosmetic = [w.Math.random(), w.Math.random()];
  w.__GB_SIM_ROUND__ = 3;
  const shopA = w.__GB_SIM_DRAW_GAME__("generateShop", 3);
  const jitterA = w.__GB_SIM_DRAW_GAME__("weightedSortJitter", 3);
  assert.equal(w.__GB_SIM_COSMETIC_DRAW_COUNT__, 2);
  assert.equal(w.__GB_SIM_RNG_DRAW_COUNT__, 2);
  assert.notDeepEqual(cosmetic, [shopA, jitterA]);

  const w2 = runShim(42);
  w2.__GB_SIM_ROUND__ = 3;
  assert.deepEqual([w2.Math.random(), w2.Math.random()], cosmetic);
  assert.equal(w2.__GB_SIM_DRAW_GAME__("generateShop", 3), shopA);
  assert.equal(w2.__GB_SIM_DRAW_GAME__("weightedSortJitter", 3), jitterA);
  assert.equal(w2.__GB_SIM_STEP_SYNC__, true);
});

test("named substreams are call-order independent within a round", () => {
  const w = runShim(7);
  w.__GB_SIM_ROUND__ = 5;
  const a1 = w.__GB_SIM_DRAW_GAME__("generateShop", 5);
  const b1 = w.__GB_SIM_DRAW_GAME__("weightedSortJitter", 5);
  const a2 = w.__GB_SIM_DRAW_GAME__("generateShop", 5);
  const b2 = w.__GB_SIM_DRAW_GAME__("weightedSortJitter", 5);

  const w2 = runShim(7);
  w2.__GB_SIM_ROUND__ = 5;
  const b1Alt = w2.__GB_SIM_DRAW_GAME__("weightedSortJitter", 5);
  const a1Alt = w2.__GB_SIM_DRAW_GAME__("generateShop", 5);
  const b2Alt = w2.__GB_SIM_DRAW_GAME__("weightedSortJitter", 5);
  const a2Alt = w2.__GB_SIM_DRAW_GAME__("generateShop", 5);

  assert.equal(a1, a1Alt);
  assert.equal(a2, a2Alt);
  assert.equal(b1, b1Alt);
  assert.equal(b2, b2Alt);
});

test("gameplay draws record caller sites", () => {
  const w = runShim(7);
  w.__GB_SIM_DRAW_GAME__("modifierShopOffers", 2);
  assert.equal(w.__GB_SIM_GAME_DRAW_LOG__.length, 1);
  assert.equal(w.__GB_SIM_GAME_DRAW_LOG__[0].site, "modifierShopOffers");
  assert.equal(w.__GB_SIM_GAME_DRAW_LOG__[0].caller, "modifierShopOffers");
  assert.equal(w.__GB_SIM_GAME_DRAW_LOG__[0].round, 2);
  assert.equal(w.__GB_SIM_GAME_DRAW_LOG__[0].subCounter, 1);
});

test("legacy __GB_SIM_GAME_RANDOM__ uses legacyGameRandom caller", () => {
  const w = runShim(99);
  w.__GB_SIM_ROUND__ = 1;
  w.__GB_SIM_GAME_RANDOM__();
  assert.equal(w.__GB_SIM_LAST_GAME_DRAW_SITE__, "legacyGameRandom");
});

test("cosmetic stream resets without touching gameplay substreams", () => {
  const w = runShim(99);
  w.__GB_SIM_RNG_BOOT_LOCKED__ = false;
  w.__GB_SIM_ROUND__ = 4;
  const g1 = w.__GB_SIM_DRAW_GAME__("generateShop", 4);
  const c1 = w.Math.random();
  w.__GB_SIM_RESET_COSMETIC_STREAM__();
  const g2 = w.__GB_SIM_DRAW_GAME__("generateShop", 4);
  const c2 = w.Math.random();
  assert.equal(w.__GB_SIM_RNG_DRAW_COUNT__, 2);
  assert.equal(w.__GB_SIM_COSMETIC_DRAW_COUNT__, 1);
  assert.equal(c1, c2);
  assert.notEqual(g1, g2);
});