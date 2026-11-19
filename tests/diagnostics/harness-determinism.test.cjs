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

test("harness v4 splits cosmetic Math.random from gameplay __GB_SIM_GAME_RANDOM__", () => {
  const w = runShim(42);
  const cosmetic = [w.Math.random(), w.Math.random()];
  const gameplay = [w.__GB_SIM_GAME_RANDOM__(), w.__GB_SIM_GAME_RANDOM__()];
  assert.equal(w.__GB_SIM_COSMETIC_DRAW_COUNT__, 2);
  assert.equal(w.__GB_SIM_RNG_DRAW_COUNT__, 2);
  assert.notDeepEqual(cosmetic, gameplay);

  const w2 = runShim(42);
  assert.deepEqual(
    [w2.Math.random(), w2.Math.random()],
    cosmetic,
  );
  assert.deepEqual(
    [w2.__GB_SIM_GAME_RANDOM__(), w2.__GB_SIM_GAME_RANDOM__()],
    gameplay,
  );
  assert.equal(w2.__GB_SIM_STEP_SYNC__, true);
});

test("gameplay draws record call sites", () => {
  const w = runShim(7);
  w.__GB_SIM_GAME_RANDOM__();
  assert.equal(w.__GB_SIM_GAME_DRAW_LOG__.length, 1);
  assert.ok(typeof w.__GB_SIM_GAME_DRAW_LOG__[0].site === "string");
  assert.equal(w.__GB_SIM_GAME_DRAW_LOG__[0].n, 1);
});

test("cosmetic stream resets without touching gameplay stream", () => {
  const w = runShim(99);
  w.__GB_SIM_RNG_BOOT_LOCKED__ = false;
  const g1 = w.__GB_SIM_GAME_RANDOM__();
  const c1 = w.Math.random();
  w.__GB_SIM_RESET_COSMETIC_STREAM__();
  const g2 = w.__GB_SIM_GAME_RANDOM__();
  const c2 = w.Math.random();
  assert.equal(w.__GB_SIM_RNG_DRAW_COUNT__, 2);
  assert.equal(w.__GB_SIM_COSMETIC_DRAW_COUNT__, 1);
  assert.equal(c1, c2);
  assert.notEqual(g1, g2);
});