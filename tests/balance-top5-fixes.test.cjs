"use strict";
/** Top-5 balance fixes (Nov 2025): boss path, shop guarantees, combo meter, refresh discount, copy. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const { createGame, appSource, routesSource } = require("./helpers/game.cjs");
const { snapshot, dice } = require("./fixtures/runs.cjs");

const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");

function sliceAction(name, nextName) {
  const start = appSource.indexOf(`        const ${name} = `);
  const end = appSource.indexOf(`        const ${nextName} = `, start + 1);
  assert.ok(start >= 0 && end > start, `missing action slice ${name}`);
  return appSource.slice(start, end);
}

function loadRoutes() {
  const sandbox = {};
  vm.createContext(sandbox);
  new vm.Script(`${routesSource}\nglobalThis.routes = GutterbonesRoutes;`).runInContext(sandbox);
  return sandbox.routes;
}

function refreshCostHelpers() {
  const block = appSource.match(
    /const SHOP_AGENCY_TUNING = \{[\s\S]*?const getEffectiveShopRefreshCost = \(roundNum, refreshCount, shopRefreshDiscount = 0\) => Math\.max\([\s\S]*?\);/,
  );
  assert.ok(block, "shop refresh helper block");
  return block[0];
}

test("boss turf path uses mod 1 without inherited route perks", () => {
  assert.match(
    html,
    /next\[bossIdx\] = \{[\s\S]*?mod: 1[\s\S]*?\};/,
  );
  assert.doesNotMatch(html, /next\[bossIdx\] = \{ \.\.\.next\[bossIdx\]/);
  const routes = loadRoutes();
  const base = {
    round: 5,
    target: 280,
    debt: 0,
    insaneContract: false,
    hasLedger: false,
    personaPlays: 4,
    personaPills: 3,
  };
  const bouncer = { id: "BOUNCER", name: "THE BOUNCER", applyTarget: (t) => Math.floor(t * 1.5) };
  const inheritedVip = {
    id: "BOSS",
    mod: 1.4,
    reward: 15,
    fillStash: true,
    shopRefreshDiscount: 5,
    boss: bouncer,
  };
  const cleanBoss = { id: "BOSS", mod: 1, boss: bouncer };
  const high = routes.projectNextRound({ path: inheritedVip, ...base });
  const low = routes.projectNextRound({ path: cleanBoss, ...base });
  assert.ok(low.nextTarget < high.nextTarget, "boss path should not inherit VIP quota multiplier");
  assert.equal(cleanBoss.reward, undefined);
  assert.equal(cleanBoss.shopRefreshDiscount, undefined);
});

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function runShopHarness({ randomSeq, meta, offerTag = "balanced", round = 4, rngFactory }) {
  const g = createGame(snapshot({ round, gold: 40, stash: 20, phase: "SHOP" }));
  const routesCtx = vm.createContext({ Math });
  vm.runInContext(routesSource, routesCtx);
  let draw = 0;
  const seq = randomSeq;
  const rng = rngFactory
    ? rngFactory()
    : (() => {
        const v = seq[draw++ % seq.length];
        return v;
      });
  const captured = [];
  const source = `${sliceAction("generateShop", "refreshShop")}\nthis.run = () => generateShop();`;
  const sandbox = {
    Math,
    phase: "SHOP",
    round,
    gold: 40,
    stash: 20,
    debt: 0,
    dice: dice([1, 2, 3, 4, 5]),
    inventory: [],
    history: [],
    flowStreak: 0,
    meta,
    soldItems: [],
    runExclusiveShopIds: [],
    routeModifiers: {},
    nextShopTag: offerTag,
    nextShopTagRef: { current: offerTag },
    dailyRunActive: true,
    runRandomRef: { current: rng },
    shopAdvanceLockRef: { current: false },
    shopRewardGrantedRef: { current: null },
    SHOP_TUNING: { maxAffordableBuffer: 12, earlyDangerRoundGate: 5, priceScaleFromRound: 1.045 },
    PROGRESSION_GUARDRAILS: { dangerCapRound: 6, maxEarlyDangerOffers: 1 },
    EARLY_GAME_TUNING: { bossPathStartsRound: 4 },
    BUILD_IDS: { UNKNOWN: "UNKNOWN", CHAOS: "CHAOS" },
    FACE_DATABASE: g.api.FACE_DATABASE,
    DEVISES: g.api.DEVISES,
    CONSUMABLES: g.api.CONSUMABLES,
    BOSSES: g.api.BOSSES,
    PATHS: [
      { id: "LOCAL", name: "BACK ALLEY", mod: 1, color: "border-gray-600" },
      { id: "VIP", name: "VIP ROOM", mod: 1.4, fillStash: true, color: "border-pink-500" },
    ],
    GutterbonesReplay: {
      modifierShopOffers: () => [],
      filterPathsForMeta: (paths) => paths,
      EXTRA_PATHS: [],
    },
    GutterbonesRoutes: routesCtx.GutterbonesRoutes,
    GutterbonesRuleExperiments: undefined,
    paths: [{ id: "LOCAL" }],
    ECONOMY_TUNING: { shortageToDebtRatio: 0.82 },
    analyzeBuild: () => ({ primaryBuild: "UNKNOWN" }),
    getArchetypeTagsForItemId: (id) => (id === "ENGINE" ? ["MULT_ENGINE"] : []),
    itemFitsCurrentBuild: () => false,
    isShopFaceAvailable: () => true,
    shopListPrice: (item) => Math.max(1, Math.floor(Number(item?.cost) || 1)),
    balanceObserverActive: () => false,
    linkObserverActive: () => false,
    scheduleTimeout: (fn) => fn(),
    setShopItems: (items) => captured.push(...items.map((i) => i.id)),
    setShopRefreshes: () => {},
    setPaths: () => {},
    setSelectedShopPathId: () => {},
    setActiveShopTag: () => {},
    setRouteModifiers: () => {},
    setSoldItems: () => {},
    globalThis: null,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  sandbox.run();
  return captured;
}

test("early smelling salts rate stays near baseline after guarantee slots", () => {
  const g = createGame(snapshot());
  const meta = {
    unlockedFaceIds: Object.keys(g.api.FACE_DATABASE),
    unlockedHardwareIds: g.api.DEFAULT_META_STATE.unlockedHardwareIds,
  };
  let shops = 0;
  let salts = 0;
  for (let seed = 0; seed < 100; seed++) {
    const rng = mulberry32(seed);
    for (let round = 1; round <= 4; round++) {
      const offerTag = round >= 3 ? "hardware" : "balanced";
      const ids = runShopHarness({
        meta,
        round,
        offerTag,
        rngFactory: () => rng,
      });
      shops += 1;
      if (ids.includes("SMELLING_SALTS")) salts += 1;
    }
  }
  const pct = salts / shops;
  assert.ok(pct >= 0.89, `expected ≥89% smelling salts, got ${(pct * 100).toFixed(1)}%`);
});

test("shop guarantees occupy distinct slots and respect hardware unlocks", () => {
  const unlocked = createGame(snapshot()).api.DEFAULT_META_STATE.unlockedHardwareIds;
  const metaNoEngine = {
    unlockedFaceIds: Object.keys(createGame(snapshot()).api.FACE_DATABASE),
    unlockedHardwareIds: unlocked.filter((id) => id !== "ENGINE"),
  };
  const withoutEngine = runShopHarness({
    meta: metaNoEngine,
    round: 3,
    offerTag: "hardware",
    randomSeq: [0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.02, 0.02, 0.02, 0.02, 0.1],
  });
  assert.equal(withoutEngine.includes("ENGINE"), false, "Engine before Call the Fence");
  const metaFull = {
    unlockedFaceIds: Object.keys(createGame(snapshot()).api.FACE_DATABASE),
    unlockedHardwareIds: [...unlocked, "ENGINE"],
  };
  const offers = runShopHarness({
    meta: metaFull,
    round: 3,
    offerTag: "hardware",
    randomSeq: [0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.02, 0.02, 0.02, 0.02, 0.1],
  });
  assert.ok(offers.includes("LOADED_DIE"), "starter Loaded Die guarantee");
  assert.ok(offers.includes("SMELLING_SALTS"), "early smelling salts guarantee");
  assert.ok(
    offers.some((id) => createGame(snapshot()).api.DEVISES[id] && id !== "LOADED_DIE"),
    "hardware tag guarantee",
  );
});

test("category mark merge preserves comboMeter and heatSpikeNextHand", () => {
  assert.match(html, /categoryMarkEarned[\s\S]{0,120}\.\.\.prev/);
  const applyMark = (prev, catId) => ({
    ...prev,
    categoryMarks: {
      ...(prev.categoryMarks || {}),
      [catId]: (prev.categoryMarks?.[catId] || 0) + 1,
    },
  });
  const prev = { categoryMarks: {}, comboMeter: 2, heatSpikeNextHand: 0.25 };
  const next = applyMark(prev, "ONES");
  assert.equal(next.comboMeter, 2);
  assert.equal(next.heatSpikeNextHand, 0.25);
  assert.equal(next.categoryMarks.ONES, 1);
});

test("refreshShop charges discounted refresh cost", () => {
  const g = createGame(snapshot({ phase: "SHOP", round: 6, gold: 30, shopRefreshes: 0 }));
  const routesCtx = vm.createContext({ Math });
  vm.runInContext(routesSource, routesCtx);
  let rngCalls = 0;
  const rng = () => {
    rngCalls += 1;
    return 0.15;
  };
  const source = `${refreshCostHelpers()}\nglobalThis.getShopRefreshCost = getShopRefreshCost;\nglobalThis.getEffectiveShopRefreshCost = getEffectiveShopRefreshCost;\n${sliceAction("generateShop", "refreshShop")}\n${sliceAction("refreshShop", "sellInventoryItem")}\nthis.refresh = () => refreshShop();`;
  const sandbox = {
    Math,
    phase: "SHOP",
    round: 6,
    gold: 30,
    stash: 0,
    debt: 0,
    shopRefreshes: 0,
    currentRouteEffect: { shopRefreshDiscount: 5 },
    dice: dice([1, 2, 3, 4, 5]),
    inventory: [],
    history: [],
    flowStreak: 0,
    meta: {
      unlockedFaceIds: Object.keys(g.api.FACE_DATABASE),
      unlockedHardwareIds: Object.keys(g.api.DEVISES),
    },
    soldItems: [],
    runExclusiveShopIds: [],
    routeModifiers: {},
    nextShopTag: "balanced",
    nextShopTagRef: { current: "balanced" },
    dailyRunActive: true,
    runRandomRef: { current: rng },
    paths: [{ id: "LOCAL" }],
    GutterbonesRoutes: routesCtx.GutterbonesRoutes,
    GutterbonesReplay: { modifierShopOffers: () => [], filterPathsForMeta: (x) => x, EXTRA_PATHS: [] },
    FACE_DATABASE: g.api.FACE_DATABASE,
    DEVISES: g.api.DEVISES,
    CONSUMABLES: g.api.CONSUMABLES,
    BOSSES: g.api.BOSSES,
    PATHS: [{ id: "LOCAL", mod: 1 }],
    SHOP_TUNING: { maxAffordableBuffer: 12, earlyDangerRoundGate: 5, priceScaleFromRound: 1.045 },
    PROGRESSION_GUARDRAILS: { dangerCapRound: 6, maxEarlyDangerOffers: 1 },
    EARLY_GAME_TUNING: { bossPathStartsRound: 4 },
    BUILD_IDS: { UNKNOWN: "UNKNOWN", CHAOS: "CHAOS" },
    ECONOMY_TUNING: { shortageToDebtRatio: 0.82 },
    analyzeBuild: () => ({ primaryBuild: "UNKNOWN" }),
    getArchetypeTagsForItemId: () => [],
    itemFitsCurrentBuild: () => false,
    isShopFaceAvailable: () => true,
    shopListPrice: (item) => Math.max(1, Math.floor(Number(item?.cost) || 1)),
    syncShopRouteSelectionAfterStockRoll: () => {},
    shopAdvanceLockRef: { current: false },
    shopRewardGrantedRef: { current: null },
    balanceObserverActive: () => false,
    linkObserverActive: () => false,
    setGold: (fn) => {
      sandbox.gold = typeof fn === "function" ? fn(sandbox.gold) : fn;
    },
    setShopRefreshes: (fn) => {
      sandbox.shopRefreshes = typeof fn === "function" ? fn(sandbox.shopRefreshes) : fn;
    },
    setSoldItems: () => {},
    setShopItems: () => {},
    setPaths: () => {},
    setSelectedShopPathId: () => {},
    setActiveShopTag: () => {},
    setRouteModifiers: () => {},
    scheduleTimeout: (fn) => fn(),
    spawnPaperStamp: () => {},
    AudioSystem: { playTone: () => {} },
    globalThis: null,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  const baseCost = sandbox.getShopRefreshCost(6, 0);
  const displayCost = sandbox.getEffectiveShopRefreshCost(6, 0, 5);
  assert.equal(displayCost, baseCost - 5);
  sandbox.refresh();
  assert.equal(sandbox.gold, 30 - displayCost);
});

test("category tooltips match calculateScore on canonical dice", () => {
  const g = createGame(snapshot());
  const cases = [
    ["ONES", [1, 1, 1, 2, 3], 4],
    ["FOURS", [4, 4, 4, 2, 3], 24],
    ["C", [1, 2, 3, 4, 5], 24],
    ["SIXES", [6, 6, 6, 6, 6], 60],
    ["TOK", [2, 2, 2, 4, 5], 40],
  ];
  for (const [cat, values, total] of cases) {
    assert.equal(g.api.calculateScore(cat, dice(values)).total, total);
  }
  assert.match(html, /five 6s ≈ 60–75 heat/);
  assert.match(html, /\+20 chips on Triad when synergy chains are on/);
  assert.match(html, /payouts run at ~55%/);
});