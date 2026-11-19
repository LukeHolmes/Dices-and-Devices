"use strict";

const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const vm = require("node:vm");

const shimSource = fs.readFileSync(
  path.join(__dirname, "../../tests/sim/harness-determinism-shim.js"),
  "utf8",
);

test("harness determinism shim seeds Math.random before gameplay", () => {
  const sandbox = { window: {}, console, Math };
  vm.createContext(sandbox);
  sandbox.window.Math = Math;
  vm.runInContext(shimSource, sandbox);
  vm.runInContext("window.__GB_SIM_INSTALL_GAME_SEED__(42)", sandbox);
  const draws = [sandbox.window.Math.random(), sandbox.window.Math.random(), sandbox.window.Math.random()];
  vm.runInContext("window.__GB_SIM_INSTALL_GAME_SEED__(42)", sandbox);
  const replay = [sandbox.window.Math.random(), sandbox.window.Math.random(), sandbox.window.Math.random()];
  assert.deepEqual(draws, replay);
  assert.equal(sandbox.window.__GB_SIM_STEP_SYNC__, true);
});