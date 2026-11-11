"use strict";
/** Emit numeric v1 vs v2 paired-compare deltas (stdout JSON). */
const { createGame } = require("../tests/helpers/game.cjs");
const { snapshot, dice, bone } = require("../tests/fixtures/runs.cjs");

const PAIRS = [
  "blood_ripple→fuse_spark",
  "fuse_spark→engine_link",
  "ghost_echo→bookends_retrigger",
  "wire_feed→crowbar_cascade",
];

function linkCtx(g, inv) {
  return {
    handLevels: {},
    flowStreak: 0,
    inventory: inv,
    hardwareDisabled: false,
    activeBoss: null,
    CATEGORIES: g.api.CATEGORIES,
    HAND_MASTERY_TUNING: { baseLevel: 1, maxLevel: 8, chipPerLevel: 5 },
    getFlowMultiplier: g.api.getFlowMultiplier,
    getHandMasteryBonus: g.api.getHandMasteryBonus,
    synergyTuning: {
      enabled: true,
      chainLinkingEnabled: true,
      maxChainPasses: 8,
      maxChainBonusMultPerHand: 6,
      debtCollectorMaxMult: 4,
    },
  };
}

function ghostEchoV1(resolved, destroyed) {
  for (let i = 0; i < 5; i++) {
    if (destroyed.has(i) || resolved[i].faceId !== "GHOST_FACE") continue;
    const adj = [i - 1, i + 1].filter((j) => j >= 0 && j <= 4);
    if (adj.some((j) => !destroyed.has(j) && (resolved[j].faceId === "ECHO_FACE" || resolved[j].isEchoed))) {
      return true;
    }
  }
  return false;
}

function patchV1(r, resolved, destroyed) {
  if (!r?.chainLinks) return { ...r, chainLinks: [] };
  const out = { ...r, chainLinks: [...r.chainLinks], synergyEvents: [...(r.synergyEvents || [])] };
  const hasGhostEcho = out.synergyEvents.some((e) => e.id === "ghost_echo");
  const hasBookends = out.synergyEvents.some((e) => e.id === "bookends_retrigger");
  if (hasGhostEcho && hasBookends) {
    const bookendsGhostValue =
      resolved[0]?.faceId !== resolved[4]?.faceId
      && resolved[0]?.value === resolved[4]?.value;
    if (!bookendsGhostValue) {
      out.chainLinks = out.chainLinks.filter(
        (l) => !(l.from === "ghost_echo" && l.to === "bookends_retrigger"),
      );
    }
  }
  if (!ghostEchoV1(resolved, destroyed)) {
    out.synergyEvents = out.synergyEvents.filter((e) => e.id !== "ghost_echo");
    out.chainLinks = out.chainLinks.filter((l) => l.from !== "ghost_echo" && l.to !== "ghost_echo");
  }
  return out;
}

function countPair(links, from, to) {
  return (links || []).some((l) => l.from === from && l.to === to);
}

/** Production v1 Bookends hardware: end pip match AND (face match OR ghost_echo already fired). No haunted-only bracket. */
function v1BookendsWouldFire(resolved, destroyed, ghostEchoFired) {
  if (destroyed.has(0) || destroyed.has(4)) return false;
  const valueMatch = resolved[0].value === resolved[4].value;
  const faceMatch = valueMatch && resolved[0].faceId === resolved[4].faceId;
  return valueMatch && (faceMatch || ghostEchoFired);
}

function makeCarvedKitLane(n, layout = "echo1_ghost2") {
  const values = Array.from({ length: 5 }, (_, i) => 1 + ((n * 13 + i * 5) % 6));
  const d = dice(values);
  d[0] = bone(values[0], 0, { faceId: "MULT_FACE", type: "modifier" });
  d[4] = bone(values[4], 4, { faceId: "GOLD_FACE", type: "modifier" });
  if (layout === "echo3_ghost0") {
    d[0] = bone(values[0], 0, { faceId: "GHOST_FACE", type: "ethereal" });
    d[3] = bone(values[3], 3, { faceId: "ECHO_FACE", type: "adjacent" });
  } else if (layout === "echo1_ghost2") {
    d[1] = bone(values[1], 1, { faceId: "ECHO_FACE", type: "adjacent" });
    d[2] = bone(values[2], 2, { faceId: "GHOST_FACE", type: "ethereal" });
  } else {
    d[1] = bone(values[1], 1, { faceId: "ECHO_FACE", type: "adjacent" });
    d[2] = bone(values[2], 2, { faceId: "GHOST_FACE", type: "ethereal" });
  }
  return d;
}

