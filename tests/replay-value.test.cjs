"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { replaySource } = require("./helpers/game.cjs");
const { probClear } = require("../scripts/sim-opening.cjs");

function loadReplay() {
  const sandbox = {};
  vm.createContext(sandbox);
  new vm.Script(replaySource + "\nglobalThis.gr = GutterbonesReplay;").runInContext(sandbox);
  return sandbox.gr;
}

test("daily seed is stable for UTC date", () => {
  const gr = loadReplay();
  const a = gr.dailySeed("2026-10-30");
  const b = gr.dailySeed("2026-10-30");
  const c = gr.dailySeed("2026-10-31");
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("mulberry32 sequence is deterministic", () => {
  const gr = loadReplay();
  const r1 = gr.mulberry32(42);
  const r2 = gr.mulberry32(42);
  assert.equal(r1(), r2());
  assert.equal(r1(), r2());
});

test("daily config picks two distinct modifiers", () => {
  const gr = loadReplay();
  const cfg = gr.getDailyRunConfig("2026-10-30");
  assert.equal(cfg.modifierIds.length, 2);
  assert.notEqual(cfg.modifierIds[0], cfg.modifierIds[1]);
});

test("canStartDaily allows first attempt only", () => {
  const gr = loadReplay();
  const key = "2026-10-30";
  const meta = { dailyAttempts: {} };
  assert.equal(gr.canStartDaily(meta, key), true);
  const after = gr.recordDailyResult(meta, { dateKey: key, heat: 50, round: 2 });
  assert.equal(gr.canStartDaily(after, key), false);
});

test("syncPlayUnlocks grants grinder persona at round 3", () => {
  const gr = loadReplay();
  const next = gr.syncPlayUnlocks({ bestRoundReached: 3, unlockedPersonaIds: ["STREET_RAT"] });
  assert.ok(next.unlockedPersonaIds.includes("GRINDER"));
  assert.ok(next.unlockedPlayIds.includes("unlock-grinder"));
});

test("modifier shop offers only unlocked pool ids", () => {
  const gr = loadReplay();
  let rng = 0;
  const rngFn = () => {
    rng += 1;
    return rng === 1 ? 0.1 : 0.99;
  };
  const offers = gr.modifierShopOffers({ unlockedModifierIds: ["ODD_EVEN_SPLIT"] }, rngFn);
  assert.equal(offers.length, 1);
  assert.equal(offers[0].modifierId, "ODD_EVEN_SPLIT");
});

test("ODD_EVEN modifier adjusts valid scores", () => {
  const gr = loadReplay();
  const dice = [{ value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }, { value: 5 }];
  const base = { valid: true, chips: 10, mult: 1, flowMult: 1, total: 10 };
  const out = gr.applyRunModifiersToScore(base, "TWOS", dice, [false, false, false, false, false], ["ODD_EVEN_SPLIT"], null);
  assert.ok(out.total > base.total);
});

test("all run modifiers keep R1-style scores within sane band on sample hand", () => {
  const gr = loadReplay();
  const dice = [{ value: 3 }, { value: 3 }, { value: 3 }, { value: 4 }, { value: 5 }];
  const base = { valid: true, chips: 40, mult: 1, flowMult: 1, total: 40 };
  const ids = Object.keys(gr.RUN_MODIFIERS);
  ids.forEach((id) => {
    const out = gr.applyRunModifiersToScore(base, "TOK", dice, [true, true, true, false, false], [id], null, { sacrificeBonus: id === "SACRIFICE_SLOT" ? 12 : 0 });
    assert.ok(out.total >= 30 && out.total <= 120, `${id} total ${out.total}`);
  });
});

test("opening balance unchanged with replay module loaded (R1 @75)", () => {
  const p = probClear({ target: 75, pills: 3, iterations: 2000, seed: 0x6e202610 });
  assert.ok(p >= 0.75 && p <= 1, `P(clear) ${p}`);
});

test("risk bone toll fires once per roll with a one", () => {
  const gr = loadReplay();
  assert.equal(gr.riskBoneToll([{ value: 1 }, { value: 2 }], [true, true]), 1);
  assert.equal(gr.riskBoneToll([{ value: 2 }, { value: 3 }], [true, true]), 0);
});

test("stash interest scales with unspent stash percent", () => {
  const gr = loadReplay();
  assert.equal(gr.stashInterestPayout(0), 0);
  assert.equal(gr.stashInterestPayout(25), 1);
  assert.equal(gr.stashInterestPayout(50), 2);
});

test("sacrifice blanks lowest pip slot", () => {
  const gr = loadReplay();
  const dice = [{ value: 2 }, { value: 5 }, { value: 1 }];
  const { dice: next, applied, bonus } = gr.applySacrificeToDice(dice);
  assert.equal(applied, true);
  assert.ok(bonus >= 10);
  assert.equal(next[2].value, 0);
});

test("share string includes date and heat", () => {
  const gr = loadReplay();
  const s = gr.dailyShareString({ dateKey: "2026-10-30", heat: 140, rounds: 4 });
  assert.match(s, /2026-10-30/);
  assert.match(s, /heat:140/);
});

test("filterPathsForMeta hides grind until unlocked", () => {
  const gr = loadReplay();
  const paths = [{ id: "LOCAL" }, ...gr.EXTRA_PATHS];
  const locked = gr.filterPathsForMeta(paths, { unlockedRouteIds: [] });
  assert.ok(locked.some((p) => p.id === "LOCAL"));
  assert.ok(!locked.some((p) => p.id === "GRIND"));
  const open = gr.filterPathsForMeta(paths, { unlockedRouteIds: ["GRIND"] });
  assert.ok(open.some((p) => p.id === "GRIND"));
});
