"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  probClear,
  projectRoundTarget,
  loadRoutes,
  BACK_ALLEY,
} = require("../scripts/sim-opening.cjs");

const SEED = 0x6e202610;
const ITER = 6000;

test("opening balance — Street Rat clears R1 @85 often enough (seeded sim)", () => {
  const p = probClear({ target: 85, pills: 3, iterations: ITER, seed: SEED });
  assert.ok(p >= 0.6 && p <= 0.95, `expected P(clear) in [0.6, 0.95], got ${p}`);
});

test("opening balance — Enforcer clears R1 @85 at least sometimes (seeded sim)", () => {
  const p = probClear({ target: 85, pills: 0, iterations: ITER, seed: SEED + 1 });
  assert.ok(p >= 0.2, `expected P(clear) >= 0.2, got ${p}`);
});

test("opening balance — R6 Back Alley quota stays near legacy curve", () => {
  const routes = loadRoutes();
  const newR6 = projectRoundTarget(routes, 85, 1, 6);
  const legacyR6 = 312;
  const low = legacyR6 * 0.9;
  const high = legacyR6 * 1.1;
  assert.ok(
    newR6 >= low && newR6 <= high,
    `R6 target ${newR6} should be within ±10% of legacy ${legacyR6}`,
  );
  assert.equal(newR6, 297);
});

test("FIRST_RUN_TUNING — first-run opening target is 70 in catalog", () => {
  const { html } = require("./helpers/game.cjs");
  assert.match(html, /FIRST_RUN_TUNING[\s\S]*openingTarget:\s*70/);
  assert.match(html, /EARLY_GAME_TUNING[\s\S]*openingTarget:\s*85/);
});
