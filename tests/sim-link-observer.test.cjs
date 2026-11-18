"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const policySrc = fs.readFileSync(path.join(__dirname, "../assets/sim-bot-policy.js"), "utf8");
const observerSrc = fs.readFileSync(path.join(__dirname, "../assets/sim-link-observer.js"), "utf8");

function loadBoth() {
  const sandbox = { globalThis: {}, window: {}, module: { exports: {} } };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(policySrc, sandbox);
  vm.runInContext(observerSrc.replace(/window/g, "globalThis"), sandbox);
  return sandbox;
}

test("shadow permutations cover 120 orderings", () => {
  const s = loadBoth();
  const obs = s.GutterbonesSimLinkObserver.create({ enabled: true });
  let calls = 0;
  const calculateScore = () => {
    calls += 1;
    return { valid: true, total: 10, chainLinks: [] };
  };
  obs.shadowBeforeScore({
    catId: "Y",
    dice: [{ value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }, { value: 5 }],
    inventory: [],
    score: 0,
    target: 100,
    hands: 2,
    usedCats: [],
    calculateScore,
    scorablePayoutIds: ["Y", "LS"],
  });
  assert.equal(calls, 1 + 120 * 2);
  assert.equal(obs.shadow.decisions, 1);
});

test("a hidden carve does not count as a rolled or scored link", () => {
  const s = loadBoth();
  const p = s.GutterbonesSimBotPolicy;
  const obs = s.GutterbonesSimLinkObserver.create({ enabled: true });
  const dice = [1, 2, 3, 4, 6].map(value => ({ value, faceId: null, faces: [] }));
  dice[0].faces.push({ id: "GHOST_FACE" });
  dice[4].faces.push({ faceId: "ECHO_FACE" });
  const inventory = [{ id: "BOOKENDS" }];
  assert.equal(p.assessFullLinkKit(inventory, [], dice).fullKit, true);
  const choose = () => p.selectKeptSlots({ revision: p.WP3_SHOP_REVISION, dice, inventory }).kept;
  assert.deepEqual(Array.from(choose()), [false, false, false, false, false]);
  obs.evaluateLaneMilestones(dice, inventory);
  const family = "ghost_echo→bookends_retrigger";
  assert.equal(obs.families[family].rolled_together, 0);
  dice[0].faceId = "GHOST_FACE";
  assert.deepEqual(Array.from(choose()), [true, false, false, false, false]);
  const { analyzePerRidLinks } = require("../scripts/rule-experiments-matrix.cjs");
  const summary = { linkObserverByRid: { 0: obs } };
  obs.recordCarve("GHOST_FACE", 0, dice);
  obs.recordCarve("ECHO_FACE", 4, dice);
  assert.deepEqual(analyzePerRidLinks(summary), { runsWithLink: 0, runs2Families: 0 });
  obs.recordScoredLinks([family, family]);
  assert.deepEqual(analyzePerRidLinks(summary), { runsWithLink: 1, runs2Families: 0 });
  obs.recordScoredLinks(["blood_ripple→fuse_spark"]);
  assert.deepEqual(analyzePerRidLinks(summary), { runsWithLink: 1, runs2Families: 1 });
});
