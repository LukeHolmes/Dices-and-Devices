"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

// When __GB_SIM_GAME_RANDOM__ is absent, instrumented helpers reduce to pin logic.
test("R-main-i gameplayRandom matches pin when hook absent", () => {
  const dailyRunActive = false;
  const window = {};
  const runRandomRef = { current: () => 0.42 };
  const simSeededGameplay = () =>
    dailyRunActive || (typeof window !== "undefined" && typeof window.__GB_SIM_GAME_RANDOM__ === "function");
  const gameplayRandom = () => (simSeededGameplay() ? runRandomRef.current() : Math.random());
  const pinFn = () => (dailyRunActive ? runRandomRef.current() : Math.random());
  assert.equal(simSeededGameplay(), false);
  const orig = Math.random;
  Math.random = () => 0.111;
  try {
    assert.equal(pinFn(), gameplayRandom());
    assert.equal(gameplayRandom(), 0.111);
  } finally {
    Math.random = orig;
  }
});

test("R78-i gameplayRandom matches pin when hook absent and e2e not seeded", () => {
  const dailyRunActive = false;
  const e2eRunSeededRef = { current: false };
  const window = {};
  const runRandomRef = { current: () => 0.77 };
  const simSeededGameplay = () =>
    dailyRunActive
    || e2eRunSeededRef.current
    || (typeof window !== "undefined" && typeof window.__GB_SIM_GAME_RANDOM__ === "function");
  const pinFn = () => ((dailyRunActive || e2eRunSeededRef.current) ? runRandomRef.current() : Math.random());
  const gameplayRandom = () => (simSeededGameplay() ? runRandomRef.current() : Math.random());
  assert.equal(simSeededGameplay(), false);
  const orig = Math.random;
  Math.random = () => 0.222;
  try {
    assert.equal(pinFn(), gameplayRandom());
  } finally {
    Math.random = orig;
  }
});

test("gbSimGameplayRandom matches Math.random when hook absent", () => {
  const window = {};
  const gbSimGameplayRandom = (caller = "moduleDefault") => {
    if (typeof window.__GB_SIM_DRAW_GAME__ === "function") {
      return window.__GB_SIM_DRAW_GAME__(caller, window.__GB_SIM_ROUND__ != null ? window.__GB_SIM_ROUND__ : 1);
    }
    if (typeof window.__GB_SIM_GAME_RANDOM__ === "function") return window.__GB_SIM_GAME_RANDOM__();
    return Math.random();
  };
  const pinPick = (random) => {
    const roll = random !== undefined && random !== null ? random : Math.random();
    return roll;
  };
  const pick = (random) => {
    const roll = random !== undefined && random !== null ? random : gbSimGameplayRandom();
    return roll;
  };
  const orig = Math.random;
  Math.random = () => 0.333;
  try {
    assert.equal(pinPick(), pick());
  } finally {
    Math.random = orig;
  }
});

test("R78-i gameplayRandom matches pin when e2e seeded and hook absent", () => {
  const dailyRunActive = false;
  const e2eRunSeededRef = { current: true };
  const window = {};
  const runRandomRef = { current: () => 0.77 };
  const simSeededGameplay = () =>
    dailyRunActive
    || e2eRunSeededRef.current
    || (typeof window !== "undefined" && typeof window.__GB_SIM_GAME_RANDOM__ === "function");
  const pinFn = () => ((dailyRunActive || e2eRunSeededRef.current) ? runRandomRef.current() : Math.random());
  const gameplayRandom = () => (simSeededGameplay() ? runRandomRef.current() : Math.random());
  assert.equal(pinFn(), gameplayRandom());
  assert.equal(gameplayRandom(), 0.77);
});