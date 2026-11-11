"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const { createGame, appSource, routesSource } = require("./helpers/game.cjs");
const { snapshot, dice, bone } = require("./fixtures/runs.cjs");
const {
  createBalanceObserver,
  GutterbonesBalanceObserver,
  ruleShaFromRepo,
  observerSource,
} = require("./helpers/balance-observer.cjs");

const ROOT = path.join(__dirname, "..");

function sliceAction(name, nextName) {
  const start = appSource.indexOf(`        const ${name} = `);
  const end = appSource.indexOf(`        const ${nextName} = `, start + 1);
  assert.ok(start >= 0 && end > start, `missing action slice ${name}`);
  return appSource.slice(start, end);
}

function rulesBlockAtRef(ref) {
  const html = execFileSync("git", ["show", `${ref}:index.html`], {
    encoding: "utf8",
    cwd: ROOT,
  });
  const open = '<script id="gutterbones-rules">';
  const start = html.indexOf(open) + open.length;
  const end = html.indexOf("</script>", start);
  return html.slice(start, end);
}

function runGenerateShopHarness({ observerEnabled, random }) {
  const g = createGame(snapshot({ round: 2, gold: 22, stash: 25, phase: "SHOP" }));
  const observer = createBalanceObserver({ enabled: observerEnabled, repoRoot: ROOT });
  const routesCtx = vm.createContext({ Math });
  vm.runInContext(routesSource, routesCtx);

  const seq = random.seq;
  let draw = 0;
  let rngCalls = 0;
  const rng = () => {
    rngCalls += 1;
    const v = seq[(draw++) % seq.length];
    return v;
  };

  const capturedOffers = [];
  const source = `
${sliceAction("generateShop", "refreshShop")}
${sliceAction("shopListPrice", "forfeitRun")}
this.run = () => generateShop();
`;

  const sandbox = {
  Math,
  phase: "SHOP",
  round: 2,
  gold: 22,
  stash: 25,
  debt: 0,
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
  PATHS: [{ id: "LOCAL" }],
  GutterbonesReplay: {
    modifierShopOffers: () => [],
    filterPathsForMeta: (paths) => paths,
    EXTRA_PATHS: [],
  },
  GutterbonesRoutes: routesCtx.GutterbonesRoutes,
  paths: [{ id: "LOCAL" }],
  ECONOMY_TUNING: { shortageToDebtRatio: 0.82 },
  analyzeBuild: () => ({ primaryBuild: "UNKNOWN", confidence: 0 }),
  getArchetypeTagsForItemId: () => [],
  itemFitsCurrentBuild: () => false,
  isShopFaceAvailable: () => true,
  scheduleTimeout: (fn) => fn(),
  setShopItems: (items) => {
    capturedOffers.push(...items.map((i) => i.id));
  },
  setShopRefreshes: () => {},
  setPaths: () => {},
  setSelectedShopPathId: () => {},
  setActiveShopTag: () => {},
  setRouteModifiers: () => {},
  setSoldItems: () => {},
  window: { __GB_BALANCE_OBSERVER__: observer },
  };
  sandbox.globalThis = sandbox;
  sandbox.__GB_BALANCE_OBSERVER__ = observer;

  vm.createContext(sandbox);
  vm.runInContext(observerSource, sandbox);
  vm.runInContext(source, sandbox);
  sandbox.run();

  return {
    rngCalls,
    offers: [...capturedOffers],
    events: observer.ledger.events.length,
    offerEvents: observer.ledger.events.filter((e) => e.type === "offer").length,
    fingerprint: observer.fingerprint(),
  };
}

test("live generateShop path records immutable offer ledger entries", () => {
  const random = { seq: [0.05, 0.1, 0.2, 0.3, 0.4, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75] };
  const out = runGenerateShopHarness({ observerEnabled: true, random });
  assert.ok(out.offers.length === 4, "expected four shop offers");
  assert.ok(out.offerEvents >= 4, "expected offer ledger events");
  assert.ok(out.events >= 4);
});

