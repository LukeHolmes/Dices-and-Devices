"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { classifyTraceDivergence } = require("./sim-canonical-state.cjs");

test("classifyTraceDivergence: same draw count, different phase at draw site -> harness-timing", () => {
  const diverge = {
    a: { stateHash: "a", action: "e2e:rollOnce", gameRngDraws: 10 },
    b: { stateHash: "b", action: "e2e:rollOnce", gameRngDraws: 10 },
  };
  const gameDrawLogA = [{ n: 10, site: "rollLane", v: 0.1, phase: "PLAY", round: 3 }];
  const gameDrawLogB = [{ n: 10, site: "weightedSortJitter", v: 0.2, phase: "GAMBLE", round: 3 }];
  assert.equal(
    classifyTraceDivergence(diverge, { gameDrawLogA, gameDrawLogB }),
    "harness-timing",
  );
});

test("classifyTraceDivergence: same hash different action -> harness-timing", () => {
  const diverge = {
    a: { stateHash: "abc", action: "click:x" },
    b: { stateHash: "abc", action: "click:y" },
  };
  assert.equal(classifyTraceDivergence(diverge), "harness-timing");
});