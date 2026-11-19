"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { parseArgs } = require(path.join(__dirname, "../sim/run.cjs"));

describe("sim runner rid offset", () => {
  it("parseArgs accepts root and games", () => {
    const args = parseArgs(["--games=3", "--root=/tmp/rules"]);
    assert.equal(args.games, 3);
    assert.equal(args.root, "/tmp/rules");
  });

  it("WP2_RID_OFFSET shifts implicit rid range", () => {
    const offset = 60;
    const games = 3;
    const rids = [];
    for (let i = 0; i < games; i++) {
      rids.push(offset + i);
    }
    assert.deepEqual(rids, [60, 61, 62]);
    assert.deepEqual(
      rids.map((rid) => rid * 7919),
      [475140, 483059, 490978],
    );
  });
});