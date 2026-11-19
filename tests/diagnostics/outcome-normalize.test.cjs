"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { normalizeRunOutcome, isNaturalTermination } = require("../helpers/run-results-csv.cjs");

test("budget forfeit rap sheet is INCOMPLETE:BUDGET not BUST", () => {
  const norm = normalizeRunOutcome(
    {
      outcome: "INCOMPLETE:BUDGET",
      reason: "budget_exhausted",
      steps: 8000,
      maxRound: 1,
    },
    { budgetMaxSteps: 8000 },
  );
  assert.equal(norm.outcome, "INCOMPLETE:BUDGET");
  assert.equal(norm.terminal_reason, "budget_exhausted");
  assert.equal(norm.stuck_flag, "1");
  assert.equal(isNaturalTermination(norm.outcome), false);
});

test("legacy mislabeled bust at budget cap is corrected", () => {
  const norm = normalizeRunOutcome(
    {
      outcome: "BUST",
      detail: "sim_forfeit_escape",
      steps: 12000,
      maxRound: 1,
    },
    { budgetMaxSteps: 12000 },
  );
  assert.equal(norm.outcome, "INCOMPLETE:BUDGET");
});

test("natural bust unchanged", () => {
  const norm = normalizeRunOutcome({ outcome: "BUST", steps: 120, reason: "" }, { budgetMaxSteps: 8000 });
  assert.equal(norm.outcome, "BUST");
  assert.equal(isNaturalTermination(norm.outcome), true);
});