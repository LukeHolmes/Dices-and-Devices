"use strict";
/**
 * Organic builder sim must finish cleanly; pairwise ghost→bookends is gated by production
 * calculateScore joint frequency + e2e executePayout (not marginal sim linkCounts alone).
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { createGame } = require("../helpers/game.cjs");
const { snapshot, dice, bone } = require("../fixtures/runs.cjs");

function jointGhostBookendsRate(samples = 4000) {
  const g = createGame(snapshot());
  const ctx = {
    handLevels: {},
    flowStreak: 0,
    inventory: [{ id: "BOOKENDS" }],
    hardwareDisabled: false,
    activeBoss: null,
    CATEGORIES: g.api.CATEGORIES,
    HAND_MASTERY_TUNING: { baseLevel: 1, maxLevel: 8, chipPerLevel: 5 },
    getFlowMultiplier: g.api.getFlowMultiplier,
    getHandMasteryBonus: g.api.getHandMasteryBonus,
    synergyTuning: { enabled: true, chainLinkingEnabled: true, maxChainPasses: 8 },
  };
  let pair = 0;
  for (let n = 0; n < samples; n++) {
    const d = dice(Array.from({ length: 5 }, (_, i) => 1 + ((n * 11 + i * 5) % 6)));
    d[1] = bone(d[1].value, 1, { faceId: "ECHO_FACE", type: "adjacent" });
    d[2] = bone(d[2].value, 2, { faceId: "GHOST_FACE", type: "ethereal" });
    const r = g.api.GutterbonesRules.calculateScore("C", d, ctx);
    if ((r.chainLinks || []).some((l) => l.from === "ghost_echo" && l.to === "bookends_retrigger")) pair += 1;
  }
  return { pair, samples, rate: pair / samples };
}

test("builder sim — 30 games complete without stuck failures", () => {
  const runCjs = path.join(__dirname, "run.cjs");
  const r = spawnSync(process.execPath, [runCjs, "--games=30", "--max-steps=12000", "--parallel=1", "--viewports=blocking"], {
    cwd: path.join(__dirname, "../.."),
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  const text = (r.stderr || "") + (r.stdout || "");
  const marker = '\n{\n  "games"';
  const start = text.lastIndexOf(marker);
  assert.ok(start >= 0, `sim produced no JSON summary: ${text.slice(0, 400)}`);
  const summary = JSON.parse(text.slice(start + 1));
  assert.equal(summary.failureCount, 0, "sim must finish without stuck games");
});

test("builder sim — ghost_echo→bookends joint production rate after rule relax", () => {
  const { pair, samples, rate } = jointGhostBookendsRate(5000);
  assert.ok(rate >= 0.08, `expected joint pairwise rate ≥8%, got ${(rate * 100).toFixed(2)}% (${pair}/${samples})`);
});
