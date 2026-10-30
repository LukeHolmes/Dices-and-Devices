"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { replaySource } = require("./helpers/game.cjs");

function loadReplay() {
  const sandbox = {};
  vm.createContext(sandbox);
  new vm.Script(replaySource + "\nglobalThis.gr = GutterbonesReplay;").runInContext(sandbox);
  return sandbox.gr;
}

test("daily seed is stable for UTC date", () => {
  const gr = loadReplay();
  const a = gr.dailySeed("2026-10-30");
  const b = gr.dailySeed("2026-10-30");
  const c = gr.dailySeed("2026-10-31");
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("mulberry32 sequence is deterministic", () => {
  const gr = loadReplay();
  const r1 = gr.mulberry32(42);
  const r2 = gr.mulberry32(42);
  assert.equal(r1(), r2());
  assert.equal(r1(), r2());
});

test("ODD_EVEN modifier adjusts valid scores", () => {
  const gr = loadReplay();
  const dice = [{ value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }, { value: 5 }];
  const base = { valid: true, chips: 10, mult: 1, flowMult: 1, total: 10 };
  const out = gr.applyRunModifiersToScore(base, "TWOS", dice, [false, false, false, false, false], ["ODD_EVEN_SPLIT"], null);
  assert.ok(out.total > base.total);
});

test("share string includes date and heat", () => {
  const gr = loadReplay();
  const s = gr.dailyShareString({ dateKey: "2026-10-30", heat: 140, rounds: 4 });
  assert.match(s, /2026-10-30/);
  assert.match(s, /heat:140/);
});
