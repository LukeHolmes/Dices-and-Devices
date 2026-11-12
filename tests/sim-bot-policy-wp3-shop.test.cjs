"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const policySrc = fs.readFileSync(path.join(ROOT, "assets/sim-bot-policy.js"), "utf8");

function loadPolicy() {
  const sandbox = { globalThis: {}, module: { exports: {} } };
  vm.createContext(sandbox);
  vm.runInContext(policySrc, sandbox);
  return sandbox.globalThis.GutterbonesSimBotPolicy;
}

const P = loadPolicy();
const WP3 = P.WP3_SHOP_REVISION;

const baseCtx = {
  revision: WP3,
  gold: 40,
  debt: 0,
  round: 2,
  score: 0,
  target: 75,
  inventory: [],
  diceFaceIds: [null, null, null, null, null],
  refreshCost: 5,
  shopRefreshes: 0,
  selectedShopPathId: null,
  sinkEstimate: 4,
};

test("WP3 buy — acquires BOOKENDS within reserve", () => {
  const plan = P.planShopBuy({
    ...baseCtx,
    available: [{ id: "BOOKENDS", price: 18 }],
  });
  assert.equal(plan.action, "buy");
  assert.equal(plan.itemId, "BOOKENDS");
});

test("WP3 buy — skips when toll+refresh reserve exceeded", () => {
  const plan = P.planShopBuy({
    ...baseCtx,
    gold: 12,
    available: [{ id: "GHOST_FACE", price: 12, type: "face" }],
    sinkEstimate: 6,
    refreshCost: 5,
  });
  assert.equal(plan.action, "skip");
  assert.match(plan.reason, /budget|affordable/);
});

test("WP3 refresh — only when missing kit not in stock", () => {
  const ok = P.planShopRefresh({
    ...baseCtx,
    available: [{ id: "ENGINE", price: 20 }],
  });
  assert.equal(ok.action, "refresh");
  assert.match(ok.reason, /missing_kit/);
  const skip = P.planShopRefresh({
    ...baseCtx,
    available: [{ id: "GHOST_FACE", price: 8 }],
  });
  assert.equal(skip.action, "skip");
  assert.match(skip.reason, /already_listed/);
});

test("WP3 sell — never fences kit hardware", () => {
  const plan = P.planShopSell({ ...baseCtx, inventory: [{ id: "BOOKENDS" }] });
  assert.equal(plan.action, "skip");
  assert.match(plan.reason, /never_kit/);
});

test("WP3 pay debt — budgets reserve", () => {
  const pay = P.planShopPayDebt({ ...baseCtx, debt: 8, gold: 50 });
  assert.equal(pay.action, "pay_debt");
  const hold = P.planShopPayDebt({ ...baseCtx, debt: 8, gold: 14, sinkEstimate: 8, refreshCost: 5 });
  assert.equal(hold.action, "skip");
});

test("WP3 skip — hit streets when kit ready and route set", () => {
  const plan = P.planShopSkip({
    ...baseCtx,
    selectedShopPathId: "mod-alley",
    inventory: [{ id: "BOOKENDS" }],
    diceFaceIds: ["GHOST_FACE", null, null, null, "ECHO_FACE"],
    gold: 30,
    sinkEstimate: 2,
  });
  assert.equal(plan.action, "hit_streets");
  assert.match(plan.reason, /kit_complete/);
});

test("WP3 carve — targets missing Ghost on end slot", () => {
  const plan = P.planCarveAction({
    revision: WP3,
    inventory: [{ id: "BOOKENDS" }],
    diceFaceIds: [null, null, null, null, "ECHO_FACE"],
    carveOfferId: "GHOST_FACE",
  });
  assert.equal(plan.action, "carve");
  assert.equal(plan.faceId, "GHOST_FACE");
  assert.equal(plan.dieIdx, 0);
});

test("WP3 carve — wrong offer exits instead of done stall", () => {
  const plan = P.planCarveAction({
    revision: WP3,
    inventory: [{ id: "BOOKENDS" }],
    diceFaceIds: [null, null, null, null, null],
    carveOfferId: "BLOOD_6",
  });
  assert.equal(plan.action, "exit");
  assert.match(plan.reason, /wrong_offer/);
});

test("WP3 carve — faces complete exits to shop", () => {
  const plan = P.planCarveAction({
    revision: WP3,
    inventory: [{ id: "BOOKENDS" }],
    diceFaceIds: ["GHOST_FACE", null, null, null, "ECHO_FACE"],
    carveOfferId: "GHOST_FACE",
  });
  assert.equal(plan.action, "exit");
});

test("WP3 built on lane — play revision dispatches to lane family", () => {
  assert.equal(P.isLanePlayRevision(WP3), true);
  const preds = P.evaluateOrganicPredicates({
    inventory: [{ id: "BOOKENDS" }],
    dice: [
      { value: 2, faceId: "GHOST_FACE" },
      { value: 3 },
      { value: 4 },
      { value: 5 },
      { value: 2, faceId: "ECHO_FACE" },
    ],
  });
  assert.ok(preds.linkKitEligible);
});
