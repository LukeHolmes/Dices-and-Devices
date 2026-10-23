"use strict";
// Observed failures are explicit baselines, never blanket ignored exceptions.
const assert = require("node:assert/strict");
const { createGame, plain } = require("./helpers/game.cjs");
const f = require("./fixtures/runs.cjs");
const cases = [
  [
    "GB001",
    "Enforcer cannot opening-roll",
    () => {
      const g = createGame(f.snapshot({ discards: 0, hasRolled: false }));
      g.api.rollBones();
      return g.state("hasRolled");
    },
    false,
    true,
  ],
  [
    "GB002",
    "Pill ignores carved faces",
    () => {
      const d = f.dice([1, 2, 3, 4, 5]);
      d[0].faces = [{ id: "GOLD_FACE", type: "modifier", value: 0 }];
      const g = createGame(f.snapshot({ dice: d }));
      g.api.popPill(0);
      return g.state("dice")[0].faceId;
    },
    null,
    "GOLD_FACE",
  ],
  [
    "GB003",
    "SNIFF spends stash with no pills",
    () => {
      const g = createGame(f.snapshot({ stash: 100, discards: 0 }));
      g.api.handleProgram(g.api.PROGRAMS.find((p) => p.id === "SNIFF"));
      return g.state("stash");
    },
    75,
    100,
  ],
  [
    "GB004",
    "Full Ride accepts fewer than five scoring bones",
    () => {
      const d = f.dice([2, 2, "W", 0, 0]);
      d[3].faceId = "MULT_FACE";
      d[4].faceId = "GOLD_FACE";
      return createGame(f.snapshot()).api.calculateScore("FH", d).valid;
    },
    true,
    false,
  ],
  [
    "GB005",
    "Centerpiece omits copied gold",
    () => {
      const d = f.dice([1, 2, 0, 4, 5]);
      d[2].faceId = "GOLD_FACE";
      return createGame(
        f.snapshot({ inventory: [{ id: "CENTERPIECE" }] }),
      ).api.calculateScore("C", d).gDelta;
    },
    2,
    4,
  ],
  [
    "GB006",
    "Resume clears paid wager",
    () => {
      const g = createGame(f.snapshot());
      g.api.saveSavedRun(f.wager());
      g.api.resumeRun();
      return plain(g.state("activeWager"));
    },
    null,
    { stake: 5, threshold: 110 },
  ],
  [
    "GB007",
    "Incomplete save accepted",
    () => createGame().api.normalizeSavedRun({}) !== null,
    true,
    false,
  ],
  [
    "GB008",
    "Debt paydown overcharges",
    () => {
      const g = createGame(f.snapshot({ phase: "SHOP", debt: 1, gold: 20 }));
      g.api.payDebtFromCash(10);
      return g.state("gold");
    },
    10,
    19,
  ],
  [
    "GB009",
    "Terminal cash omits hustle and double-charges lost stake",
    () => {
      const g = createGame(f.terminal());
      g.api.executePayout("Y");
      return g.state("lastLaundered");
    },
    35,
    41,
  ],
  [
    "GB010",
    "Resume clears gamble stake",
    () => {
      const g = createGame(f.snapshot());
      g.api.saveSavedRun(f.gamble());
      g.api.resumeRun();
      return g.state("gambleStake");
    },
    0,
    5,
  ],
  [
    "GB011",
    "Pill ignores Junkie rule",
    () => {
      const g = createGame(f.snapshot({ activeBoss: { id: "JUNKIE" } }));
      g.api.popPill(0);
      return g.state("dice")[0].value;
    },
    6,
    1,
  ],
];
let failures = 0;
for (const [id, label, observe, baseline, desired] of cases) {
  try {
    const actual = observe();
    assert.deepEqual(
      actual,
      process.argv.includes("--strict") ? desired : baseline,
    );
    console.log(
      `${id}: ${process.argv.includes("--strict") ? "FIXED" : "KNOWN FAILURE reproduced"} — ${label}`,
    );
  } catch (error) {
    failures++;
    console.error(`${id}: ${label}\n${error.stack}`);
  }
}
if (failures) process.exitCode = 1;
