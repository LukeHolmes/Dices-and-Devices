"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { storySource } = require("./helpers/game.cjs");

function loadStory() {
  const sandbox = {};
  vm.createContext(sandbox);
  new vm.Script(storySource + "\nglobalThis.st = GutterbonesStory;").runInContext(sandbox);
  return sandbox.st;
}

test("Witness arc panels map rounds and endings", () => {
  const st = loadStory();
  assert.equal(st.DEFAULT_ARC_ID, "witness");
  assert.ok(st.getProloguePanel("witness").src.includes("prologue.png"));
  assert.equal(st.getRoundTransitionPanel("witness", 1), null);
  assert.ok(st.getRoundTransitionPanel("witness", 3).caption.includes("headline"));
  assert.ok(st.getBustPanel("witness").src.endsWith("bust.png"));
  assert.ok(st.getVictoryPanel("witness").caption.includes("problem"));
});
