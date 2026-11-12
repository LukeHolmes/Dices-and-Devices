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
