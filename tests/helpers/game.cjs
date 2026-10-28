"use strict";
// Execute production modules in a VM sandbox (no second implementation of rules).
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const root = path.join(__dirname, "../..");
const legacyHtmlPath = path.join(root, "index.legacy.html");
const html = fs.existsSync(legacyHtmlPath)
  ? fs.readFileSync(legacyHtmlPath, "utf8")
  : fs.readFileSync(path.join(root, "index.html"), "utf8");

function readSrc(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

/** Strip ESM syntax so vm.Script can run modules as classic scripts. */
function asClassicScript(source) {
  return source
    .replace(/^import .*;\n/gm, "")
    .replace(/^export default .*;\n/gm, "")
    .replace(/^export \{ .* \};\n/gm, "")
    .replace(/^export function createGameActions/gm, "function createGameActions")
    .replace(/^export const /gm, "const ");
}

const sharedSource = asClassicScript(readSrc("src/systems/rules.js"));
const onboardingSource = asClassicScript(readSrc("src/systems/onboarding.js"));
const storySource = asClassicScript(readSrc("src/systems/story.js"));
const routesSource = asClassicScript(readSrc("src/systems/routes.js"));
const gambleSource = asClassicScript(readSrc("src/systems/gamble.js"));
const catalogSource = asClassicScript(readSrc("src/data/catalog.js"));
let gameActionsSource = asClassicScript(readSrc("src/app/gameActions.js"));
gameActionsSource = gameActionsSource.replace(
  /const \{\s*[\s\S]*?\} = catalog;\s*/,
  "",
);
const appSource = readSrc("src/App.jsx");

const actionNames = [
  "getBossAdjustedTarget",
  "calculateScore",
  "rollBones",
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
];

/** For source.test.cjs — ensure action implementations live in gameActions module. */
function actionSource(name) {
  assert.ok(actionNames.includes(name), `Unknown action: ${name}`);
  const marker = `const ${name} =`;
  const start = gameActionsSource.indexOf(marker);
  assert.ok(start >= 0, `${name} must be defined in src/app/gameActions.js`);
  const slice = gameActionsSource.slice(start);
  const endMatch = /\n  const [a-zA-Z]+ =/.exec(slice.slice(marker.length));
  const end = endMatch ? start + marker.length + endMatch.index : start + 800;
  return gameActionsSource.slice(start, end);
}

const exportedNames = [
  ...actionNames,
  "PERSONAS",
  "FACE_DATABASE",
  "DEVISES",
  "PROGRAMS",
  "BOSSES",
  "CATEGORIES",
  "RUN_PHASES",
  "STORAGE_KEYS",
  "DEFAULT_META_STATE",
  "SAFEHOUSE_UPGRADES",
  "normalizeSavedRun",
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
    spawnFlying: noOp,
    cascadeTriggers: noOp,
    triggerCameraKick: noOp,
    analyzeRunFailure: () => ({ primaryReason: "test scenario" }),
    patchSettings: noOp,
    generateShop: () => calls.push("generateShop"),
    playStoryBeat: noOp,
    scheduleTimeout: (callback) => {
      timers.push(callback);
      return timers.length;
    },
    scheduleInterval: () => 1,
    clearScheduledInterval: noOp,
  };
  for (const setter of new Set(
    (gameActionsSource.match(/\bset[A-Z]\w*/g) || []).concat([
      "setGold",
      "setDebt",
      "setHands",
      "setDiscards",
      "setScore",
      "setPhase",
      "setRolling",
      "setDice",
      "setMeta",
    ]),
  )) {
    const key = setter[3].toLowerCase() + setter.slice(4);
    sandbox[setter] = (update) => {
      const previous = pending.has(key) ? pending.get(key) : sandbox[key];
      pending.set(
        key,
        typeof update === "function" ? update(previous) : update,
      );
      sandbox[key] = pending.get(key);
    };
  }
  const context = vm.createContext(sandbox);
  new vm.Script(
    sharedSource +
      "\n" +
      onboardingSource +
      "\n" +
      storySource +
      "\n" +
      routesSource +
      "\n" +
      gambleSource +
      "\n" +
      catalogSource +
      "\n" +
      gameActionsSource +
      "\nconst __actions = createGameActions(() => globalThis);" +
      "\nglobalThis.game = { GutterbonesRules, GutterbonesOnboarding, GutterbonesStory, GutterbonesRoutes, GutterbonesGamble, ...__actions, " +
      exportedNames.filter((n) => !actionNames.includes(n)).join(", ") +
      " };",
  ).runInContext(context, { timeout: 4000 });
  return {
    api: context.game,
    storage,
    warnings,
    calls,
    state: (key) => (pending.has(key) ? pending.get(key) : sandbox[key]),
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
  storySource,
  routesSource,
  gambleSource,
  appSource,
  actionSource,
  gameActionsSource,
};
