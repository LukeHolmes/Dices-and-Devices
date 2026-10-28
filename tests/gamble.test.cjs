"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
function block(open) {
  const start = html.indexOf(open) + open.length;
  const end = html.indexOf("</script>", start);
  return html.slice(start, end);
}
const gambleSource = block('<script id="gutterbones-gamble">');

function loadGamble() {
  const sandbox = {};
  vm.createContext(sandbox);
  new vm.Script(gambleSource + "\nglobalThis.g = GutterbonesGamble;").runInContext(sandbox);
  return sandbox.g;
}

test("baseStake respects rate, min, and cap", () => {
  const g = loadGamble();
  assert.equal(g.baseStake(0), 5);
  assert.equal(g.baseStake(100), 22);
  assert.equal(g.baseStake(500), 30);
});

test("SOFT tier uses reduced stake vs FAIR", () => {
  const g = loadGamble();
  const fair = g.stakeForTier(100, "FAIR");
  const soft = g.stakeForTier(100, "SOFT");
  assert.ok(soft < fair);
  assert.equal(soft, 14);
  assert.equal(fair, 22);
});

test("FAIR flip is fifty-fifty without flow", () => {
  const g = loadGamble();
  assert.equal(g.winProbability("FAIR", 0), 0.5);
  const win = g.resolveFlip({ tierId: "FAIR", flowStreak: 0, gold: 100, random: 0.49 });
  const loss = g.resolveFlip({ tierId: "FAIR", flowStreak: 0, gold: 100, random: 0.51 });
  assert.equal(win.won, true);
  assert.equal(loss.won, false);
  assert.equal(win.winAmount, win.stake);
  assert.equal(loss.lossAmount, loss.stake);
});

test("HARD tier pays 1.5x stake on win", () => {
  const g = loadGamble();
  const out = g.resolveFlip({ tierId: "HARD", flowStreak: 0, gold: 100, random: 0 });
  assert.equal(out.won, true);
  assert.equal(out.winAmount, Math.round(out.stake * 1.5));
});

test("flow streak increases win probability with cap", () => {
  const g = loadGamble();
  const p0 = g.winProbability("FAIR", 0);
  const p3 = g.winProbability("FAIR", 3);
  const p99 = g.winProbability("FAIR", 99);
  assert.equal(p0, 0.5);
  assert.equal(p3, 0.56);
  assert.equal(p99, 0.62);
});
