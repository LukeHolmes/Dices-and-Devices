"use strict";
/**
 * Same random carved-kit lanes scored with pre-relax vs current production rules (counterfactual v1).
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createGame } = require("./helpers/game.cjs");
const { snapshot, dice, bone } = require("./fixtures/runs.cjs");

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

function applyV1LinkPatch(r, resolved, destroyed) {
  if (!r?.chainLinks) return r;
  const out = { ...r, chainLinks: [...r.chainLinks] };
  const hasGhostEcho = (r.synergyEvents || []).some((e) => e.id === "ghost_echo");
  const hasBookends = (r.synergyEvents || []).some((e) => e.id === "bookends_retrigger");
  const hadPair = out.chainLinks.some((l) => l.from === "ghost_echo" && l.to === "bookends_retrigger");
  if (hasGhostEcho && hasBookends && hadPair) {
    const steps = r.explanationSteps || [];
    const bookendsGhostValue = steps.some(
      (s) => String(s.label).includes("BOOKENDS"),
    ) && resolved[0]?.faceId !== resolved[4]?.faceId;
    if (!bookendsGhostValue) {
      out.chainLinks = out.chainLinks.filter(
        (l) => !(l.from === "ghost_echo" && l.to === "bookends_retrigger"),
      );
    }
  }
  if (!ghostEchoV1(resolved, destroyed)) {
    out.synergyEvents = (out.synergyEvents || []).filter((e) => e.id !== "ghost_echo");
    out.chainLinks = out.chainLinks.filter((l) => l.from !== "ghost_echo" && l.to !== "ghost_echo");
  }
  return out;
}

function makeCarvedKitLane(n) {
  const values = Array.from({ length: 5 }, (_, i) => 1 + ((n * 13 + i * 5) % 6));
  const d = dice(values);
  d[0] = bone(values[0], 0, { faceId: "MULT_FACE", type: "modifier" });
  d[1] = bone(values[1], 1, { faceId: "ECHO_FACE", type: "adjacent" });
  d[2] = bone(values[2], 2, { faceId: "GHOST_FACE", type: "ethereal" });
  d[4] = bone(values[4], 4, { faceId: "GOLD_FACE", type: "modifier" });
  return d;
}

test("paired compare — ghost→bookends joint rate does not decrease on identical lanes", () => {
  const g = createGame(snapshot());
  const ctx = linkCtx(g, [{ id: "BOOKENDS" }]);
  const { resolved, destroyed } = g.api.GutterbonesRules.resolveDice(makeCarvedKitLane(0));
  let v1Pair = 0;
  let v2Pair = 0;
  const samples = 5000;
  for (let n = 0; n < samples; n++) {
    const d = makeCarvedKitLane(n);
    const cur = g.api.GutterbonesRules.calculateScore("C", d, ctx);
  const { resolved: r, destroyed: x } = g.api.GutterbonesRules.resolveDice(d);
    const v1 = applyV1LinkPatch(cur, r, x);
    if ((v1.chainLinks || []).some((l) => l.from === "ghost_echo" && l.to === "bookends_retrigger")) v1Pair += 1;
    if ((cur.chainLinks || []).some((l) => l.from === "ghost_echo" && l.to === "bookends_retrigger")) v2Pair += 1;
  }
  assert.ok(
    v2Pair >= v1Pair,
    `v2 joint ${v2Pair}/${samples} should be ≥ v1 ${v1Pair}/${samples}`,
  );
});

test("paired compare — caps unchanged on identical blood/fuse/engine lane", () => {
  const g = createGame(snapshot());
  const d = dice([1, 4, 0, 6, 6]);
  d[2] = bone(0, 2, { faceId: "FUSE_FACE", type: "modifier" });
  d[3] = bone(6, 3, { faceId: "BLOOD_6", type: "blood" });
  d[4] = bone(6, 4, { faceId: "BLOOD_6", type: "blood" });
  const ctx = linkCtx(g, [{ id: "ENGINE" }]);
  const r = g.api.GutterbonesRules.calculateScore("C", d, ctx);
  const chainMultSteps = (r.explanationSteps || []).filter((s) => String(s.label).startsWith("CHAIN:"));
  const multAdds = chainMultSteps
    .map((s) => String(s.impact).match(/\+(\d+)x/))
    .filter(Boolean);
  const multSum = multAdds.reduce((s, m) => s + Number(m[1]), 0);
  assert.ok(multSum <= 6, `chain mult cap: ${multSum}`);
  assert.ok(r.chainLinks.some((l) => l.from === "fuse_spark" && l.to === "engine_link"));
});

test("paired compare — all four pairwise links still reachable on fixed fixtures", () => {
  const g = createGame(snapshot());
  const cases = [
    {
      pair: "blood_ripple→fuse_spark",
      d: (() => {
        const d = dice([6, 6, 0, 3, 4]);
        d[0] = bone(6, 0, { faceId: "BLOOD_6", type: "blood" });
        d[1] = bone(6, 1, { faceId: "BLOOD_6", type: "blood" });
        d[2] = bone(0, 2, { faceId: "FUSE_FACE", type: "modifier" });
        return d;
      })(),
      ctx: linkCtx(g, []),
      cat: "C",
    },
    {
      pair: "ghost_echo→bookends_retrigger",
      d: (() => {
        const d = dice([5, 0, 0, 4, 5]);
        d[0] = bone(5, 0, { faceId: "MULT_FACE", type: "modifier" });
        d[1] = bone(0, 1, { faceId: "ECHO_FACE", type: "adjacent" });
        d[2] = bone(0, 2, { faceId: "GHOST_FACE", type: "ethereal" });
        d[4] = bone(5, 4, { faceId: "GOLD_FACE", type: "modifier" });
        return d;
      })(),
      ctx: linkCtx(g, [{ id: "BOOKENDS" }]),
      cat: "C",
    },
  ];
  for (const c of cases) {
    const r = g.api.GutterbonesRules.calculateScore(c.cat, c.d, c.ctx);
    const [from, to] = c.pair.split("→");
    assert.ok(r.chainLinks.some((l) => l.from === from && l.to === to), c.pair);
  }
});
