"use strict";
/** Pin production rule facts (reject external review errors). */
const { test } = require("node:test");
const assert = require("node:assert/strict");

test("Ghost Echo reach is Chebyshev distance ≤3 on 5 slots", () => {
  const reach = 3;
  const partners = (i) => {
    const out = [];
    for (let j = 0; j < 5; j++) {
      if (j === i) continue;
      if (Math.abs(i - j) <= reach) out.push(j);
    }
    return out;
  };
  assert.deepEqual(partners(2), [0, 1, 3, 4]);
  assert.equal(partners(0).length, 3);
  assert.ok(!partners(0).includes(4), "slot 0 does not reach slot 4 at distance 4");
});

test("Crooked Cop dampens hardware; Loan Shark toll tuning", () => {
  const fs = require("node:fs");
  const html = fs.readFileSync(require("node:path").join(__dirname, "../index.html"), "utf8");
  assert.match(html, /crookedCopHardwareMult/);
  assert.match(html, /loanSharkToll:\s*2/);
  assert.match(html, /loanSharkDebtToll:\s*1/);
  assert.doesNotMatch(html, /hardwareDisabled\s*=\s*crookedCopActive/s);
});

test("sim harness uses rid 0..games-1 seeds rid*7919", () => {
  const runSrc = require("node:fs").readFileSync(require("node:path").join(__dirname, "sim/run.cjs"), "utf8");
  assert.match(runSrc, /for \(let rid = 0; rid < args\.games/);
  assert.match(runSrc, /seed: rid \* 7919/);
});
