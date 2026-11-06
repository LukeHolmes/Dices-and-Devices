"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createGame, plain } = require("./helpers/game.cjs");
const f = require("./fixtures/runs.cjs");

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

function loadHardening() {
  const open = '<script id="gutterbones-hardening">';
  const start = html.indexOf(open);
  assert.ok(start >= 0, "gutterbones-hardening script missing");
  const bodyStart = start + open.length;
  const end = html.indexOf("</script>", bodyStart);
  const sandbox = { window: {}, console };
  vm.runInNewContext(`${html.slice(bodyStart, end)}\n;`, sandbox);
  assert.ok(sandbox.window.GutterbonesHardening, "GutterbonesHardening export");
  return sandbox.window.GutterbonesHardening;
}

test("GutterbonesHardening — money and score sanitization", () => {
  const H = loadHardening();
  const run = H.sanitizeMoneyFields({
    gold: NaN,
    debt: "bad",
    score: Infinity,
    target: -3,
    stash: 500,
  });
  assert.equal(run.gold, 0);
  assert.equal(run.debt, 0);
  assert.equal(run.score, 0);
  assert.equal(run.target, 1);
  assert.equal(run.stash, 100);
  const score = H.sanitizeScoreResult({ chips: NaN, mult: NaN, flowMult: 0, total: NaN });
  assert.equal(score.chips, 0);
  assert.ok(score.mult >= 0.01);
  assert.ok(Number.isFinite(score.total));
});

test("GutterbonesHardening — exclusive overlay guard", () => {
  const H = loadHardening();
  assert.equal(H.requestOverlay("bossIntro"), true);
  assert.equal(H.requestOverlay("scoreBreakdown"), false);
  assert.equal(H.getActiveOverlay(), "bossIntro");
  H.clearOverlay("bossIntro");
  assert.equal(H.getActiveOverlay(), null);
  const collapsed = H.syncExclusiveOverlay({
    bossIntro: true,
    scoreBreakdown: true,
    scoreResolution: false,
    roundClear: false,
    lossExplanation: false,
    systemMenu: false,
    helpOverlay: false,
    tutorialCoach: false,
    firstRun: false,
    stuckRecovery: false,
  });
  assert.equal(collapsed.bossIntro, false);
  assert.equal(collapsed.scoreBreakdown, true);
  assert.equal(H.getActiveOverlay(), "scoreBreakdown");
});

test("GutterbonesHardening — illegal phase transitions rejected", () => {
  const H = loadHardening();
  assert.equal(H.requestPhase("CARVING", "TITLE"), false);
  assert.equal(H.requestPhase("PLAY", "TITLE"), true);
  H.requestOverlay("bossIntro");
  assert.equal(H.requestPhase("SHOP", "PLAY"), false);
  H.clearOverlay("bossIntro");
});

test("normalizeSavedRun — NaN money fields coerced", () => {
  const g = createGame(f.snapshot());
  const raw = f.run({
    gold: NaN,
    debt: NaN,
    score: NaN,
    target: NaN,
    stash: NaN,
    hands: NaN,
    discards: NaN,
    version: NaN,
  });
  const normalized = g.api.normalizeSavedRun(raw);
  assert.ok(normalized);
  assert.equal(normalized.gold, 0);
  assert.equal(normalized.debt, 0);
  assert.equal(normalized.score, 0);
  assert.ok(normalized.target >= 1);
  assert.equal(normalized.stash, 0);
  assert.equal(normalized.version, 2);
});

test("normalizeSavedRun — invalid dice length rejected", () => {
  const g = createGame(f.snapshot());
  assert.equal(g.api.normalizeSavedRun({ personaId: "street-rat", dice: [1, 2, 3] }), null);
});

test("source — hardening hooks present", () => {
  assert.match(html, /id="gutterbones-hardening"/);
  assert.match(html, /stuck-recovery-overlay/);
  assert.match(html, /requestPhase\(next, prev\)/);
  assert.match(html, /Corrupt run save discarded/);
});
