"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(ROOT, "assets/rule-experiments.js"), "utf8");

function load() {
  const sandbox = { globalThis: {}, module: { exports: {} } };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.globalThis.GutterbonesRuleExperiments;
}

test("rule experiments default off", () => {
  const R = load();
  R.setFlags("");
  assert.equal(R.e1(), false);
  assert.equal(R.e3StartingGoldBonus(), 0);
});

test("E1 preserves pip on non-ghost carve", () => {
  const R = load();
  R.setFlags("e1");
  const face = R.applyCarveFace(
    { id: "GOLD_FACE", value: 0, type: "modifier" },
    { value: 4, faces: [{ id: "standard", value: 4, type: "standard" }] },
    0,
  );
  assert.equal(face.preservedPip, 4);
  assert.equal(R.showingPipForFace(face, { value: 4 }), 4);
});

test("E3 applies +5 gold mode by default tuning", () => {
  const R = load();
  R.setFlags("e3");
  assert.equal(R.e3StartingGoldBonus(), 5);
  assert.equal(R.TUNING.e3ReliefMode, "gold");
});
