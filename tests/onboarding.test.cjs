"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { onboardingSource } = require("./helpers/game.cjs");

function loadOnboarding() {
  const sandbox = {};
  vm.createContext(sandbox);
  new vm.Script(onboardingSource + "\nglobalThis.ob = GutterbonesOnboarding;").runInContext(
    sandbox,
  );
  return sandbox.ob;
}

test("Onboarding thresholds gate category ids by total runs", () => {
  const ob = loadOnboarding();
  const run0 = ob.getAvailableCategoryIds(0);
  assert.equal(run0.length, 9);
  assert.ok(!run0.includes("FOK"));
  assert.ok(run0.includes("TOK"));
  const run1 = ob.getAvailableCategoryIds(1);
  assert.equal(run1.length, run0.length);
  assert.equal(JSON.stringify(run1), JSON.stringify(run0));
  assert.ok(ob.getAvailableCategoryIds(2).includes("FOK"));
  assert.ok(!ob.getAvailableCategoryIds(0).includes("FOK"));
  assert.equal(ob.getAvailableCategoryIds(5), null);
});

test("Category unlock info lists locked rows and next threshold", () => {
  const ob = loadOnboarding();
  const all = [
    "ONES",
    "TWOS",
    "THREES",
    "FOURS",
    "FIVES",
    "SIXES",
    "TOK",
    "FOK",
    "FH",
    "C",
    "SS",
    "LS",
    "Y",
  ];
  const at0 = ob.getCategoryUnlockInfo(0, all);
  assert.equal(at0.nextThreshold, 2);
  assert.equal(at0.runsUntilNext, 2);
  assert.ok(at0.locked.includes("FOK"));
  const fok = at0.lockedDetails.find((d) => d.id === "FOK");
  assert.equal(fok.unlockAtRun, 2);
  assert.equal(fok.runsUntil, 2);

  const at2 = ob.getCategoryUnlockInfo(2, all);
  assert.equal(at2.nextThreshold, 5);
  assert.ok(at2.available.includes("FOK"));
  assert.ok(at2.locked.some((id) => ["SS", "LS", "Y"].includes(id)));

  const at5 = ob.getCategoryUnlockInfo(5, all);
  assert.equal(at5.nextThreshold, null);
  assert.equal(at5.runsUntilNext, 0);
  assert.deepEqual(at5.locked, []);
});

test("unlockRunForCategory returns run index for gated rows", () => {
  const ob = loadOnboarding();
  assert.equal(ob.unlockRunForCategory("FOK"), 2);
  assert.equal(ob.unlockRunForCategory("SS"), 5);
  assert.equal(ob.unlockRunForCategory("ONES"), 0);
});

test("Tier 2 shop faces require run count and Chain manual unlock", () => {
  const ob = loadOnboarding();
  const fuse = { id: "FUSE_FACE", rarity: "rare" };
  const metaLocked = { totalRuns: 5, unlockedFaceIds: ["MULT_FACE"] };
  const metaOpen = {
    totalRuns: 5,
    unlockedFaceIds: ["MULT_FACE", ...ob.TIER2_FACE_IDS],
  };
  assert.equal(ob.isShopFaceAvailable(fuse, { totalRuns: 4, unlockedFaceIds: ob.TIER2_FACE_IDS }), false);
  assert.equal(ob.isShopFaceAvailable(fuse, metaLocked), false);
  assert.equal(ob.isShopFaceAvailable(fuse, metaOpen), true);
});
