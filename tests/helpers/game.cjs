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
const actions = actionNames.map(actionSource).join("\n");
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
    generateShop: () => calls.push("generateShop"),
    scheduleTimeout: (callback) => {
      timers.push(callback);
      return timers.length;
    },
    scheduleInterval: () => 1,
    clearScheduledInterval: noOp,
  };
  for (const setter of new Set(actions.match(/\bset[A-Z]\w*/g))) {
    const key = setter[3].toLowerCase() + setter.slice(4);
    sandbox[setter] = (update) => {
      const previous = pending.has(key) ? pending.get(key) : snapshot[key];
      pending.set(
        key,
        typeof update === "function" ? update(previous) : update,
      );
    };
  }
  const context = vm.createContext(sandbox);
  new vm.Script(
    sharedSource +
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
  appSource,
  actionSource,
};