function ghostReachReport(samples = 5000, layout = "echo1_ghost2") {
  const g = createGame(snapshot());
  const ctx = linkCtx(g, [{ id: "BOOKENDS" }]);
  let v1 = { ghost_echo: 0, bookends: 0, pair: 0 };
  let v2 = { ghost_echo: 0, bookends: 0, pair: 0 };
  let reachOnly = 0;
  let reach3NotAdj = 0;
  for (let n = 0; n < samples; n++) {
    const d = makeCarvedKitLane(n, layout);
    const cur = g.api.GutterbonesRules.calculateScore("C", d, ctx);
    const { resolved, destroyed } = g.api.GutterbonesRules.resolveDice(d);
    const old = patchV1(cur, resolved, destroyed);
    const ge = (e) => e.id === "ghost_echo";
    const be = (e) => e.id === "bookends_retrigger";
    if (old.synergyEvents.some(ge)) v1.ghost_echo += 1;
    if (old.synergyEvents.some(be)) v1.bookends += 1;
    if (countPair(old.chainLinks, "ghost_echo", "bookends_retrigger")) v1.pair += 1;
    if (cur.synergyEvents.some(ge)) v2.ghost_echo += 1;
    if (cur.synergyEvents.some(be)) v2.bookends += 1;
    if (countPair(cur.chainLinks, "ghost_echo", "bookends_retrigger")) v2.pair += 1;
    const gSlots = d.map((x, i) => (x.faceId === "GHOST_FACE" ? i : -1)).filter((i) => i >= 0);
    const eSlots = d.map((x, i) => (x.faceId === "ECHO_FACE" ? i : -1)).filter((i) => i >= 0);
    const inReach = gSlots.some((g) => eSlots.some((e) => Math.abs(g - e) <= 3));
    const adjOnly = gSlots.some((g) => eSlots.some((e) => Math.abs(g - e) === 1));
    if (inReach && !adjOnly) reach3NotAdj += 1;
    if (cur.synergyEvents.some(ge) && !adjOnly) reachOnly += 1;
  }
  return {
    denominator: `carved_kit_random_pips_n=${samples}`,
    v1,
    v2,
    delta_pair: v2.pair - v1.pair,
    v1_rates: Object.fromEntries(Object.entries(v1).map(([k, v]) => [k, v / samples])),
    v2_rates: Object.fromEntries(Object.entries(v2).map(([k, v]) => [k, v / samples])),
    reach3_extra_ghost_echo_hits: reachOnly,
    layouts_reach3_not_adjacent: reach3NotAdj,
  };
}

function ghostEchoRateByReach(samples, layout) {
  const g = createGame(snapshot());
  const ctx = linkCtx(g, [{ id: "BOOKENDS" }]);
  let v1Ge = 0;
  let v2Ge = 0;
  let v2Pair = 0;
  let v1Pair = 0;
  for (let n = 0; n < samples; n++) {
    const d = makeCarvedKitLane(n, layout);
    const cur = g.api.GutterbonesRules.calculateScore("C", d, ctx);
    const { resolved, destroyed } = g.api.GutterbonesRules.resolveDice(d);
    const old = patchV1(cur, resolved, destroyed);
    if (old.synergyEvents.some((e) => e.id === "ghost_echo")) v1Ge += 1;
    if (cur.synergyEvents.some((e) => e.id === "ghost_echo")) v2Ge += 1;
    if (countPair(old.chainLinks, "ghost_echo", "bookends_retrigger")) v1Pair += 1;
    if (countPair(cur.chainLinks, "ghost_echo", "bookends_retrigger")) v2Pair += 1;
  }
  return {
    layout,
    denominator: `random_pips_carved_layout_n=${samples}`,
    ghost_echo_v1: v1Ge / samples,
    ghost_echo_v2: v2Ge / samples,
    pair_v1: v1Pair / samples,
    pair_v2: v2Pair / samples,
    delta_ghost_echo: (v2Ge - v1Ge) / samples,
    delta_pair: (v2Pair - v1Pair) / samples,
  };
}

