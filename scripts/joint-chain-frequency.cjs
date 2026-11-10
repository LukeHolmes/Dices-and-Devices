"use strict";
/**
 * Joint frequency for ghost_echo→bookends via production calculateScore (not independent marginals).
 * Rolls random lane values on standard bones; carved GHOST/ECHO faces are fixed on dice pool indices.
 */
const { createGame } = require("../tests/helpers/game.cjs");
const { snapshot, dice, bone } = require("../tests/fixtures/runs.cjs");

const SAMPLES = Number(process.env.JOINT_SAMPLES || 20000);
const SEED = Number(process.env.JOINT_SEED || 55433);

const mulberry32 = (a) => () => {
  let t = (a += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const rand = mulberry32(SEED);
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

let ghostEcho = 0;
let bookends = 0;
let pairLink = 0;
let hauntedBookends = 0;

for (let n = 0; n < SAMPLES; n++) {
  const d = dice(Array.from({ length: 5 }, () => 1 + Math.floor(rand() * 6)));
  d[1] = bone(d[1].value, 1, { faceId: "ECHO_FACE", type: "adjacent" });
  d[2] = bone(d[2].value, 2, { faceId: "GHOST_FACE", type: "ethereal" });
  const r = g.api.GutterbonesRules.calculateScore("C", d, ctx);
  const ids = (r.synergyEvents || []).map((e) => e.id);
  if (ids.includes("ghost_echo")) ghostEcho += 1;
  if (ids.includes("bookends_retrigger")) bookends += 1;
  if ((r.chainLinks || []).some((l) => l.from === "ghost_echo" && l.to === "bookends_retrigger")) pairLink += 1;
  const steps = (r.explanationSteps || []).map((s) => String(s.label || ""));
  if (steps.some((l) => l.includes("BOOKENDS")) && ids.includes("ghost_echo") && d[0].value === d[2].value && d[4].value === d[2].value && d[0].value !== d[4].value) {
    hauntedBookends += 1;
  }
}

const report = {
  samples: SAMPLES,
  seed: SEED,
  ghost_echo: { num: ghostEcho, den: SAMPLES, rate: ghostEcho / SAMPLES },
  bookends_retrigger: { num: bookends, den: SAMPLES, rate: bookends / SAMPLES },
  pairwise_ghost_echo_bookends: { num: pairLink, den: SAMPLES, rate: pairLink / SAMPLES },
  joint_given_ghost_echo: {
    num: pairLink,
    den: ghostEcho,
    rate: ghostEcho ? pairLink / ghostEcho : 0,
  },
  haunted_end_layouts: hauntedBookends,
};

console.log(JSON.stringify(report, null, 2));
