"use strict";
// Read the production code: never maintain a second implementation of the rules.
// Action probes model one React render's snapshot and queued state updates only.
// They are not a React/browser renderer, nor a substitute for the preview checklist.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const html = fs.readFileSync(path.join(__dirname, "../../index.html"), "utf8");

function block(open) {
  assert.equal(html.split(open).length, 2, `Expected exactly one ${open}`);
  const start = html.indexOf(open) + open.length;
  const end = html.indexOf("</script>", start);
  assert.ok(end > start, `Missing closing script for ${open}`);
  return html.slice(start, end);
}

const sharedSource = block('<script id="gutterbones-rules">');
const onboardingSource = block('<script id="gutterbones-onboarding">');
const tutorialSource = block('<script id="gutterbones-tutorial">');
const replaySource = block('<script id="gutterbones-replay">');
const storySource = block('<script id="gutterbones-story">');
const routesSource = block('<script id="gutterbones-routes">');
const gambleSource = block('<script id="gutterbones-gamble">');
const appSource = block('<script type="text/babel">');
const definitionsStart = appSource.indexOf("    const PERSONAS =");
const definitionsEnd = appSource.indexOf("    const CashRain =");
assert.ok(
  definitionsStart >= 0 && definitionsEnd > definitionsStart,
  "Catalog boundary changed; update the test loader explicitly",
);
const definitions = appSource.slice(definitionsStart, definitionsEnd);

function actionSource(name) {
  const marker = `        const ${name} = `;
  assert.equal(
    appSource.split(marker).length,
    2,
    `Missing or duplicate action: ${name}`,
  );
  const start = appSource.indexOf(marker);
  const closing = /\n        \}\)?;/.exec(appSource.slice(start));
  assert.ok(closing, `Missing closing boundary: ${name}`);
  const end = start + closing.index + closing[0].length;
  assert.ok(end > start, `Missing boundary for action ${name}`);
  const code = appSource.slice(start, end);
  // A changed boundary must fail loudly rather than silently testing a partial body.
  new vm.Script(code);
  return code;
}

const actionNames = [
  "getBossAdjustedTarget",
  "calculateScore",
  "rollBones",
  "rerollBoneSlot",
  "popPill",
  "handleProgram",
  "resumeRun",
  "serializeRun",
  "persistRun",
  "updateMeta",
  "awardLaunderedCash",
  "executePayout",
  "payDebtFromCash",
  "registerDebtSpike",
  "handlePurchase",
];
const actions = actionNames.map(actionSource).join("\n");
const exportedNames = [
  ...actionNames,
  "PERSONAS",
  "FACE_DATABASE",
  "DEVISES",
  "PROGRAMS",
  "BOSSES",
  "CONSUMABLES",
  "CATEGORIES",
  "RUN_PHASES",
  "STORAGE_KEYS",
  "DEFAULT_META_STATE",
  "SAFEHOUSE_UPGRADES",
  "normalizeSavedRun",
  "analyzeBuild",
  "aggregateChainStats",
  "BUILD_IDS",
  "getFlowMultiplier",
  "getHandMasteryBonus",
  "loadSavedRun",
  "saveSavedRun",
  "clearSavedRun",
  "hydratePath",
  "loadJson",
  "saveJson",
];

