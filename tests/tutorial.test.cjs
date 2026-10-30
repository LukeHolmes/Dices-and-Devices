"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { tutorialSource } = require("./helpers/game.cjs");

function loadTutorial() {
  const sandbox = {};
  vm.createContext(sandbox);
  new vm.Script(tutorialSource + "\nglobalThis.gt = GutterbonesTutorial;").runInContext(sandbox);
  return sandbox.gt;
}

test("tutorial roll table is deterministic across roll indices", () => {
  const gt = loadTutorial();
  gt.resetRollCounter();
  const a0 = gt.valueForSlot(0, 0);
  const a1 = gt.valueForSlot(0, 1);
  gt.resetRollCounter();
  const b0 = gt.valueForSlot(0, 0);
  const b1 = gt.valueForSlot(0, 1);
  assert.equal(a0, b0);
  assert.equal(a1, b1);
  assert.deepEqual([...gt.ROLL_TABLE[0]], [2, 2, 3, 4, 5]);
  assert.ok(gt.STEPS.length >= 8);
});

test("tutorial advance matches expected player actions", () => {
  const gt = loadTutorial();
  const rollStep = gt.stepByIndex(1);
  assert.equal(rollStep.advance, "roll_settled");
  assert.ok(gt.advanceForAction(rollStep, "roll_settled"));
  assert.ok(!gt.advanceForAction(rollStep, "pill"));
  const sniffStep = gt.stepByIndex(0);
  assert.ok(gt.advanceForAction(sniffStep, "ack"));
});

test("settings persistence includes tutorialCompleted flag", () => {
  const { html } = require("./helpers/game.cjs");
  assert.match(html, /tutorialCompleted:\s*false/);
  assert.match(html, /tutorialCompleted:\s*!!stored\.tutorialCompleted/);
  assert.match(html, /completeTutorial\s*=\s*\(\)/);
});

test("tutorial runs are never persisted for resume", () => {
  const { html } = require("./helpers/game.cjs");
  assert.match(html, /if \(tutorialActiveRef\.current\) return;/);
  assert.match(html, /saved\.tutorialActive/);
  assert.match(html, /tutorialActive:\s*false/);
});
