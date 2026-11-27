"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");

const {
  parseRidSpec,
  assertRidsAllowed,
  HOLDOUT_RIDS,
} = require(path.join(__dirname, "../helpers/holdout-guard.cjs"));

describe("holdout guard", () => {
  it("parses rid ranges and lists", () => {
    assert.deepEqual(parseRidSpec("0-2,5"), [0, 1, 2, 5]);
    assert.deepEqual(parseRidSpec([10, 11]), [10, 11]);
  });

  it("rejects holdout rids without approval", () => {
    const prev = process.env.HOLDOUT_APPROVAL_ID;
    delete process.env.HOLDOUT_APPROVAL_ID;
    const res = assertRidsAllowed([54, 55, 60]);
    assert.equal(res.ok, false);
    assert.ok(res.holdouts.includes(55));
    process.env.HOLDOUT_APPROVAL_ID = prev;
  });

  it("allows holdout rids with matching approval id", () => {
    const prev = process.env.HOLDOUT_APPROVAL_ID;
    process.env.HOLDOUT_APPROVAL_ID = "test-approval";
    const res = assertRidsAllowed([55], { approvalId: "test-approval" });
    assert.equal(res.ok, true);
    assert.equal(res.approved, true);
    process.env.HOLDOUT_APPROVAL_ID = prev;
  });

  it("pilot window excludes holdouts by default", () => {
    const rids = parseRidSpec("0-49,60-109");
    const overlap = rids.filter((r) => HOLDOUT_RIDS.has(r));
    assert.deepEqual(overlap, []);
  });
});