function createGame(snapshot = {}, options = {}) {
  const pending = new Map();
  const storage = new Map(Object.entries(options.storage || {}));
  const timers = [];
  const warnings = [];
  const calls = [];
  const noOp = () => {};
  const audio = new Proxy({}, { get: () => noOp });
  const sandbox = {
    blueprints: [],
    blueprintRoundFlags: { multEngineUsed: false, flowSaveUsed: false },
    synergyState: { categoryMarks: {}, comboMeter: 0, heatSpikeNextHand: 0 },
    categoryMarkedThisRound: [],
    soldItems: [],
    shopItems: [],
    ...snapshot,
    Math: Object.assign(Object.create(Math), {
      random: options.random || (() => 0.99),
    }),
    console: { warn: (...args) => warnings.push(args), log: noOp },
    window: {
      localStorage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => {
          if (options.storageFails) throw new Error("Storage unavailable");
          storage.set(key, value);
        },
        removeItem: (key) => storage.delete(key),
      },
    },
    AudioSystem: audio,
    showMechanicPopup: noOp,
    spawnHitCallout: noOp,
    spawnPaperStamp: noOp,
    shopListPrice: (item) => Math.max(1, Math.floor(Number(item?.cost) || 1)),
    spawnFlying: noOp,
    cascadeTriggers: noOp,
    triggerCameraKick: noOp,
    analyzeRunFailure: () => ({ primaryReason: "test scenario" }),
    patchSettings: noOp,
    generateShop: () => calls.push("generateShop"),
    scheduleTimeout: (callback) => {
      timers.push(callback);
      return timers.length;
    },
    scheduleInterval: () => 1,
    clearScheduledInterval: noOp,
    dailyRunActive: false,
    runModifierIds: [],
    audioSettings: { diceSpeed: "normal" },
    reducedMotion: false,
    payoutInputLock: false,
    scoreBreakdown: null,
    scoreResolution: null,
    rollLockRef: { current: false },
    e2ePendingDiceRef: { current: null },
    pendingScoreBreakdownRef: { current: null },
    pendingHandJuiceRef: { current: null },
    flushPendingHandJuiceRef: { current: null },
    openingSniffPendingRef: { current: false },
    scoreOverlayLockRef: { current: false },
    playHudRef: { current: null },
    lastRollStartedAtRef: { current: 0 },
    pendingPayoutRef: { current: null },
    nextShopTagRef: { current: snapshot.nextShopTag ?? null },
    routeModifiersRef: { current: snapshot.routeModifiers ?? {} },
    modifierFlagsRef: {
      current: { sacrificeUsed: false, shopInterestRound: null },
    },
    runRandomRef: { current: () => (options.random || (() => 0.99))() },
    sacrificePlayPenaltyRef: { current: 0 },
    sacrificeBonusRef: { current: 0 },
    rollingSlots: [false, false, false, false, false],
    pillBursts: [],
    scoreBreakdownTimeoutRef: { current: null },
    scoreResolutionTimeoutRef: { current: null },
    pendingUnlockMessageRef: { current: null },
    dismissScoreOverlays: () => {},
  };
  for (const setter of new Set(actions.match(/\bset[A-Z]\w*/g))) {
    const key = setter[3].toLowerCase() + setter.slice(4);
    sandbox[setter] = (update) => {
      const previous = pending.has(key)
        ? pending.get(key)
        : snapshot[key] !== undefined
          ? snapshot[key]
          : sandbox[key];
      const next =
        typeof update === "function" ? update(previous) : update;
      pending.set(key, next);
      if (key === "dailyRunActive") sandbox.dailyRunActive = next;
    };
  }
  const context = vm.createContext(sandbox);
  new vm.Script(
    sharedSource +
      "\n" +
      onboardingSource +
      "\n" +
      tutorialSource +
      "\n" +
      replaySource +
      "\n" +
      storySource +
      "\n" +
      routesSource +
      "\n" +
      gambleSource +
      "\n" +
      definitions +
      "\n" +
      actions +
      "\nglobalThis.game = { GutterbonesRules, " +
      exportedNames.join(", ") +
      " };",
  ).runInContext(context, { timeout: 2000 });
  return {
    api: context.game,
    storage,
    warnings,
    calls,
    state: (key) => (pending.has(key) ? pending.get(key) : snapshot[key]),
    flushTimers: () => {
      const queued = timers.splice(0);
      queued.forEach((callback) => callback());
    },
  };
}

const plain = (value) => JSON.parse(JSON.stringify(value));
module.exports = {
  createGame,
  plain,
  html,
  sharedSource,
  onboardingSource,
  tutorialSource,
  replaySource,
  storySource,
  routesSource,
  gambleSource,
  appSource,
  actionSource,
};
