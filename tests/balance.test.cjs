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

test("opening balance — Street Rat clears R1 @75 often enough (seeded sim)", () => {
  const p = probClear({ target: 75, pills: 3, iterations: ITER, seed: SEED, totalRuns: 3 });
  assert.ok(p >= 0.75 && p <= 1, `expected P(clear) in [0.75, 1], got ${p}`);
});

test("opening balance — Enforcer clears R1 @75 at least sometimes (seeded sim)", () => {
  const p = probClear({ target: 75, pills: 0, iterations: ITER, seed: SEED + 1 });
  assert.ok(p >= 0.2, `expected P(clear) >= 0.2, got ${p}`);
});

test("opening balance — quota curve smoothed (R2–R4 steps, R6 anchor)", () => {
  const routes = loadRoutes();
  const r2 = projectRoundTarget(routes, 75, 1, 2);
  const r3 = projectRoundTarget(routes, 75, 1, 3);
  const r4 = projectRoundTarget(routes, 75, 1, 4);
  const r6 = projectRoundTarget(routes, 75, 1, 6);
  assert.ok(r2 >= 88 && r2 <= 92, `R2 ${r2}`);
  assert.ok(r3 - r2 >= 12 && r3 - r2 <= 22, `R2→R3 step ${r3 - r2}`);
  assert.ok(r4 - r3 >= 12 && r4 - r3 <= 22, `R3→R4 step ${r4 - r3}`);
  assert.ok(r6 >= 140 && r6 <= 210, `R6 anchor ${r6}`);
});

test("FIRST_RUN_TUNING — first-run opening target matches standard R1 quota", () => {
  const { html } = require("./helpers/game.cjs");
  assert.match(html, /FIRST_RUN_TUNING[\s\S]*openingTarget:\s*75/);
  assert.match(html, /EARLY_GAME_TUNING[\s\S]*openingTarget:\s*75/);
});
