"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createGame, plain } = require("./helpers/game.cjs");
const f = require("./fixtures/runs.cjs");
for (const [name, fixture] of Object.entries({
  normal: f.run,
  wager: f.wager,
  gamble: f.gamble,
  carving: f.carving,
  bust: f.bustLastHand,
  victory: f.victoryLastHand,
}))
  test(`${name}: normalization and storage roundtrip`, () => {
    const g = createGame(f.snapshot());
    const raw = fixture();
    const before = JSON.stringify(raw);
    const normalized = g.api.normalizeSavedRun(raw);
    assert.deepEqual(plain(normalized), raw);
    g.api.saveSavedRun(normalized);
    assert.deepEqual(plain(g.api.loadSavedRun()), raw);
    assert.equal(JSON.stringify(raw), before);
  });
test("Non-object saves rejected", () => {
  const g = createGame();
  for (const v of [null, undefined, false, 3, "bad", {}])
    assert.equal(g.api.normalizeSavedRun(v), null);
});
test("Optional fields receive defaults", () => {
  const g = createGame();
  const r = g.api.normalizeSavedRun(
    f.run({
      consumables: null,
      flowStreak: NaN,
      handLevels: [],
      activeWager: { stake: -5 },
    }),
  );
  assert.deepEqual(plain(r.consumables), []);
  assert.equal(r.flowStreak, 0);
  assert.equal(r.activeWager, null);
  assert.equal(r.nextShopTag, null);
  assert.equal(r.activeShopTag, null);
  assert.equal(Object.keys(r.routeModifiers).length, 0);
});
test("Shop tag and route modifiers normalize safely", () => {
  const g = createGame();
  const r = g.api.normalizeSavedRun(
    f.run({
      nextShopTag: "hardware",
      activeShopTag: "rare",
      routeModifiers: { flowCapDelta: -1, shopDiscount: 0.99, informantWeight: 2, junk: true },
    }),
  );
  assert.equal(r.nextShopTag, "hardware");
  assert.equal(r.activeShopTag, "rare");
  assert.equal(r.routeModifiers.flowCapDelta, -1);
  assert.equal(r.routeModifiers.shopDiscount, 0.5);
  assert.equal(r.routeModifiers.informantWeight, 2);
  assert.equal(r.routeModifiers.junk, undefined);
});
test("Corrupt JSON is handled", () => {
  const g = createGame();
  g.storage.set(g.api.STORAGE_KEYS.run, "{bad");
  assert.equal(g.api.loadSavedRun(), null);
  assert.equal(g.warnings.length, 1);
});
test("Storage write failure does not throw", () => {
  const g = createGame({}, { storageFails: true });
  assert.doesNotThrow(() => g.api.saveSavedRun(f.run()));
  assert.equal(g.warnings.length, 1);
});
test("Carving resume retains purchase and slot", () => {
  const g = createGame(f.snapshot());
  g.api.saveSavedRun(f.carving());
  g.api.resumeRun();
  assert.equal(g.state("phase"), "CARVING");
  assert.equal(g.state("carvingDie"), 2);
  assert.equal(g.state("selectedItem").id, "MULT_FACE");
  assert.equal(g.state("gold"), 8);
});
test("Terminal award clears active save and updates meta", () => {
  const g = createGame(f.snapshot());
  g.api.saveSavedRun(f.run());
  assert.equal(
    g.api.awardLaunderedCash({ victory: true, totalHeat: 250, cash: 16 }),
    41,
  );
  assert.equal(g.state("meta").completedRuns, 1);
  assert.equal(g.state("meta").launderedCash, 41);
  assert.equal(g.api.loadSavedRun(), null);
  assert.equal(g.state("runClosed"), true);
});
