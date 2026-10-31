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
    nextShopTag: null,
    activeShopTag: null,
    routeModifiers: {},
    synergyState: { categoryMarks: {}, comboMeter: 0, heatSpikeNextHand: 0 },
    categoryMarkedThisRound: [],
    blueprints: [],
    blueprintRoundFlags: { multEngineUsed: false, flowSaveUsed: false },
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
const playHeavyHardware = () =>
  run({
    phase: "PLAY",
    round: 5,
    score: 40,
    target: 178,
    hands: 3,
    stash: 55,
    inventory: [
      { id: "ENGINE", name: "The Engine", instanceId: "hw-1" },
      { id: "FUSE_BOX", name: "Fuse Box", instanceId: "hw-2" },
      { id: "CROWBAR", name: "Crowbar", instanceId: "hw-3" },
      { id: "HOT_STREAK_COIL", name: "Hot Streak Coil", instanceId: "hw-4" },
      { id: "MIRROR_RIG", name: "Mirror Rig", instanceId: "hw-5" },
      { id: "CENTERPIECE", name: "Centerpiece", instanceId: "hw-6" },
    ],
    hasRolled: true,
    dice: dice([3, 4, 5, 2, 6]),
  });

const shopBusy = () => {
  const items = [
    "MULT_FACE",
    "GOLD_FACE",
    "PIP_FACE",
    "FLOW_FACE",
    "WILD_FACE",
    "DEBT_FACE",
    "GHOST_FACE",
    "SHIV_FACE",
  ].map((id, i) => ({
    id: `${id}_${i}`,
    value: 0,
    label: id.replace(/_/g, " "),
    type: "modifier",
    cost: 10 + i * 3,
    rarity: i > 4 ? "rare" : "common",
    style: "bg-[#111] text-[#0df] border-[#0df]",
  }));
  return run({
    phase: "SHOP",
    round: 4,
    gold: 80,
    target: 161,
    stash: 40,
    shopItems: items,
    paths: [
      { id: "LOCAL", name: "BACK ALLEY", desc: "Standard hustle.", mod: 1, color: "border-gray-600 text-gray-400" },
      { id: "PAWN", name: "PAWN SHOP", desc: "Higher quota.", mod: 1.2, reward: 15, color: "border-yellow-600 text-yellow-400" },
      { id: "HIDEOUT", name: "SAFEHOUSE", desc: "Extra play.", mod: 1.09, handDelta: 1, color: "border-green-700 text-green-400" },
      { id: "BOSS", name: "TURF WAR", desc: "Boss turf.", mod: 1.4, color: "border-red-700 text-red-400" },
    ],
  });
};

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
const rapSheetR7 = () =>
  run({
    phase: "RAP_SHEET",
    round: 7,
    target: 358,
    score: 280,
    gold: 18,
    runStats: {
      totalHeat: 890,
      biggestHustle: 210,
      finalBoss: "THE BOUNCER",
      build: { primary: "MULT_ENGINE", peakConfidence: 0.72, keyItems: ["ENGINE", "LOADED_DIE"] },
    },
    history: [
      { id: "h1", round: 7, category: "TOK", total: 180, values: [2, 2, 2, 3, 4] },
    ],
  });

const rapSheetHistory3 = () =>
  run({
    phase: "RAP_SHEET",
    round: 6,
    gold: 8,
    history: [
      { id: "h1", round: 4, category: "TOK", total: 40, values: [2, 2, 2, 3, 4], triggers: [] },
      { id: "h2", round: 5, category: "C", total: 24, values: [1, 2, 3, 4, 5], triggers: [] },
      { id: "h3", round: 6, category: "LS", total: 120, values: [1, 2, 3, 4, 5], triggers: [{ name: "FLOW", value: "x1" }] },
    ],
    runStats: {
      totalHeat: 320,
      biggestHustle: 120,
      finalBoss: "THE BOUNCER",
      build: { primary: "UNKNOWN", peakConfidence: 0, keyItems: [] },
    },
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
  ["THE_RAID", 179],
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
  shopBusy,
  playHeavyHardware,
  rapSheet,
  rapSheetHistory3,
  rapSheetR7,
  terminal,
  bustLastHand,
  victoryLastHand,
  bossCases,
};