function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function conditionalPreparedLane(samples = 8000) {
  const g = createGame(snapshot());
  const ctx = linkCtx(g, [{ id: "BOOKENDS" }]);
  let pairV2 = 0;
  let pairV1 = 0;
  let geV2 = 0;
  let geV1 = 0;
  let bookendsV2 = 0;
  let bookendsV1 = 0;
  let bothFireV2 = 0;
  let bothFireV1 = 0;
  let endsValueMatch = 0;
  let hauntedOnly = 0;
  for (let n = 0; n < samples; n++) {
    const rand = mulberry32(n + 90210);
    const values = Array.from({ length: 5 }, () => 1 + Math.floor(rand() * 6));
    const d = dice(values);
    d[1] = bone(values[1], 1, { faceId: "ECHO_FACE", type: "adjacent" });
    d[2] = bone(values[2], 2, { faceId: "GHOST_FACE", type: "ethereal" });
    const gp = values[2];
    const vm = values[0] === values[4];
    const bracket = Math.abs(values[0] - gp) <= 1 && Math.abs(values[4] - gp) <= 1;
    if (vm) endsValueMatch += 1;
    if (!vm && bracket) hauntedOnly += 1;
    const cur = g.api.GutterbonesRules.calculateScore("C", d, ctx);
    const { resolved, destroyed } = g.api.GutterbonesRules.resolveDice(d);
    const v1Scored = patchV1(cur, resolved, destroyed);
    const ghostV2 = cur.synergyEvents.some((e) => e.id === "ghost_echo");
    const ghostV1 = ghostEchoV1(resolved, destroyed);
    const bookV2 = cur.synergyEvents.some((e) => e.id === "bookends_retrigger");
    const bookV1 = v1BookendsWouldFire(resolved, destroyed, ghostV2);
    if (ghostV2) geV2 += 1;
    if (ghostV1) geV1 += 1;
    if (bookV2) bookendsV2 += 1;
    if (bookV1) bookendsV1 += 1;
    if (ghostV2 && bookV2) bothFireV2 += 1;
    if (ghostV1 && bookV1) bothFireV1 += 1;
    if (countPair(cur.chainLinks, "ghost_echo", "bookends_retrigger")) pairV2 += 1;
    if (countPair(v1Scored.chainLinks, "ghost_echo", "bookends_retrigger")) pairV1 += 1;
  }
  const pct = (x) => `${x}/${samples} (${((x / samples) * 100).toFixed(2)}%)`;
  return {
    label: "conditional_prepared_lane_ECHO@2_GHOST@3_independent_pips",
    denominator: `${samples} independent pip vectors (mulberry32), faces fixed; not shop/carve play`,
    ends_value_match: `${endsValueMatch}/${samples}`,
    bookends_via_haunted_only: `${hauntedOnly}/${samples}`,
    ghost_echo_v2: pct(geV2),
    ghost_echo_v1_reach_adj_only: pct(geV1),
    bookends_hardware_v2: pct(bookendsV2),
    bookends_hardware_v1_value_or_face_with_ghost: pct(bookendsV1),
    logical_and_both_fire_v2: pct(bothFireV2),
    logical_and_both_fire_v1: pct(bothFireV1),
    delta_logical_and_pp: ((bothFireV2 - bothFireV1) / samples) * 100,
    link_telemetry_v2: pct(pairV2),
    link_telemetry_v1_logging_patch: pct(pairV1),
    delta_link_telemetry_pp: ((pairV2 - pairV1) / samples) * 100,
    note: "Compare logical_and before link_telemetry; v1 bookends = valueMatch&&(faceMatch||ghost); v2 adds haunted bracket path",
  };
}

const report = {
  ghost_bookends_carved_kit_adjacent: ghostReachReport(8000),
  reach3_layout_echo3_ghost0: ghostEchoRateByReach(6000, "echo3_ghost0"),
  reach3_layout_echo1_ghost2: ghostEchoRateByReach(6000, "echo1_ghost2"),
  conditional_prepared_lane: conditionalPreparedLane(6000),
  caps_blood_fuse_engine: (() => {
    const g = createGame(snapshot());
    const d = dice([1, 4, 0, 6, 6]);
    d[2] = bone(0, 2, { faceId: "FUSE_FACE", type: "modifier" });
    d[3] = bone(6, 3, { faceId: "BLOOD_6", type: "blood" });
    d[4] = bone(6, 4, { faceId: "BLOOD_6", type: "blood" });
    const r = g.api.GutterbonesRules.calculateScore("C", d, linkCtx(g, [{ id: "ENGINE" }]));
    const chainMultSteps = (r.explanationSteps || []).filter((s) => String(s.label).startsWith("CHAIN:"));
    const multSum = chainMultSteps
      .map((s) => Number(String(s.impact).match(/\+(\d+)x/)?.[1] || 0))
      .reduce((a, b) => a + b, 0);
    return { chain_mult_added: multSum, cap: 6, fuse_engine_link: r.chainLinks.length };
  })(),
};
console.log(JSON.stringify(report, null, 2));
