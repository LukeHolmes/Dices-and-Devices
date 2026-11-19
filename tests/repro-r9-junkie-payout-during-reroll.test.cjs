"use strict";
/**
 * r9 — payout queued while a pill reroll is settling must run after lock clears (Junkie / swallow fix).
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createGame } = require("./helpers/game.cjs");
const f = require("./fixtures/runs.cjs");

test("r9 — payout clicked during pill reroll settle runs after lock (seeded Junkie round 9)", () => {
  const rng = {
    seq: [0, 0, 0, 0.99],
    i: 0,
    next() {
      const v = this.seq[this.i] ?? 0.42;
      this.i += 1;
      return v;
    },
  };
  const g = createGame(
    f.snapshot({
      round: 9,
      activeBoss: { id: "JUNKIE" },
      hands: 4,
      discards: 3,
      hasRolled: true,
      dice: f.dice([1, 2, 3, 4, 5]),
    }),
    { random: () => rng.next() },
  );
  const handsBefore = g.state("hands");
  g.api.popPill(0);
  const locksDuringReroll = g.playLocks();
  assert.ok(locksDuringReroll.rolling || locksDuringReroll.rollLocked, "reroll must hold roll input");
  g.api.executePayout("C");
  assert.equal(g.playLocks().pendingPayout, "C");
  assert.deepEqual(g.state("usedCats"), []);
  assert.equal(g.state("hands"), handsBefore);
  g.flushTimers();
  g.flushTimers();
  assert.ok(g.state("usedCats").includes("C"), "deferred payout must execute after reroll settle");
  assert.equal(g.state("hands"), handsBefore - 1);
});