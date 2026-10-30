"use strict";
// Phase C — former GB001–GB011 known defects (must stay fixed).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createGame, plain } = require("./helpers/game.cjs");
const f = require("./fixtures/runs.cjs");

test("GB001: Enforcer opening roll without pills", () => {
  const g = createGame(f.snapshot({ discards: 0, hasRolled: false }));
  g.api.rollBones();
  assert.equal(g.state("hasRolled"), true);
});

test("GB002: Pill reroll keeps carved face", () => {
  const d = f.dice([1, 2, 3, 4, 5]);
  d[0].faces = [{ id: "GOLD_FACE", type: "modifier", value: 0, label: "+$2", style: "" }];
  const g = createGame(f.snapshot({ dice: d }));
  g.api.popPill(0);
  g.flushTimers();
  assert.equal(g.state("dice")[0].faceId, "GOLD_FACE");
});

test("GB003: SNIFF spends stash without consuming pills", () => {
  const g = createGame(f.snapshot({ stash: 100, discards: 3, hasRolled: true }));
  g.api.handleProgram(g.api.PROGRAMS.find((p) => p.id === "SNIFF"));
  g.flushTimers();
  assert.equal(g.state("stash"), 75);
  assert.equal(g.state("discards"), 3);
});

test("GB004: Full Ride requires five scoring bones", () => {
  const d = f.dice([2, 2, "W", 0, 0]);
  d[3].faceId = "MULT_FACE";
  d[4].faceId = "GOLD_FACE";
  assert.equal(createGame(f.snapshot()).api.calculateScore("FH", d).valid, false);
});

test("GB005: Centerpiece copies gold face cash", () => {
  const d = f.dice([1, 2, 0, 4, 5]);
  d[2].faceId = "GOLD_FACE";
  assert.equal(
    createGame(f.snapshot({ inventory: [{ id: "CENTERPIECE" }] })).api.calculateScore("C", d).gDelta,
    4,
  );
});

test("GB006: Resume preserves paid wager", () => {
  const g = createGame(f.snapshot());
  g.api.saveSavedRun(f.wager());
  g.api.resumeRun();
  assert.deepEqual(plain(g.state("activeWager")), { stake: 5, threshold: 110 });
});

test("GB007: Incomplete save rejected", () => {
  assert.equal(createGame().api.normalizeSavedRun({}), null);
});

test("GB008: Debt paydown capped to owed debt", () => {
  const g = createGame(f.snapshot({ phase: "SHOP", debt: 1, gold: 20 }));
  g.api.payDebtFromCash(10);
  assert.equal(g.state("gold"), 19);
});

test("GB009: Terminal award includes hustle, no double lost stake", () => {
  const g = createGame(f.terminal());
  g.api.executePayout("Y");
  assert.equal(g.state("lastLaundered"), 44);
});

test("GB010: Resume preserves gamble stake", () => {
  const g = createGame(f.snapshot());
  g.api.saveSavedRun(f.gamble());
  g.api.resumeRun();
  assert.equal(g.state("gambleStake"), 5);
});

test("GB011: Pill reroll applies Junkie rule", () => {
  const g = createGame(f.snapshot({ activeBoss: { id: "JUNKIE" } }));
  g.api.popPill(0);
  assert.equal(g.state("dice")[0].value, 1);
});
