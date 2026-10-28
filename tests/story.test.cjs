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

test("All five arcs expose full beat captions", () => {
  const st = loadStory();
  assert.equal(st.ARC_IDS.length, 5);
  for (const id of st.ARC_IDS) {
    const arc = st.getArc(id);
    assert.ok(arc.title);
    assert.ok(st.getProloguePanel(id));
    assert.ok(st.getRoundTransitionPanel(id, 4));
    assert.ok(st.getBustPanel(id));
    assert.ok(st.getVictoryPanel(id));
    assert.equal(st.getRoundTransitionPanel(id, 9), null);
  }
});

test("pickRandomArcId selects from catalog", () => {
  const st = loadStory();
  assert.equal(st.pickRandomArcId(0), st.ARC_IDS[0]);
  assert.equal(st.pickRandomArcId(0.99), st.ARC_IDS[st.ARC_IDS.length - 1]);
  assert.ok(st.ARC_IDS.includes(st.pickRandomArcId(0.42)));
});

test("Setup arc uses setup panel paths", () => {
  const st = loadStory();
  const p = st.getProloguePanel("setup");
  assert.equal(p.src, null, "setup arc has no shipped panel art yet");
  assert.ok(p.caption.includes("filed"));
});

test("Witness arc still loads panel PNGs", () => {
  const st = loadStory();
  assert.ok(st.getProloguePanel("witness").src.includes("prologue.png"));
});
