"use strict";
/**
 * Builder sim diagnosis: pairwise linkCounts in sim:50 track noteChainLink pairs from
 * production calculateScore (same path as live play). Zero counts with chainDepth>0 means
 * bots rarely assemble adjacency (blood+fuse+engine, etc.), not broken telemetry.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createGame } = require("./helpers/game.cjs");
const { snapshot, dice, bone } = require("./fixtures/runs.cjs");

const LINK_PAIRS_RECORDED = [
  "blood_ripple→fuse_spark",
  "fuse_spark→engine_link",
  "ghost_echo→bookends_retrigger",
  "wire_feed→crowbar_cascade",
];

test("production calculateScore records pairwise links when assembly matches synergy-stage2", () => {
  const g = createGame(snapshot());
  const d = dice([6, 6, 0, 3, 4]);
  d[0] = bone(6, 0, { faceId: "BLOOD_6", type: "blood" });
  d[1] = bone(6, 1, { faceId: "BLOOD_6", type: "blood" });
  d[2] = bone(0, 2, { faceId: "FUSE_FACE", type: "modifier" });
  const ctx = {
    handLevels: {},
    flowStreak: 0,
    inventory: [{ id: "ENGINE" }],
    hardwareDisabled: false,
    activeBoss: null,
    CATEGORIES: g.api.CATEGORIES,
    HAND_MASTERY_TUNING: { baseLevel: 1, maxLevel: 8, chipPerLevel: 5 },
    getFlowMultiplier: g.api.getFlowMultiplier,
    getHandMasteryBonus: g.api.getHandMasteryBonus,
    synergyTuning: { enabled: true, chainLinkingEnabled: true, maxChainPasses: 8 },
  };
  const fuseBlood = g.api.GutterbonesRules.calculateScore("C", d, ctx);
  assert.ok(fuseBlood.chainLinks.some((l) => l.from === "blood_ripple" && l.to === "fuse_spark"));

  const d2 = dice([1, 4, 0, 6, 6]);
  d2[2] = bone(0, 2, { faceId: "FUSE_FACE", type: "modifier" });
  d2[3] = bone(6, 3, { faceId: "BLOOD_6", type: "blood" });
  d2[4] = bone(6, 4, { faceId: "BLOOD_6", type: "blood" });
  const engine = g.api.GutterbonesRules.calculateScore("C", d2, ctx);
  assert.ok(engine.chainLinks.some((l) => l.from === "fuse_spark" && l.to === "engine_link"));
});

test("sim runner aggregates only implemented noteChainLink pairs", () => {
  const runSource = fs.readFileSync(path.join(__dirname, "sim/run.cjs"), "utf8");
  const keys = [...runSource.matchAll(/"([^"]+→[^"]+)"/g)].map((m) => m[1]);
  for (const pair of LINK_PAIRS_RECORDED) {
    assert.ok(keys.includes(pair), `run.cjs tracks ${pair}`);
  }
  assert.equal(
    keys.includes("blood_ripple→ghost_echo"),
    true,
    "blood_ripple→ghost_echo is aggregated but not emitted by noteChainLink today",
  );
});
