"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const {
  createBalanceObserver,
  GutterbonesBalanceObserver,
  ruleShaFromRepo,
} = require("./helpers/balance-observer.cjs");
const { dice } = require("./fixtures/runs.cjs");

const ROOT = path.join(__dirname, "..");

/** Minimal flush of stagger terminal step when lane JSON unchanged (observer contract). */
function flushUnchangedStaggerTerminal(observer, pending, diceAfter) {
  const api = GutterbonesBalanceObserver;
  if (pending.lastSeenDice === diceAfter) return false;
  pending.lastSeenDice = diceAfter;
  const afterDice = api.snapshotRawLane(diceAfter);
  const afterJson = JSON.stringify(afterDice);
  const laneSnapshotUnchanged = afterJson === pending.beforeDiceJson;
  assert.equal(laneSnapshotUnchanged, true);
  assert.equal(pending.slotsRemaining, 1);
  pending.slotsRemaining = 0;
  observer.recordAction({
    kind: pending.kind,
    reason: { status: "ok", value: `${pending.reason}_unchanged_lane` },
    before: pending.before,
    after: { dice: { status: "ok", value: afterDice } },
  });
  observer.recordStateCommit({
    kind: pending.kind,
    match: { status: "ok", value: true },
    actual: { dice: afterDice },
    reason: { status: "ok", value: "react_state_committed" },
  });
  return true;
}

test("unchanged lane snapshot still emits terminal roll after new dice array commit", () => {
  const observer = createBalanceObserver({ enabled: true, repoRoot: ROOT });
  globalThis.__GB_BALANCE_OBSERVER__ = observer;
  const lane = dice([2, 3, 4, 5, 6]);
  const pending = {
    kind: "roll",
    reason: "executed_opening_roll",
    before: { dice: GutterbonesBalanceObserver.snapshotRawLane(lane) },
    beforeDiceJson: JSON.stringify(GutterbonesBalanceObserver.snapshotRawLane(lane)),
    lastSeenDice: lane,
    staggered: true,
    slotsRemaining: 1,
  };
  const diceAfter = lane.map((d) => ({ ...d }));
  assert.notEqual(diceAfter, lane);
  assert.ok(flushUnchangedStaggerTerminal(observer, pending, diceAfter));
  const roll = observer.ledger.events.find((e) => e.type === "action" && e.action.kind === "roll");
  assert.ok(roll);
  assert.match(String(roll.action.reason.value), /unchanged_lane/);
  assert.ok(observer.ledger.events.some((e) => e.type === "state_commit" && e.commit.kind === "roll"));
});
