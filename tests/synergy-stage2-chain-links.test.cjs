"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createGame } = require("./helpers/game.cjs");
const { snapshot, dice, bone } = require("./fixtures/runs.cjs");

function linkContext(g, overrides = {}) {
  return {
    handLevels: {},
    flowStreak: 0,
    inventory: [],
    hardwareDisabled: false,
    activeBoss: null,
    CATEGORIES: g.api.CATEGORIES,
    HAND_MASTERY_TUNING: { baseLevel: 1, maxLevel: 8, chipPerLevel: 5 },
    getFlowMultiplier: g.api.getFlowMultiplier,
    getHandMasteryBonus: g.api.getHandMasteryBonus,
    synergyTuning: { enabled: true, chainLinkingEnabled: true, maxChainPasses: 8 },
    ...overrides,
  };
}

test("link: blood ripple charges slots → fuse spark via charged neighbor", () => {
  const g = createGame(snapshot());
  const d = dice([6, 6, 0, 3, 4]);
  d[0] = bone(6, 0, { faceId: "BLOOD_6", type: "blood" });
  d[1] = bone(6, 1, { faceId: "BLOOD_6", type: "blood" });
  d[2] = bone(0, 2, { faceId: "FUSE_FACE", type: "modifier" });
  const off = g.api.GutterbonesRules.calculateScore(
    "C",
    d,
    linkContext(g, { synergyTuning: { enabled: true, chainLinkingEnabled: false, maxChainPasses: 8 } }),
  );
  const on = g.api.GutterbonesRules.calculateScore("C", d, linkContext(g));
  assert.equal(off.synergyEvents.some((e) => e.id === "fuse_spark"), false);
  assert.ok(on.synergyEvents.some((e) => e.id === "blood_ripple"));
  assert.ok(on.synergyEvents.some((e) => e.id === "fuse_spark"));
  assert.ok(on.chainLinks.some((l) => l.from === "blood_ripple" && l.to === "fuse_spark"));
});

test("link: sparked slots count toward engine link (fuse_spark → engine_link)", () => {
  const g = createGame(snapshot());
  const d = dice([1, 4, 0, 6, 6]);
  d[2] = bone(0, 2, { faceId: "FUSE_FACE", type: "modifier" });
  d[3] = bone(6, 3, { faceId: "BLOOD_6", type: "blood" });
  d[4] = bone(6, 4, { faceId: "BLOOD_6", type: "blood" });
  const rOff = g.api.GutterbonesRules.calculateScore(
    "C",
    d,
    linkContext(g, {
      synergyTuning: { enabled: true, chainLinkingEnabled: false, maxChainPasses: 8 },
      inventory: [{ id: "ENGINE" }],
    }),
  );
  const rOn = g.api.GutterbonesRules.calculateScore(
    "C",
    d,
    linkContext(g, { inventory: [{ id: "ENGINE" }] }),
  );
  assert.ok(rOn.synergyEvents.some((e) => e.id === "fuse_spark"));
  assert.ok(rOn.synergyEvents.some((e) => e.id === "engine_link"));
  assert.ok(rOn.chainLinks.some((l) => l.from === "fuse_spark" && l.to === "engine_link"));
  assert.ok(rOn.total >= rOff.total);
});

test("link: ghost echo enables bookends value-only match", () => {
  const g = createGame(snapshot());
  const d = dice([5, 0, 0, 4, 5]);
  d[0] = bone(5, 0, { faceId: "MULT_FACE", type: "modifier" });
  d[1] = bone(0, 1, { faceId: "ECHO_FACE", type: "adjacent" });
  d[2] = bone(0, 2, { faceId: "GHOST_FACE", type: "ethereal" });
  d[4] = bone(5, 4, { faceId: "GOLD_FACE", type: "modifier" });
  const off = g.api.GutterbonesRules.calculateScore(
    "C",
    d,
    linkContext(g, { synergyTuning: { enabled: true, chainLinkingEnabled: false, maxChainPasses: 8 } }),
  );
  const on = g.api.GutterbonesRules.calculateScore(
    "C",
    d,
    linkContext(g, { inventory: [{ id: "BOOKENDS" }] }),
  );
  assert.equal(off.synergyEvents.some((e) => e.id === "bookends_retrigger"), false);
  assert.ok(on.synergyEvents.some((e) => e.id === "ghost_echo"));
  assert.ok(on.synergyEvents.some((e) => e.id === "bookends_retrigger"));
  assert.ok(on.chainLinks.some((l) => l.from === "ghost_echo" && l.to === "bookends_retrigger"));
});

test("link: wire feed dirty hand → crowbar cascade +5 chips", () => {
  const g = createGame(snapshot());
  const d = dice([6, 0, 0, 0, 6]);
  d[0] = bone(6, 0, { faceId: "BLOOD_6", type: "blood" });
  d[1] = bone(0, 1, { faceId: "GOLD_FACE", type: "modifier" });
  d[2] = bone(0, 2, { faceId: "WIREBAG_FACE", type: "parasite" });
  d[3] = bone(0, 3, { faceId: "SHIV_FACE", type: "destructive" });
  d[4] = bone(6, 4, { faceId: "BLOOD_6", type: "blood" });
  const rOff = g.api.GutterbonesRules.calculateScore(
    "C",
    d,
    linkContext(g, {
      synergyTuning: { enabled: true, chainLinkingEnabled: false, maxChainPasses: 8 },
      inventory: [{ id: "CROWBAR" }],
    }),
  );
  const rOn = g.api.GutterbonesRules.calculateScore(
    "C",
    d,
    linkContext(g, { inventory: [{ id: "CROWBAR" }] }),
  );
  const offCascade = rOff.synergyEvents.find((e) => e.id === "crowbar_cascade");
  const onCascade = rOn.synergyEvents.find((e) => e.id === "crowbar_cascade");
  assert.ok(rOn.synergyEvents.some((e) => e.id === "wire_feed"));
  assert.ok(onCascade);
  assert.ok(offCascade);
  const offChips = parseInt(String(offCascade.impact).replace(/[^\d]/g, ""), 10);
  const onChips = parseInt(String(onCascade.impact).replace(/[^\d]/g, ""), 10);
  assert.equal(onChips, offChips + 5);
  assert.ok(rOn.chainLinks.some((l) => l.from === "wire_feed" && l.to === "crowbar_cascade"));
});
