"use strict";
/** Round 1 automated playtest fixes: last-hand freeze, layout, stuck states. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

test("source — early score dismiss queues until round-end armed", () => {
  assert.match(html, /scoreOverlayEarlyDismissRef/);
  assert.match(html, /roundEndTransitionArmedRef/);
  assert.match(html, /applyQueuedScoreOverlayDismiss/);
  assert.doesNotMatch(html, /requestScoreOverlayDismiss[\s\S]{0,220}dismissScoreOverlays\(true\)/);
});

test("source — last-hand recovery watchdog", () => {
  assert.match(html, /armLastHandRecoveryWatchdog/);
  assert.match(html, /recoverLastHandStuckState/);
  assert.match(html, /1500\)/);
});

test("source — round clear gated on quota", () => {
  assert.match(html, /beginRoundClearCard[\s\S]*if \(!skipQuotaCheck\)/);
  assert.match(html, /effectiveScore < effectiveTarget\) return/);
  assert.match(html, /quotaTarget/);
});

test("source — cash display never negative", () => {
  assert.match(html, /Math\.max\(0, displayGold\)/);
  assert.match(html, /setDisplayGold\(Math\.max\(0,/);
});

test("source — loss overlay dismiss control", () => {
  assert.match(html, /LossExplanationOverlay[\s\S]*onDismiss/);
});

test("source — compact landscape layout hooks", () => {
  assert.match(html, /max-height: 450px/);
  assert.match(html, /run-intel-collapse-toggle/);
  assert.match(html, /shop-stash-panel[\s\S]*sticky/);
});
