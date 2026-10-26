"use strict";
// Stage 1 refactor gate only. Later intentional rule fixes must retire this gate.
const { execFileSync } = require("node:child_process");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const { createGame, plain } = require("./helpers/game.cjs");
const f = require("./fixtures/runs.cjs");
const base = execFileSync(
  "git",
  ["show", "8794488f2e2ecd3f781fa79aed55afa028200927:index.html"],
  { encoding: "utf8", maxBuffer: 1000000 },
);
const definitions = base.slice(
  base.indexOf("    const PERSONAS ="),
  base.indexOf("    const CashRain ="),
);
function action(name) {
  const start = base.indexOf(`        const ${name} = `);
  assert.ok(start >= 0);
  const closing = /\n        \};/.exec(base.slice(start));
  assert.ok(closing);
  return base.slice(start, start + closing.index + closing[0].length);
}
function original(snapshot) {
  const ctx = vm.createContext(snapshot);
  new vm.Script(
    definitions +
      "\n" +
      action("resolveDice") +
      "\n" +
      action("calculateScore") +
      "\nglobalThis.api={calculateScore,normalizeSavedRun};",
  ).runInContext(ctx);
  return ctx.api;
}
let comparisons = 0;
function compare(old, current, d) {
  for (const cat of Object.keys(current.CATEGORIES)) {
    assert.deepEqual(
      plain(current.calculateScore(cat, d)),
      plain(old.calculateScore(cat, d)),
    );
    comparisons++;
  }
}
const state = f.snapshot();
const old = original(state);
const current = createGame(state).api;
for (let n = 0; n < 6 ** 5; n++) {
  let v = n;
  const values = Array.from({ length: 5 }, () => {
    const face = (v % 6) + 1;
    v = Math.floor(v / 6);
    return face;
  });
  compare(old, current, f.dice(values));
}
for (const inventory of [
  [],
  ...Object.values(current.DEVISES).map((item) => [item]),
  [{ id: "ENGINE" }, { id: "BLOOD_PACT" }],
  [{ id: "BLOOD_PACT" }, { id: "ENGINE" }],
]) {
  for (const disabled of [false, true]) {
    const s = f.snapshot({
      inventory,
      hardwareDisabled: disabled,
      flowStreak: 3,
      handLevels: { C: 4, Y: 3 },
    });
    const a = original(s),
      b = createGame(s).api;
    for (const face of Object.values(current.FACE_DATABASE)) {
      for (let slot = 0; slot < 5; slot++) {
        const d = f.dice([1, 2, 3, 4, 5]);
        d[slot] = {
          ...d[slot],
          value: face.value,
          faceId: face.id,
          type: face.type,
        };
        compare(a, b, d);
      }
    }
  }
}
for (const raw of [
  null,
  {},
  f.run(),
  f.wager(),
  f.gamble(),
  f.carving(),
  f.run({ flowStreak: NaN, activeWager: { stake: -1 } }),
])
  assert.deepEqual(
    plain(current.normalizeSavedRun(raw)),
    plain(old.normalizeSavedRun(raw)),
  );
console.log(
  `${comparisons} complete score results and 7 save cases match the pinned baseline.`,
);