test("live handlePurchase records action with cash vs loan reason", () => {
  const g = createGame(snapshot({ phase: "SHOP", round: 2, gold: 5, debt: 0 }));
  const observer = createBalanceObserver({ enabled: true, repoRoot: ROOT });
  const item = { id: "BOOKENDS", name: "Bookends", cost: 18, rarity: "rare" };
  const source = `
${sliceAction("shopListPrice", "forfeitRun")}
${sliceAction("handlePurchase", "executeCarve")}
this.buy = (item) => handlePurchase(item);
`;
  const sandbox = {
    Math,
    phase: "SHOP",
    round: 2,
    gold: 5,
    debt: 0,
    inventory: [],
    soldItems: [],
    runExclusiveShopIds: [],
    RUN_EXCLUSIVE_SHOP_IDS: new Set(),
    selectedItem: null,
    routeModifiers: {},
    paths: [{ id: "LOCAL" }],
    SHOP_TUNING: { priceScaleFromRound: 1.045 },
    ECONOMY_TUNING: { shortageToDebtRatio: 0.82 },
    item,
    setSoldItems: (fn) => { sandbox.soldItems = typeof fn === "function" ? fn(sandbox.soldItems) : fn; },
    setGold: (fn) => { sandbox.gold = typeof fn === "function" ? fn(sandbox.gold) : fn; },
    setDebt: () => {},
    setFixerLine: () => {},
    setInventory: () => {},
    setShopItems: () => {},
    setRunModifierIds: () => {},
    setPillRunBonus: () => {},
    setPillCountTick: () => {},
    setRunExclusiveShopIds: () => {},
    setConsumables: () => {},
    setSelectedItem: () => {},
    setCarvingDie: () => {},
    transitionToPhase: () => {},
    registerDebtSpike: (shortage) => Math.max(1, Math.ceil(shortage * 0.82)),
    AudioSystem: { playTone: () => {} },
    spawnPaperStamp: () => {},
    GutterbonesBalanceObserver: null,
    window: { __GB_BALANCE_OBSERVER__: observer },
    globalThis: null,
    __GB_BALANCE_OBSERVER__: observer,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(observerSource, sandbox);
  vm.runInContext(source, sandbox);
  sandbox.buy(item);
  const action = observer.ledger.events.find((e) => e.type === "action");
  assert.ok(action);
  assert.equal(action.action.kind, "purchase");
  assert.equal(action.action.reason.status, "ok");
  assert.equal(action.action.reason.value, "loan");
  assert.equal(action.action.after.inventoryIds.status, "ok");
  assert.ok(action.action.after.inventoryIds.value.includes("BOOKENDS"));
});

test("live refreshShop records rejections and successful refresh without extra RNG", () => {
  const g = createGame(snapshot({ phase: "SHOP", round: 2, gold: 3, shopRefreshes: 0 }));
  const observer = createBalanceObserver({ enabled: true, repoRoot: ROOT });
  const routesCtx = vm.createContext({ Math });
  vm.runInContext(routesSource, routesCtx);
  let rngCalls = 0;
  const rng = () => { rngCalls += 1; return 0.2; };
  const refreshCostBlock = appSource.match(
    /const SHOP_AGENCY_TUNING = \{[\s\S]*?\};\s*const getShopRefreshCost = \(roundNum, refreshCount\) => Math\.max\([\s\S]*?\);/,
  );
  assert.ok(refreshCostBlock, "getShopRefreshCost block in index.html");
  const source = `
${refreshCostBlock[0]}
${sliceAction("generateShop", "refreshShop")}
${sliceAction("shopListPrice", "forfeitRun")}
${sliceAction("refreshShop", "sellInventoryItem")}
this.doRefresh = () => refreshShop();
`;
  const sandbox = {
    Math,
    phase: "SHOP",
    round: 2,
    gold: 3,
    stash: 0,
    debt: 0,
    shopRefreshes: 0,
    dice: dice([1, 2, 3, 4, 5]),
    inventory: [],
    history: [],
    flowStreak: 0,
    meta: { unlockedFaceIds: Object.keys(g.api.FACE_DATABASE), unlockedHardwareIds: Object.keys(g.api.DEVISES) },
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
    PATHS: [{ id: "LOCAL" }],
    SHOP_TUNING: { maxAffordableBuffer: 12, earlyDangerRoundGate: 5, priceScaleFromRound: 1.045 },
    PROGRESSION_GUARDRAILS: { dangerCapRound: 6, maxEarlyDangerOffers: 1 },
    EARLY_GAME_TUNING: { bossPathStartsRound: 4 },
    BUILD_IDS: { UNKNOWN: "UNKNOWN", CHAOS: "CHAOS" },
    ECONOMY_TUNING: { shortageToDebtRatio: 0.82 },
    analyzeBuild: () => ({ primaryBuild: "UNKNOWN" }),
    getArchetypeTagsForItemId: () => [],
    itemFitsCurrentBuild: () => false,
    isShopFaceAvailable: () => true,
    syncShopRouteSelectionAfterStockRoll: () => {},
    shopAdvanceLockRef: { current: false },
    shopRewardGrantedRef: { current: null },
    setGold: (fn) => { sandbox.gold = typeof fn === "function" ? fn(sandbox.gold) : fn; },
    setShopRefreshes: (fn) => { sandbox.shopRefreshes = typeof fn === "function" ? fn(sandbox.shopRefreshes) : fn; },
    setSoldItems: () => {},
    setShopItems: () => {},
    setPaths: () => {},
    setSelectedShopPathId: () => {},
    setActiveShopTag: () => {},
    setRouteModifiers: () => {},
    scheduleTimeout: (fn) => fn(),
    spawnPaperStamp: () => {},
    AudioSystem: { playTone: () => {} },
    window: { __GB_BALANCE_OBSERVER__: observer },
    __GB_BALANCE_OBSERVER__: observer,
    globalThis: null,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(observerSource, sandbox);
  vm.runInContext(source, sandbox);
  const callsBeforeReject = rngCalls;
  sandbox.doRefresh();
  const reject = observer.ledger.events.find((e) => e.type === "action" && e.action.kind === "shop_refresh");
  assert.ok(reject);
  assert.equal(reject.action.reason.value, "rejected_insufficient_gold");
  assert.equal(rngCalls, callsBeforeReject, "rejected refresh must not consume shop RNG");
  sandbox.gold = 50;
  sandbox.doRefresh();
  const ok = observer.ledger.events.filter((e) => e.type === "action" && e.action.kind === "shop_refresh").at(-1);
  assert.equal(ok.action.reason.value, "executed");
});

test("live handleProgram records informant rejection", () => {
  const observer = createBalanceObserver({ enabled: true, repoRoot: ROOT });
  const source = `${sliceAction("handleProgram", "useConsumable")}\nthis.run=(p)=>handleProgram(p);`;
  const p = { id: "BRIBE", name: "BRIBE", cost: 60 };
  const sandbox = {
    Math,
    hasRolled: true,
    rolling: false,
    stash: 100,
    target: 200,
    debt: 0,
    phase: "PLAY",
    round: 3,
    dice: dice([1, 2, 3, 4, 5]),
    kept: [false, false, false, false, false],
    activeBoss: { id: "INFORMANT" },
    showMechanicPopup: () => {},
    setStash: () => {},
    setTarget: () => {},
    setDebt: () => {},
    setActiveMechanicPopup: () => {},
    setShowMobileStash: () => {},
    rerollBoneSlot: () => {},
    setDice: () => {},
    window: { __GB_BALANCE_OBSERVER__: observer },
    __GB_BALANCE_OBSERVER__: observer,
    globalThis: null,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(observerSource, sandbox);
  vm.runInContext(source, sandbox);
  sandbox.run(p);
  const action = observer.ledger.events.find((e) => e.type === "action");
  assert.equal(action.action.reason.value, "rejected_informant");
});

test("setTerminalOnce dedupes second terminal", () => {
  const o = createBalanceObserver({ enabled: true, repoRoot: ROOT });
  assert.equal(o.setTerminalOnce({ reason: "quota_loss", round: 2 }), true);
  assert.equal(o.setTerminalOnce({ reason: "victory", round: 10 }), false);
  const terminals = o.ledger.events.filter((e) => e.type === "terminal");
  assert.equal(terminals.length, 1);
  assert.equal(terminals[0].terminal.reason, "quota_loss");
});

test("scoringLaneForObserver uses prepScoringDice (mirror rig)", () => {
  const g = createGame(snapshot());
  const lane = dice([1, 2, 3, 4, 5]);
  const rules = g.api.GutterbonesRules;
  const plain = rules.resolveDice(lane);
  const prep = GutterbonesBalanceObserver.scoringLaneForObserver(
    rules,
    lane,
    [{ id: "MIRROR_RIG" }],
    false,
  );
  assert.ok(prep.missing === null);
  assert.notDeepEqual(
    GutterbonesBalanceObserver.snapshotResolvedLane(plain.resolved, plain.destroyed),
    GutterbonesBalanceObserver.snapshotResolvedLane(prep.resolved, prep.destroyed),
  );
});

test("observer on/off preserves generateShop RNG draws and offer ids", () => {
  const random = { seq: [0.02, 0.11, 0.21, 0.31, 0.41, 0.12, 0.22, 0.32, 0.42, 0.52, 0.62, 0.72] };
  const off = runGenerateShopHarness({ observerEnabled: false, random });
  const on = runGenerateShopHarness({ observerEnabled: true, random });
  assert.deepEqual(off.offers, on.offers);
  assert.equal(off.rngCalls, on.rngCalls);
  assert.equal(off.rngCalls > 0, true);
  assert.equal(on.offerEvents, 4);
});

test("raw lane snapshot differs from resolveDice output on echo lane", () => {
  const g = createGame(snapshot());
  const lane = dice([0, 3, 4, 5, 6]);
  lane[0] = bone(0, 0, { faceId: "GHOST_FACE", type: "ethereal" });
  lane[1] = bone(3, 1, { faceId: "ECHO_FACE", type: "adjacent" });
  const raw = GutterbonesBalanceObserver.snapshotRawLane(lane);
  const { resolved, destroyed } = g.api.GutterbonesRules.resolveDice(lane);
  const resolvedSnap = GutterbonesBalanceObserver.snapshotResolvedLane(resolved, destroyed);
  assert.equal(raw[1].value, 3);
  assert.equal(resolvedSnap[1].value, 0, "echo copies left ghost value onto lane");
  assert.notDeepEqual(raw, resolvedSnap.map(({ destroyed: _d, isEchoed, isMagnetCopied, ...r }) => r));
});

test("semantic fingerprint is time-invariant for identical events", () => {
  const build = () => {
    const o = createBalanceObserver({ enabled: true, repoRoot: ROOT });
    o.recordAction({
      kind: "test",
      reason: { status: "ok", value: "synthetic" },
      before: { gold: 10 },
      after: { gold: { status: "ok", value: 8 } },
    });
    return o.fingerprint();
  };
  const a = build();
  const b = build();
  assert.equal(a, b);
  const o = createBalanceObserver({ enabled: true, repoRoot: ROOT });
  o.recordAction({
    kind: "test",
    reason: { status: "ok", value: "synthetic" },
    before: { gold: 10 },
    after: { gold: { status: "ok", value: 9 } },
  });
  assert.notEqual(a, o.fingerprint());
});

test("aa7d44b rules lack cap metadata; current rules preserve outcome digests", () => {
  const baseline = require("./fixtures/balance-scoring-baseline-aa7d44b.cjs");
  const g = createGame(snapshot());
  const ctx = {
    handLevels: {},
    flowStreak: 0,
    debt: 0,
    inventory: [],
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
  const chainLane = dice([6, 6, 0, 6, 6]);
  chainLane[0] = bone(6, 0, { faceId: "BLOOD_6", type: "blood" });
  chainLane[1] = bone(6, 1, { faceId: "BLOOD_6", type: "blood" });
  chainLane[2] = bone(0, 2, { faceId: "FUSE_FACE", type: "modifier" });
  chainLane[3] = bone(6, 3, { faceId: "BLOOD_6", type: "blood" });
  chainLane[4] = bone(6, 4, { faceId: "BLOOD_6", type: "blood" });

  const current = {
    debt: g.api.GutterbonesRules.calculateScore(
      "C",
      dice([2, 3, 4, 5, 6]),
      { ...ctx, debt: 20, inventory: [{ id: "DEBT_COLLECTOR" }] },
    ),
    chain: g.api.GutterbonesRules.calculateScore("C", chainLane, {
      ...ctx,
      inventory: [{ id: "ENGINE" }, { id: "FUSE_BOX" }],
    }),
    y: g.api.GutterbonesRules.calculateScore("Y", dice([6, 6, 6, 6, 6]), ctx),
  };

  const pick = (r) => ({
    valid: r.valid,
    chips: r.chips,
    mult: r.mult,
    total: r.total,
    chainDepth: r.chainDepth ?? 0,
  });
  assert.deepEqual(pick(current.debt), baseline.fixtures.debtCollectorCap);
  assert.deepEqual(pick(current.chain), baseline.fixtures.chainMultCap);
  assert.deepEqual(pick(current.y), baseline.fixtures.jackpot);

  const legacyCtx = vm.createContext({ Math });
  vm.runInContext(`${rulesBlockAtRef(baseline.ref)}\nthis.R=GutterbonesRules;`, legacyCtx);
  const legacyDebt = legacyCtx.R.calculateScore(
    "C",
    dice([2, 3, 4, 5, 6]),
    { ...ctx, debt: 20, inventory: [{ id: "DEBT_COLLECTOR" }] },
  );
  assert.equal(legacyDebt.debtCollectorCapped, undefined);
  assert.deepEqual(pick(legacyDebt), baseline.fixtures.debtCollectorCap);
  assert.ok(ruleShaFromRepo(ROOT));
});
