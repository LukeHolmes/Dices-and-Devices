"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("rollBones sync path uses functional setDice (not stale closure dice)", () => {
  const rollBlock = html.slice(html.indexOf("const rollBones = () => {"), html.indexOf("const rerollBoneSlot ="));
  assert.match(
    rollBlock,
    /if \(reducedMotion \|\| e2eFastDice\) \{\s*setDice\(prev => prev\.map\(\(d, i\) => \(activeMask\[i\] \? resolveDieAfterRoll/,
  );
  assert.doesNotMatch(rollBlock, /setDice\(nextDice\)/);
  assert.doesNotMatch(rollBlock, /applyRollToLane\(dice\)/);
});

test("staggered roll has no observer side effects inside setDice updater", () => {
  const rollBlock = html.slice(html.indexOf("const rollBones = () => {"), html.indexOf("const rerollBoneSlot ="));
  const stagger = rollBlock.slice(rollBlock.indexOf("activeIndices.forEach"));
  assert.match(stagger, /setDice\(prev => prev\.map/);
  assert.doesNotMatch(stagger, /GutterbonesBalanceObserver\.notify/);
  assert.doesNotMatch(stagger, /recordAction/);
});

test("rerollBoneSlot uses functional setDice inside timeout", () => {
  const rerollBlock = html.slice(html.indexOf("const rerollBoneSlot = "), html.indexOf("const popPill ="));
  assert.match(rerollBlock, /scheduleTimeout\(\(\) => \{\s*setDice\(prev =>/);
  assert.doesNotMatch(rerollBlock, /setDice\(nextDice\)/);
  assert.doesNotMatch(rerollBlock, /diceLiveRef/);
});

test("gameplay hooks gate on balanceObserverActive not global API alone", () => {
  const rollBlock = html.slice(html.indexOf("const rollBones = () => {"), html.indexOf("const rerollBoneSlot ="));
  assert.match(rollBlock, /balanceObserverActive\(\)/);
  assert.doesNotMatch(rollBlock, /if \(typeof window !== 'undefined' && window\.GutterbonesBalanceObserver\)/);
});
