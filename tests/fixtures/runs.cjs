"use strict";
// Deterministic, synthetic saves. No user save data is included.
function bone(value, slot = 0, extra = {}) {
  return {
    id: `fixture-bone-${slot}`,
    value,
    faces: [1, 2, 3, 4, 5, 6].map((value) => ({
      id: "standard",
      value,
      type: "standard",
      label: String(value),
      style: "",
    })),
    faceId: null,
    faceLabel: null,
    faceStyle: null,
    type: "standard",
    ...extra,
  };
}
const dice = (values) => values.map((value, slot) => bone(value, slot));
/** @param {Array<{ value?: number, faceId?: string, type?: string, extra?: object }>} specs */
function diceWithFaces(specs) {
  return specs.map((spec, slot) =>
    bone(spec.value ?? 1, slot, {
      ...(spec.faceId ? { faceId: spec.faceId } : {}),
      ...(spec.type ? { type: spec.type } : {}),
      ...(spec.extra || {}),
    }),
  );
}
function run(overrides = {}) {
  return {
    version: 2,
    arcId: "witness",
    phase: "PLAY",
    personaId: "STREET_RAT",
    personaIdx: 0,
    round: 1,
    score: 0,
    target: 85,
    hands: 4,
    discards: 3,
    gold: 20,
    debt: 0,
    stash: 0,
    insaneContract: false,
    inventory: [],
    consumables: [],
    dice: dice([1, 2, 3, 4, 5]),
    kept: [false, false, false, false, false],
    hasRolled: true,
    usedCats: [],
    handLevels: {},
    flowStreak: 0,
    shopItems: [],
    shopRefreshes: 0,
    gambleStake: 0,
    activeWager: null,
    currentRouteEffect: null,
    paths: [],
    activeBossId: null,
    selectedItem: null,
    carvingDie: null,
    swapMode: false,
    swapIdx: null,
    history: [],
    runStats: {
      totalHeat: 0,
      biggestHustle: 0,
      finalBoss: "",
      build: { primary: "UNKNOWN", peakConfidence: 0, keyItems: [] },
    },
    ...overrides,
  };
}
function snapshot(overrides = {}) {
  const base = run(overrides);
  return {
    ...base,
    persona: { id: "STREET_RAT", cash: 20, plays: 4, pills: 3 },
    activeBoss: null,
    hardwareDisabled: false,
    currentTarget: base.target,
    rolling: false,
    rollingSlots: [false, false, false, false, false],
    reducedMotion: true,
    runClosed: false,
    meta: { launderedCash: 0, bestHeat: 0, totalRuns: 0, completedRuns: 0 },
    ...overrides,
  };
}
const wager = () =>
  run({ gold: 15, activeWager: { stake: 5, threshold: 110 } });
const gamble = () =>
  run({ phase: "GAMBLE", round: 3, gold: 25, gambleStake: 5 });
const shop = () =>
  run({
    phase: "SHOP",
    round: 2,
    gold: 45,
    target: 110,
    shopItems: [
      {
        id: "MULT_FACE",
        value: 0,
        label: "+1 MULT",
        type: "modifier",
        cost: 12,
        rarity: "common",
        style: "bg-[#111] text-[#0df] border-[#0df]",
      },
      {
        id: "GOLD_FACE",
        value: 0,
        label: "+$2 CASH",
        type: "modifier",
        cost: 10,
        rarity: "common",
        style: "bg-[#1a1a00] text-[#d6b85c] border-[#d6b85c]",
      },
    ],
    paths: [
      {
        id: "LOCAL",
        name: "BACK ALLEY",
        desc: "Standard hustle.",
        mod: 1,
        color: "border-gray-600 text-gray-400",
      },
      {
        id: "PAWN",
        name: "PAWN SHOP",
        desc: "Higher quota, +$15 cash.",
        mod: 1.2,
        reward: 15,
        color: "border-yellow-600 text-yellow-400",
      },
    ],
  });
const rapSheet = () =>
  run({
    phase: "RAP_SHEET",
    round: 4,
    gold: 12,
    history: [
      {
        id: "h1",
        round: 3,
        category: "Y",
        total: 45,
        values: [2, 2, 2, 3, 4],
        triggers: [],
      },
    ],
    runStats: {
      totalHeat: 200,
      biggestHustle: 80,
      finalBoss: "THE BOUNCER",
      build: { primary: "UNKNOWN", peakConfidence: 0, keyItems: [] },
    },
  });
const carving = () =>
  run({
    phase: "CARVING",
    gold: 8,
    carvingDie: 2,
    selectedItem: {
      id: "MULT_FACE",
      value: 0,
      label: "+1 MULT",
      type: "modifier",
      cost: 12,
      rarity: "common",
    },
  });
const terminal = () =>
  snapshot({
    round: 10,
    hands: 1,
    target: 200,
    currentTarget: 200,
    dice: dice([6, 6, 6, 6, 6]),
    gold: 15,
    activeWager: { stake: 5, threshold: 300 },
  });
/** Last hand, heat below quota — score any small payout in browser to trigger bust flow. */
const bustLastHand = () =>
  run({
    hands: 1,
    discards: 0,
    score: 0,
    target: 85,
    hasRolled: true,
    dice: dice([1, 2, 3, 4, 5]),
  });
/** Final job, one hand left — score Sixes (30 heat) in browser to trigger victory flow. */
const victoryLastHand = () =>
  run({
    round: 10,
    hands: 1,
    discards: 0,
    score: 125,
    target: 85,
    hasRolled: true,
    dice: dice([6, 6, 6, 6, 6]),
    runStats: {
      totalHeat: 400,
      biggestHustle: 80,
      finalBoss: "",
      build: { primary: "UNKNOWN", peakConfidence: 0, keyItems: [] },
    },
  });
const bossCases = [
  ["BOUNCER", 195],
  ["LOAN_SHARK", 130],
  ["JUNKIE", 130],
  ["CROOKED_COP", 130],
  ["INFORMANT", 130],
  ["THE_RAID", 358],
];
module.exports = {
  bone,
  dice,
  diceWithFaces,
  run,
  snapshot,
  wager,
  gamble,
  carving,
  shop,
  rapSheet,
  terminal,
  bustLastHand,
  victoryLastHand,
  bossCases,
};
