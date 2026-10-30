"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createGame, plain } = require("./helpers/game.cjs");
const { snapshot, dice, bone, bossCases } = require("./fixtures/runs.cjs");
for (const [cat, values, total] of [
  ["C", [1, 2, 3, 4, 5], 37],
  ["TOK", [2, 2, 2, 4, 5], 40],
  ["FOK", [3, 3, 3, 3, 5], 105],
  ["FH", [2, 2, 3, 3, 3], 90],
  ["SS", [1, 2, 3, 4, 6], 60],
  ["LS", [1, 2, 3, 4, 5], 120],
  ["Y", [6, 6, 6, 6, 6], 250],
  ["SIXES", [6, 6, 1, 2, 3], 36],
]) {
  test(`${cat}: standard payout ${total}`, () =>
    assert.equal(
      createGame(snapshot()).api.calculateScore(cat, dice(values)).total,
      total,
    ));
}
test("Invalid sets do not pay", () => {
  const r = createGame(snapshot()).api.calculateScore(
    "Y",
    dice([1, 2, 3, 4, 5]),
  );
  assert.equal(r.valid, false);
  assert.equal(r.total, 0);
  assert.match(r.reason, /five of a kind/i);
});
test("Invalid Triad includes reason", () => {
  const r = createGame(snapshot()).api.calculateScore(
    "TOK",
    dice([1, 2, 3, 4, 5]),
  );
  assert.equal(r.valid, false);
  assert.match(r.reason, /three of a kind/i);
});
test("Double rollBones in one tick does not spend extra pill", () => {
  const g = createGame(snapshot({ discards: 3, hasRolled: true }));
  g.api.rollBones();
  g.api.rollBones();
  assert.equal(g.state("discards"), 2);
});
test("Wild fills a missing straight value", () =>
  assert.equal(
    createGame(snapshot()).api.calculateScore("LS", dice([1, 2, "W", 4, 5]))
      .total,
    120,
  ));
test("Carved modifier and gold face apply without mutating dice", () => {
  const d = dice([1, 2, 3, 0, 0]);
  d[3].faceId = "MULT_FACE";
  d[4].faceId = "GOLD_FACE";
  const before = JSON.stringify(d);
  const r = createGame(snapshot()).api.calculateScore("C", d);
  assert.equal(r.total, 40);
  assert.equal(r.gDelta, 2);
  assert.equal(JSON.stringify(d), before);
});
test("Echo copies left face and Shiv destroys right slot", () => {
  const g = createGame(snapshot());
  const d = [
    bone(3),
    bone(0, 1, { faceId: "ECHO_FACE" }),
    bone(0, 2, { faceId: "SHIV_FACE" }),
    bone(6, 3),
    bone(2, 4),
  ];
  const r = g.api.GutterbonesRules.resolveDice(d);
  assert.equal(r.resolved[1].value, 3);
  assert.deepEqual([...r.destroyed], [3]);
  assert.equal(d[1].value, 0);
});
test("Crooked Cop suppresses hardware", () => {
  const d = dice([1, 2, 3, 4, 5]);
  const inv = [{ id: "ENGINE" }];
  assert.equal(
    createGame(snapshot({ inventory: inv })).api.calculateScore("C", d).total,
    137,
  );
  assert.equal(
    createGame(
      snapshot({
        inventory: inv,
        hardwareDisabled: true,
        activeBoss: { id: "CROOKED_COP" },
      }),
    ).api.calculateScore("C", d).total,
    37,
  );
});
for (const [id, target] of bossCases)
  test(`${id}: target fixture`, () => {
    const g = createGame(snapshot());
    assert.equal(g.api.getBossAdjustedTarget(130, g.api.BOSSES[id], 5), target);
  });
test("Junkie transforms settled sixes on normal roll", () => {
  const g = createGame(snapshot({ activeBoss: { id: "JUNKIE" } }));
  g.api.rollBones();
  g.flushTimers();
  assert.deepEqual(plain(g.state("dice").map((d) => d.value)), [1, 1, 1, 1, 1]);
});
test("Loan Shark charges roll toll", () => {
  const g = createGame(snapshot({ activeBoss: { id: "LOAN_SHARK" } }));
  g.api.rollBones();
  assert.equal(g.state("gold"), 18);
});
test("Raid charges pill toll", () => {
  const g = createGame(snapshot({ activeBoss: { id: "THE_RAID" } }));
  g.api.popPill(0);
  assert.equal(g.state("gold"), 18);
  assert.equal(g.state("discards"), 2);
});
test("Informant freezes stash", () => {
  const g = createGame(
    snapshot({ activeBoss: { id: "INFORMANT" }, stash: 20 }),
  );
  g.api.executePayout("C");
  assert.equal(g.state("stash"), 20);
  assert.equal(g.state("score"), 37);
});
