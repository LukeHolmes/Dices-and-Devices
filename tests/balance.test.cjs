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

test("opening balance — Street Rat clears R1 @90 often enough (seeded sim)", () => {
  const p = probClear({ target: 90, pills: 3, iterations: ITER, seed: SEED, totalRuns: 3 });
  assert.ok(p >= 0.52 && p <= 0.95, `expected P(clear) in [0.52, 0.95], got ${p}`);
});

test("opening balance — Enforcer clears R1 @90 at least sometimes (seeded sim)", () => {
  const p = probClear({ target: 90, pills: 0, iterations: ITER, seed: SEED + 1 });
  assert.ok(p >= 0.15, `expected P(clear) >= 0.15, got ${p}`);
});

test("opening balance — quota curve smoothed (R2–R4 steps, R6 anchor)", () => {
  const routes = loadRoutes();
  const r2 = projectRoundTarget(routes, 90, 1, 2);
  const r3 = projectRoundTarget(routes, 90, 1, 3);
  const r4 = projectRoundTarget(routes, 90, 1, 4);
  const r6 = projectRoundTarget(routes, 90, 1, 6);
  assert.ok(r2 >= 104 && r2 <= 110, `R2 ${r2}`);
  assert.ok(r3 - r2 >= 12 && r3 - r2 <= 22, `R2→R3 step ${r3 - r2}`);
  assert.ok(r4 - r3 >= 12 && r4 - r3 <= 22, `R3→R4 step ${r4 - r3}`);
  assert.ok(r6 >= 150 && r6 <= 200, `R6 anchor ${r6}`);
});

test("FIRST_RUN_TUNING — first-run opening target matches standard R1 quota", () => {
  const { html } = require("./helpers/game.cjs");
  assert.match(html, /FIRST_RUN_TUNING[\s\S]*openingTarget:\s*90/);
  assert.match(html, /EARLY_GAME_TUNING[\s\S]*openingTarget:\s*90/);
});
