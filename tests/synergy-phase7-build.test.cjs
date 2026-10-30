"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createGame } = require("./helpers/game.cjs");
const { snapshot, dice } = require("./fixtures/runs.cjs");

test("aggregateChainStats reads chainDepth from history", () => {
  const g = createGame(snapshot());
  const stats = g.api.aggregateChainStats([
    { total: 40, chainDepth: 0 },
    { total: 55, chainDepth: 2 },
    { total: 80, chainDepth: 3 },
  ]);
  assert.equal(stats.max, 3);
  assert.equal(stats.chainHands, 2);
  assert.ok(Math.abs(stats.avg - 5 / 3) < 0.01);
});

test("analyzeBuild favors MULT_ENGINE when chain history and tagged hardware", () => {
  const g = createGame(snapshot());
  const history = [
    { total: 90, chainDepth: 3, triggers: [{ name: "CHAIN", value: "FUSE" }] },
    { total: 70, chainDepth: 2, triggers: [{ name: "+MULT", value: "x2" }] },
    { total: 50, chainDepth: 1, triggers: [] },
  ];
  const multRun = g.api.analyzeBuild({
    inventory: [{ id: "FUSE_BOX" }, { id: "ENGINE" }],
    dice: dice([1, 2, 3, 4, 5]),
    history,
    flowStreak: 2,
  });
  assert.equal(multRun.primaryBuild, g.api.BUILD_IDS.MULT_ENGINE);
  assert.ok(multRun.confidence > 0.35);
  assert.ok(multRun.signals.some((s) => s.startsWith("hist:chain")));
  assert.equal(multRun.chainMax, 3);
});

test("analyzeBuild SET_CONSISTENCY when low chain variance and steady totals", () => {
  const g = createGame(snapshot());
  const history = [
    { total: 48, chainDepth: 0 },
    { total: 52, chainDepth: 0 },
    { total: 50, chainDepth: 1 },
    { total: 49, chainDepth: 0 },
    { total: 51, chainDepth: 0 },
  ];
  const steady = g.api.analyzeBuild({
    inventory: [{ id: "BOOKENDS" }],
    dice: dice([2, 3, 4, 5, 6]),
    history,
    flowStreak: 1,
  });
  assert.equal(steady.primaryBuild, g.api.BUILD_IDS.SET_CONSISTENCY);
});
